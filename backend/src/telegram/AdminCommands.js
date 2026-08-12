'use strict';

const mongoose = require('mongoose');
const { User, Card, Order, Recharge, Bot } = require('../../database/schemas');
const MenuBuilder = require('./MenuBuilder');
const { bold, currency, code, separator, statusEmoji, formatDate, formatUptime } = require('./utils/messageFormatter');
const { BroadcastRateLimiter } = require('./utils/rateLimiter');

class AdminCommands {
  constructor(botInstance) {
    this.bot = botInstance.bot;
    this.botDoc = botInstance.botDoc;
    this.activeBroadcasts = new Map();
  }

  async handleAdminCommand(msg) {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);

    const user = await User.findByTelegram(telegramId, this.botDoc.id);
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return this.bot.sendMessage(chatId, '🚫 Acesso negado.');
    }

    return this.bot.sendMessage(chatId, `${bold('⚙️ Painel Administrativo')}`, {
      parse_mode: 'HTML',
      ...MenuBuilder.adminMenu(),
    });
  }

  async broadcast(chatId, adminUser, text, options = {}) {
    if (!text) {
      return this.bot.sendMessage(chatId, '❌ Texto da mensagem não pode ser vazio.');
    }

    const query = { bot_id: this.botDoc.id, banned: false };
    if (options.onlyActive) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query.telegram_last_seen = { $gte: thirtyDaysAgo };
    }

    const users = await User.find(query).select('telegram_id').lean();
    if (!users.length) {
      return this.bot.sendMessage(chatId, '📭 Nenhum usuário encontrado para broadcast.');
    }

    const broadcastId = new mongoose.Types.ObjectId().toString();
    const limiter = new BroadcastRateLimiter();
    this.activeBroadcasts.set(broadcastId, limiter);

    await this.bot.sendMessage(chatId, [
      `${bold('📢 Broadcast Iniciado')}`,
      separator(),
      `ID: ${code(broadcastId)}`,
      `Destinatários: ${bold(String(users.length))}`,
      ``,
      `Para cancelar: /cancelbroadcast ${broadcastId}`,
    ].join('\n'), { parse_mode: 'HTML' });

    let sent = 0;
    let failed = 0;

    for (const u of users) {
      if (!u.telegram_id) {
        failed++;
        continue;
      }

      limiter.enqueue(async () => {
        try {
          if (options.image) {
            await this.bot.sendPhoto(u.telegram_id, options.image, {
              caption: text,
              parse_mode: 'HTML',
            });
          } else {
            await this.bot.sendMessage(u.telegram_id, text, { parse_mode: 'HTML' });
          }
          sent++;
        } catch {
          failed++;
        }
      }).catch(() => { failed++; });
    }

    const waitCheck = setInterval(async () => {
      if (limiter.pending === 0) {
        clearInterval(waitCheck);
        this.activeBroadcasts.delete(broadcastId);
        await this.bot.sendMessage(chatId, [
          `${bold('✅ Broadcast Finalizado')}`,
          separator(),
          `ID: ${code(broadcastId)}`,
          `Enviados: ${bold(String(sent))}`,
          `Falhas: ${bold(String(failed))}`,
        ].join('\n'), { parse_mode: 'HTML' });
      }
    }, 2000);

    return broadcastId;
  }

  async cancelBroadcast(chatId, broadcastId) {
    const limiter = this.activeBroadcasts.get(broadcastId);
    if (!limiter) {
      return this.bot.sendMessage(chatId, '❌ Broadcast não encontrado ou já finalizado.');
    }

    const cancelled = limiter.cancel();
    this.activeBroadcasts.delete(broadcastId);
    return this.bot.sendMessage(chatId, `🚫 Broadcast cancelado. ${cancelled} mensagens removidas da fila.`);
  }

  async getStats(chatId) {
    const botId = this.botDoc.id;
    const botOid = new mongoose.Types.ObjectId(botId);

    const [totalUsers, totalOrders, totalCards, totalRecharges, salesAgg, rechargesAgg] = await Promise.all([
      User.countDocuments({ bot_id: botId }),
      Order.countDocuments({ bot_id: botOid }),
      Card.countDocuments({ bot_id: botOid, status: 'available' }),
      Recharge.countDocuments({ bot_id: botOid, status: 'completed' }),
      Order.aggregate([
        { $match: { bot_id: botOid, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$price' }, count: { $sum: 1 } } },
      ]),
      Recharge.aggregate([
        { $match: { bot_id: botOid, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const sales = salesAgg[0] || { total: 0, count: 0 };
    const recharges = rechargesAgg[0] || { total: 0, count: 0 };

    return this.bot.sendMessage(chatId, [
      `${bold('📊 Estatísticas Completas')}`,
      separator(),
      ``,
      `${bold('👥 Usuários')}`,
      `Total: ${bold(String(totalUsers))}`,
      ``,
      `${bold('🛒 Vendas')}`,
      `Pedidos: ${bold(String(sales.count))}`,
      `Faturamento: ${bold(currency(sales.total))}`,
      ``,
      `${bold('💰 Recargas')}`,
      `Aprovadas: ${bold(String(recharges.count))}`,
      `Total: ${bold(currency(recharges.total))}`,
      ``,
      `${bold('📦 Estoque')}`,
      `Cards disponíveis: ${bold(String(totalCards))}`,
      ``,
      `${bold('🤖 Bot')}`,
      `Status: ${statusEmoji(this.botDoc.runtime_status)} ${this.botDoc.runtime_status}`,
      `Uptime: ${formatUptime(this.botDoc.uptime || 0)}`,
      `Último heartbeat: ${formatDate(this.botDoc.last_heartbeat)}`,
    ].join('\n'), {
      parse_mode: 'HTML',
      ...MenuBuilder.backButton('admin:main'),
    });
  }

  async getUserInfo(chatId, targetId) {
    const user = await User.findOne({ bot_id: this.botDoc.id, $or: [
      { telegram_id: String(targetId) },
      { _id: mongoose.isValidObjectId(targetId) ? targetId : null },
      { username: targetId },
    ] }).lean();

    if (!user) {
      return this.bot.sendMessage(chatId, '❌ Usuário não encontrado.');
    }

    return this.bot.sendMessage(chatId, [
      `${bold('👤 Info do Usuário')}`,
      separator(),
      `ID: ${code(String(user._id))}`,
      `Username: ${bold(user.username)}`,
      `Telegram: ${user.telegram_username ? `@${user.telegram_username}` : '—'}`,
      `Saldo: ${bold(currency(parseFloat(user.balance?.toString() || '0')))}`,
      `Compras: ${bold(String(user.purchaseCount || 0))}`,
      `Role: ${bold(user.role)}`,
      `Banido: ${user.banned ? '🔴 Sim' : '🟢 Não'}`,
      `Último acesso: ${formatDate(user.telegram_last_seen)}`,
      `Registrado: ${formatDate(user.createdAt)}`,
    ].join('\n'), {
      parse_mode: 'HTML',
      ...MenuBuilder.backButton('admin:users'),
    });
  }

  async addBalance(chatId, targetId, amount) {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum === 0) {
      return this.bot.sendMessage(chatId, '❌ Valor inválido.');
    }

    const user = await User.findOneAndUpdate(
      { bot_id: this.botDoc.id, $or: [
        { telegram_id: String(targetId) },
        { _id: mongoose.isValidObjectId(targetId) ? targetId : null },
      ] },
      { $inc: { balance: mongoose.Types.Decimal128.fromString(amountNum.toFixed(2)) } },
      { new: true }
    );

    if (!user) {
      return this.bot.sendMessage(chatId, '❌ Usuário não encontrado.');
    }

    const action = amountNum > 0 ? 'adicionado a' : 'removido de';
    return this.bot.sendMessage(chatId, [
      `✅ ${currency(Math.abs(amountNum))} ${action} ${bold(user.username)}`,
      `Novo saldo: ${bold(currency(parseFloat(user.balance?.toString() || '0')))}`,
    ].join('\n'), { parse_mode: 'HTML' });
  }

  async banUser(chatId, targetId, ban = true) {
    const user = await User.findOneAndUpdate(
      { bot_id: this.botDoc.id, $or: [
        { telegram_id: String(targetId) },
        { _id: mongoose.isValidObjectId(targetId) ? targetId : null },
      ] },
      { $set: { banned: ban } },
      { new: true }
    );

    if (!user) {
      return this.bot.sendMessage(chatId, '❌ Usuário não encontrado.');
    }

    const status = ban ? '🔴 banido' : '🟢 desbanido';
    return this.bot.sendMessage(chatId, `✅ ${bold(user.username)} foi ${status}.`, { parse_mode: 'HTML' });
  }
}

module.exports = AdminCommands;
