'use strict';

const mongoose = require('mongoose');
const { Recharge, User, PixSetting, Activity } = require('../../database/schemas');
const pixService = require('./pix.service');
const cryptoService = require('./crypto.service');

class RechargeService {
  async createRecharge(userId, botId, ownerId, amount, method, options = {}) {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      const err = new Error('Valor da recarga deve ser positivo.');
      err.statusCode = 400;
      throw err;
    }

    if (method === 'pix_auto') {
      return this._createPixRecharge(userId, botId, ownerId, amountNum);
    }
    if (method === 'crypto') {
      return this._createCryptoRecharge(userId, botId, ownerId, amountNum, options.currency);
    }
    if (method === 'manual') {
      return this._createManualRecharge(userId, botId, ownerId, amountNum);
    }

    const err = new Error(`Metodo '${method}' nao suportado. Use: pix_auto, crypto, manual`);
    err.statusCode = 400;
    throw err;
  }

  async _createPixRecharge(userId, botId, ownerId, amount) {
    const pixResult = await pixService.generatePixCharge(ownerId, botId, amount, userId);
    const pixSettings = await PixSetting.getForBot(ownerId, botId);
    const expiresMinutes = pixSettings?.expiration_minutes || 30;

    const recharge = await Recharge.create({
      userId: new mongoose.Types.ObjectId(userId),
      amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
      method: 'pix_auto',
      status: 'pending',
      pix_key: pixResult.copyPaste,
      qr_code: pixResult.qrCode,
      txn_id: pixResult.txid,
      bot_id: new mongoose.Types.ObjectId(botId),
      owner_id: new mongoose.Types.ObjectId(ownerId),
      expires_at: new Date(Date.now() + expiresMinutes * 60 * 1000),
    });

    return {
      rechargeId: recharge._id.toString(),
      method: 'pix_auto',
      paymentData: {
        provider: pixResult.provider,
        qrCode: pixResult.qrCode,
        copyPaste: pixResult.copyPaste,
        txid: pixResult.txid,
        fee: pixResult.fee,
      },
      amount,
      expiresAt: recharge.expires_at,
      remainingSeconds: recharge.remainingSeconds,
    };
  }

  async _createCryptoRecharge(userId, botId, ownerId, amount, currency) {
    if (!currency) {
      const err = new Error('Moeda cripto e obrigatoria (BTC, ETH, USDT, LTC, etc).');
      err.statusCode = 400;
      throw err;
    }

    const cryptoResult = await cryptoService.generateCryptoInvoice(amount, currency, userId, botId);

    const recharge = await Recharge.create({
      userId: new mongoose.Types.ObjectId(userId),
      amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
      method: 'crypto',
      status: 'pending',
      txn_id: cryptoResult.invoiceId,
      bot_id: new mongoose.Types.ObjectId(botId),
      owner_id: new mongoose.Types.ObjectId(ownerId),
      expires_at: cryptoResult.expiresAt,
    });

    return {
      rechargeId: recharge._id.toString(),
      method: 'crypto',
      paymentData: {
        invoiceId: cryptoResult.invoiceId,
        address: cryptoResult.address,
        amountCrypto: cryptoResult.amountCrypto,
        currency: cryptoResult.currency,
        network: cryptoResult.network,
        orderId: cryptoResult.orderId,
      },
      amount,
      expiresAt: recharge.expires_at,
      remainingSeconds: recharge.remainingSeconds,
    };
  }

  async _createManualRecharge(userId, botId, ownerId, amount) {
    const recharge = await Recharge.create({
      userId: new mongoose.Types.ObjectId(userId),
      amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
      method: 'manual',
      status: 'pending',
      bot_id: new mongoose.Types.ObjectId(botId),
      owner_id: new mongoose.Types.ObjectId(ownerId),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return {
      rechargeId: recharge._id.toString(),
      method: 'manual',
      paymentData: {
        instructions: 'Envie o comprovante para o administrador aprovar.',
      },
      amount,
      expiresAt: recharge.expires_at,
    };
  }

  async getRechargeHistory(userId, botId, filters = {}) {
    const { startDate, endDate, status, method, page = 1, limit = 20 } = filters;

    const query = { userId: new mongoose.Types.ObjectId(userId) };
    if (botId) query.bot_id = new mongoose.Types.ObjectId(botId);
    if (status) query.status = status;
    if (method) query.method = method;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [recharges, total] = await Promise.all([
      Recharge.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Recharge.countDocuments(query),
    ]);

    return {
      recharges,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / lim),
    };
  }

  async getRechargeSettings(ownerId, botId) {
    const pixSettings = await pixService.getPixSettings(ownerId, botId);
    const cryptoCurrencies = await cryptoService.getSupportedCurrencies();

    return {
      pix: pixSettings || { enabled: false },
      crypto: {
        enabled: Boolean(require('../config').nowpaymentsApiKey),
        currencies: cryptoCurrencies,
      },
      manual: { enabled: true },
    };
  }

  async processPixRecharge(txnId, callbackData) {
    const result = await pixService.processPixCallback({
      txid: txnId,
      ...callbackData,
    });

    if (!result.processed) {
      return { success: false, action: result.action };
    }

    return this._creditRecharge(result.txnId);
  }

  async processCryptoRecharge(callbackData) {
    const result = await cryptoService.processCryptoCallback(callbackData);

    if (!result.processed) {
      return { success: false, action: result.action };
    }

    return this._creditRecharge(result.invoiceId, {
      actuallyPaid: result.actuallyPaid,
      priceAmount: result.priceAmount,
      isPartial: result.status === 'partially_paid',
    });
  }

  async _creditRecharge(txnId, cryptoMeta = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const recharge = await Recharge.findOneAndUpdate(
        { txn_id: txnId, status: 'pending' },
        {
          $set: {
            status: 'completed',
            completed_at: new Date(),
          },
        },
        { new: true, session }
      );

      if (!recharge) {
        await session.abortTransaction();
        return { success: false, action: 'recharge_not_found_or_already_processed' };
      }

      let creditAmount = parseFloat(recharge.amount.toString());

      if (cryptoMeta.isPartial && cryptoMeta.priceAmount > 0) {
        const ratio = (cryptoMeta.actuallyPaid || 0) / (cryptoMeta.priceAmount || 1);
        creditAmount = Math.max(0, Number((creditAmount * ratio).toFixed(2)));

        if (creditAmount <= 0) {
          await Recharge.findByIdAndUpdate(recharge._id, { status: 'failed' }, { session });
          await session.commitTransaction();
          return { success: false, action: 'partial_amount_too_low' };
        }
      }

      const user = await User.findByIdAndUpdate(
        recharge.userId,
        {
          $inc: {
            balance: mongoose.Types.Decimal128.fromString(creditAmount.toFixed(2)),
          },
        },
        { new: true, session }
      );

      if (!user) {
        await session.abortTransaction();
        return { success: false, action: 'user_not_found' };
      }

      await session.commitTransaction();

      const balanceAfter = parseFloat(user.balance?.toString() || '0');

      Activity.log?.({
        type: 'recharge_completed',
        userId: recharge.userId,
        details: {
          rechargeId: recharge._id,
          method: recharge.method,
          amount: creditAmount,
          txnId,
        },
      }).catch(() => {});

      return {
        success: true,
        rechargeId: recharge._id,
        amount: creditAmount,
        balanceAfter,
        action: 'balance_credited',
      };
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  async processManualRecharge(rechargeId, adminId) {
    const recharge = await Recharge.findById(rechargeId);
    if (!recharge) {
      const err = new Error('Recarga nao encontrada.');
      err.statusCode = 404;
      throw err;
    }

    if (recharge.status !== 'pending') {
      const err = new Error(`Recarga ja foi processada (status: ${recharge.status}).`);
      err.statusCode = 400;
      throw err;
    }

    if (recharge.method !== 'manual') {
      const err = new Error('Apenas recargas manuais podem ser aprovadas por admin.');
      err.statusCode = 400;
      throw err;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const updated = await Recharge.findOneAndUpdate(
        { _id: recharge._id, status: 'pending' },
        {
          $set: {
            status: 'completed',
            completed_at: new Date(),
          },
        },
        { new: true, session }
      );

      if (!updated) {
        await session.abortTransaction();
        const err = new Error('Recarga ja processada por outro admin.');
        err.statusCode = 409;
        throw err;
      }

      const amount = parseFloat(updated.amount.toString());

      const user = await User.findByIdAndUpdate(
        updated.userId,
        {
          $inc: {
            balance: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
          },
        },
        { new: true, session }
      );

      await session.commitTransaction();

      const balanceAfter = parseFloat(user.balance?.toString() || '0');

      Activity.log?.({
        type: 'manual_recharge_approved',
        userId: updated.userId,
        details: {
          rechargeId: updated._id,
          amount,
          approvedBy: adminId,
        },
      }).catch(() => {});

      return {
        success: true,
        rechargeId: updated._id,
        amount,
        balanceAfter,
        recharge: updated.toObject(),
      };
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new RechargeService();
