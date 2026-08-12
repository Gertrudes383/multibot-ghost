'use strict';

/**
 * PaymentPoller — Polling automático de pagamentos PIX e Crypto.
 *
 * Porta do V2 Python:
 * - verify_pay() — poll PIX a cada 10s por 30min
 * - crypto_checker — poll crypto a cada 30s
 * - Payment recovery on startup
 *
 * Cada BotInstance tem seu próprio PaymentPoller.
 */

const mongoose = require('mongoose');
const { Recharge, User, Activity } = require('../../../database/schemas');
const pixService = require('../../services/pix.service');
const cryptoService = require('../../services/crypto.service');

const PIX_POLL_INTERVAL_MS = 10000;    // 10 segundos
const CRYPTO_POLL_INTERVAL_MS = 30000; // 30 segundos
const PIX_EXPIRY_MS = 30 * 60 * 1000;  // 30 minutos

class PaymentPoller {
  constructor(botInstance) {
    this.bot = botInstance.bot;
    this.botDoc = botInstance.botDoc;
    this.botId = String(botInstance.botDoc._id);
    this.ownerId = String(botInstance.botDoc.owner_id);

    // PIX polling: rechargeId -> { timer, startedAt }
    this._pixPollers = new Map();
    // Crypto global poller
    this._cryptoTimer = null;
    this._destroyed = false;
  }

  /**
   * Inicia polling de um pagamento PIX específico.
   */
  startPixPoll(rechargeId, chatId) {
    if (this._destroyed) return;
    if (this._pixPollers.has(rechargeId)) return;

    const startedAt = Date.now();

    const timer = setInterval(async () => {
      if (this._destroyed) {
        this._stopPixPoll(rechargeId);
        return;
      }

      // Verificar expiração
      if (Date.now() - startedAt > PIX_EXPIRY_MS) {
        this._stopPixPoll(rechargeId);
        await this._handlePixExpired(rechargeId, chatId);
        return;
      }

      try {
        await this._checkPixPayment(rechargeId, chatId);
      } catch (err) {
        console.error(`[PaymentPoller] Erro PIX poll ${rechargeId}: ${err.message}`);
      }
    }, PIX_POLL_INTERVAL_MS);

    this._pixPollers.set(rechargeId, { timer, startedAt, chatId });
  }

  /**
   * Inicia o checker automático de crypto.
   */
  startCryptoChecker() {
    if (this._destroyed || this._cryptoTimer) return;

    this._cryptoTimer = setInterval(async () => {
      if (this._destroyed) return;
      try {
        await this._checkPendingCrypto();
      } catch (err) {
        console.error(`[PaymentPoller] Erro crypto checker: ${err.message}`);
      }
    }, CRYPTO_POLL_INTERVAL_MS);
  }

  /**
   * Recupera pagamentos pendentes do DB ao iniciar o bot.
   */
  async recoverPendingPayments() {
    try {
      const pendingRecharges = await Recharge.find({
        bot_id: new mongoose.Types.ObjectId(this.botId),
        status: 'pending',
        expires_at: { $gt: new Date() },
      }).lean();

      let recovered = 0;
      for (const recharge of pendingRecharges) {
        if (recharge.method === 'pix_auto' && recharge.txn_id) {
          // Não temos o chatId salvo, mas podemos tentar notificar via userId
          const user = await User.findById(recharge.userId).lean();
          if (user?.telegram_id) {
            this.startPixPoll(String(recharge._id), user.telegram_id);
            recovered++;
          }
        }
      }

      if (recovered > 0) {
        console.log(`[PaymentPoller] ${recovered} pagamentos PIX recuperados`);
      }
    } catch (err) {
      console.error(`[PaymentPoller] Erro na recuperação: ${err.message}`);
    }
  }

  /**
   * Para todo o polling.
   */
  destroy() {
    this._destroyed = true;

    for (const [id, { timer }] of this._pixPollers) {
      clearInterval(timer);
    }
    this._pixPollers.clear();

    if (this._cryptoTimer) {
      clearInterval(this._cryptoTimer);
      this._cryptoTimer = null;
    }
  }

  // ─── INTERNAL ───

  _stopPixPoll(rechargeId) {
    const entry = this._pixPollers.get(rechargeId);
    if (entry) {
      clearInterval(entry.timer);
      this._pixPollers.delete(rechargeId);
    }
  }

  async _checkPixPayment(rechargeId, chatId) {
    const recharge = await Recharge.findById(rechargeId).lean();
    if (!recharge || recharge.status !== 'pending') {
      this._stopPixPoll(rechargeId);
      return;
    }

    if (!recharge.txn_id) return;

    const result = await pixService.checkPixStatus(this.ownerId, this.botId, recharge.txn_id);

    if (result.status === 'paid') {
      this._stopPixPoll(rechargeId);
      await this._creditRecharge(recharge, chatId);
    } else if (result.status === 'expired' || result.status === 'cancelled') {
      this._stopPixPoll(rechargeId);
      await this._handlePixExpired(rechargeId, chatId);
    }
  }

  async _handlePixExpired(rechargeId, chatId) {
    await Recharge.findByIdAndUpdate(rechargeId, {
      $set: { status: 'expired' },
    });

    if (this.bot && chatId) {
      try {
        await this.bot.sendMessage(chatId, '⏰ Seu pagamento PIX expirou. Tente novamente.');
      } catch {
        // ignore — user may have blocked bot
      }
    }
  }

  async _checkPendingCrypto() {
    const pendingCrypto = await Recharge.find({
      bot_id: new mongoose.Types.ObjectId(this.botId),
      method: 'crypto',
      status: 'pending',
    }).lean();

    for (const recharge of pendingCrypto) {
      if (!recharge.txn_id) continue;

      try {
        const result = await cryptoService.checkCryptoStatus(recharge.txn_id);

        if (result.status === 'paid') {
          const user = await User.findById(recharge.userId).lean();
          const chatId = user?.telegram_id;
          await this._creditRecharge(recharge, chatId, {
            actuallyPaid: result.actuallyPaid,
            priceAmount: result.priceAmount,
          });
        } else if (result.status === 'expired') {
          await Recharge.findByIdAndUpdate(recharge._id, {
            $set: { status: 'expired' },
          });
        }
      } catch (err) {
        console.error(`[PaymentPoller] Crypto check ${recharge.txn_id}: ${err.message}`);
      }
    }
  }

  async _creditRecharge(recharge, chatId, cryptoMeta = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const updated = await Recharge.findOneAndUpdate(
        { _id: recharge._id, status: 'pending' },
        { $set: { status: 'completed', completed_at: new Date() } },
        { new: true, session }
      );

      if (!updated) {
        await session.abortTransaction();
        return;
      }

      let creditAmount = parseFloat(updated.amount.toString());

      // Pagamento parcial crypto
      if (cryptoMeta.priceAmount > 0 && cryptoMeta.actuallyPaid > 0) {
        const ratio = cryptoMeta.actuallyPaid / cryptoMeta.priceAmount;
        if (ratio < 0.98) {
          creditAmount = Math.max(0, Number((creditAmount * ratio).toFixed(2)));
        }
      }

      if (creditAmount <= 0) {
        await Recharge.findByIdAndUpdate(updated._id, { status: 'failed' }, { session });
        await session.commitTransaction();
        return;
      }

      const user = await User.findByIdAndUpdate(
        updated.userId,
        {
          $inc: {
            balance: mongoose.Types.Decimal128.fromString(creditAmount.toFixed(2)),
            total_recharged: mongoose.Types.Decimal128.fromString(creditAmount.toFixed(2)),
          },
        },
        { new: true, session }
      );

      await session.commitTransaction();

      // Log activity
      Activity.log?.({
        type: 'recharge_completed',
        userId: updated.userId,
        details: {
          rechargeId: updated._id,
          method: updated.method,
          amount: creditAmount,
          txnId: updated.txn_id,
        },
      }).catch(() => {});

      // Notificar usuário
      if (this.bot && chatId) {
        const { currency } = require('../utils/messageFormatter');
        const balanceAfter = parseFloat(user?.balance?.toString() || '0');
        try {
          await this.bot.sendMessage(chatId, [
            `✅ <b>Pagamento Confirmado!</b>`,
            ``,
            `Valor creditado: <b>${currency(creditAmount)}</b>`,
            `Novo saldo: <b>${currency(balanceAfter)}</b>`,
          ].join('\n'), { parse_mode: 'HTML' });
        } catch {
          // ignore
        }
      }
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      console.error(`[PaymentPoller] Erro ao creditar recarga: ${error.message}`);
    } finally {
      session.endSession();
    }
  }
}

module.exports = PaymentPoller;
