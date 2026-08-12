'use strict';

/**
 * AdminCommands V3 — Comandos administrativos do bot.
 *
 * Porta do V2 Python (panel.py, report.py, broadcast.py, reembolsar.py, search_users.py):
 * - Painel admin completo
 * - Relatórios por período
 * - Broadcast com rate limiter
 * - Reembolso de cards
 * - Busca e gerenciamento de usuários
 * - Adição de saldo manual
 * - Ban/Unban
 */

const mongoose = require('mongoose');
const { User, Card, Order, Recharge, Bot, GiftCard } = require('../../database/schemas');
const MenuBuilder = require('./MenuBuilder');
const {
  bold, currency, code, separator, statusEmoji,
  formatDate, formatUptime,
} = require('./utils/messageFormatter');
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

  // ─── REPORT ───
  async getReport(chatId, days = 0) {
    const botOid = new mongoose.Types.ObjectId(this.botDoc._id);
    const startDate = new Date();

    if (days === 0) {
      // Desde meia-noite
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(startDate.getDate() - days);
    }

    const [salesAgg, rechargesAgg, newUsers] = await Promise.all([
      Order.aggregate([
        { $match: { bot_id: botOid, status: 'completed', createdAt: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: '$price' }, count: { $sum: 1 } } },
      ]),
      Recharge.aggregate([
        { $match: { bot_id: botOid, status: 'completed', createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$method',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      User.countDocuments({ bot_id: this.botDoc.id, createdAt: { $gte: startDate } }),
    ]);

    const sales = salesAgg[0] || { total: 0, count: 0 };
    const periodLabel = days === 0 ? 'Hoje' : `Últimos ${days} dias`;

    const lines = [
      `${bold(`📋 Relatório — ${periodLabel}`)}`,
      separator(),
      ``,
      `${bold('🛒 Vendas')}`,
      `Quantidade: ${bold(String(sales.count))}`,
      `Faturamento: ${bold(currency(sales.total))}`,
      ``,
      `${bold('💰 Recargas')}`,
    ];

    for (const r of rechargesAgg) {
      lines.push(`${r._id}: ${bold(String(r.count))} — ${bold(currency(r.total))}`);
    }
    if (rechargesAgg.length === 0) {
      lines.push(`Nenhuma recarga no período`);
    }

    lines.push(``);
    lines.push(`${bold('👥 Novos Usuários')}: ${bold(String(newUsers))}`);

    return this.bot.sendMessage(chatId, lines.join('\n'), {
      parse_mode: 'HTML',
      ...MenuBuilder.adminReportPeriodMenu(),
    });
  }

  // ─── STATS ───
  async getStats(chatId) {
    const botId = this.botDoc.id;
    const botOid = new mongoose.Types.ObjectId(this.botDoc._id);

    const [totalUsers, totalOrders, totalCards, salesAgg, rechargesAgg] = await Promise.all([
      User.countDocuments({ bot_id: botId }),
      Order.countDocuments({ bot_id: botOid }),
      Card.countDocuments({ bot_id: botOid, status: 'available' }),
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
    ].join('\n'), {
      parse_mode: 'HTML',
      ...MenuBuilder.backButton('admin:main'),
    });
  }

  // ─── USER MANAGEMENT ───
  async getUserInfo(chatId, targetId) {
    const user = await User.findOne({
      bot_id: this.botDoc.id,
      $or: [
        { telegram_id: String(targetId) },
        { _id: mongoose.isValidObjectId(targetId) ? targetId : null },
        { username: targetId },
      ],
    }).lean();

    if (!user) {
      return this.bot.sendMessage(chatId, '❌ Usuário não encontrado.');
    }

    const balance = parseFloat(user.balance?.toString() || '0');
    const spent = parseFloat(user.totalSpent?.toString() || '0');

    return this.bot.sendMessage(chatId, [
      `${bold('👤 Info do Usuário')}`,
      separator(),
      `ID: ${code(String(user._id))}`,
      `Telegram: ${user.telegram_id || '—'}`,
      `Username: ${user.telegram_username ? `@${user.telegram_username}` : '—'}`,
      `Saldo: ${bold(currency(balance))}`,
      `Total gasto: ${bold(currency(spent))}`,
      `Compras: ${bold(String(user.purchaseCount || 0))}`,
      `Role: ${bold(user.role)}`,
      `Banido: ${user.banned ? '🔴 Sim' : '🟢 Não'}`,
      `Último acesso: ${formatDate(user.telegram_last_seen)}`,
      `Registrado: ${formatDate(user.createdAt)}`,
    ].join('\n'), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💰 Zerar Saldo', callback_data: `admin:zero_balance:${user._id}` },
            { text: user.banned ? '🔓 Desbanir' : '🔴 Banir', callback_data: `admin:toggle_ban:${user._id}` },
          ],
          [
            { text: '📜 Histórico', callback_data: `admin:user_history:${user._id}` },
          ],
          [{ text: '⬅️ Voltar', callback_data: 'admin:users' }],
        ],
      },
    });
  }

  async addBalance(chatId, targetId, amount) {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum === 0) {
      return this.bot.sendMessage(chatId, '❌ Valor inválido.');
    }

    const user = await User.findOneAndUpdate(
      {
        bot_id: this.botDoc.id,
        $or: [
          { telegram_id: String(targetId) },
          { _id: mongoose.isValidObjectId(targetId) ? targetId : null },
        ],
      },
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
      {
        bot_id: this.botDoc.id,
        $or: [
          { telegram_id: String(targetId) },
          { _id: mongoose.isValidObjectId(targetId) ? targetId : null },
        ],
      },
      { $set: { banned: ban } },
      { new: true }
    );

    if (!user) {
      return this.bot.sendMessage(chatId, '❌ Usuário não encontrado.');
    }

    const status = ban ? '🔴 banido' : '🟢 desbanido';
    return this.bot.sendMessage(chatId, `✅ ${bold(user.username)} foi ${status}.`, { parse_mode: 'HTML' });
  }

  // ─── REFUND ───
  async refundOrder(chatId, orderId) {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      return this.bot.sendMessage(chatId, '❌ Pedido não encontrado.');
    }

    if (order.refunded) {
      return this.bot.sendMessage(chatId, '❌ Pedido já foi reembolsado.');
    }

    const price = parseFloat(order.price?.toString() || '0');

    // Creditar saldo de volta
    await User.findByIdAndUpdate(order.userId, {
      $inc: {
        balance: mongoose.Types.Decimal128.fromString(price.toFixed(2)),
        totalSpent: mongoose.Types.Decimal128.fromString((-price).toFixed(2)),
        purchaseCount: -1,
      },
    });

    // Marcar pedido como reembolsado
    await Order.findByIdAndUpdate(orderId, {
      $set: { refunded: true, refunded_at: new Date() },
    });

    return this.bot.sendMessage(chatId, [
      `✅ ${bold('Reembolso Processado')}`,
      separator(),
      `Pedido: ${code(String(orderId))}`,
      `Valor: ${bold(currency(price))}`,
      `Saldo creditado ao usuário.`,
    ].join('\n'), { parse_mode: 'HTML' });
  }

  // ─── BROADCAST ───
  async broadcast(chatId, adminUser, text, options = {}) {
    if (!text) {
      return this.bot.sendMessage(chatId, '❌ Texto da mensagem não pode ser vazio.');
    }

    const query = { bot_id: this.botDoc.id, banned: false };
    if (options.onlyActive) {
      const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      query.telegram_last_seen = { $gte: cutoff };
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
    let blocked = 0;

    for (const u of users) {
      if (!u.telegram_id) {
        failed++;
        continue;
      }

      limiter.enqueue(async () => {
        try {
          await this.bot.sendMessage(u.telegram_id, text, { parse_mode: 'HTML' });
          sent++;
        } catch (err) {
          failed++;
          // Detectar bloqueio/conta deletada
          const errCode = err.response?.body?.error_code;
          if (errCode === 403 || errCode === 400) {
            blocked++;
          }
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
          blocked > 0 ? `Bloquearam: ${bold(String(blocked))}` : '',
        ].filter(Boolean).join('\n'), { parse_mode: 'HTML' });
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

  // ─── STOCK ───
  async getStockInfo(chatId) {
    const botOid = new mongoose.Types.ObjectId(this.botDoc._id);

    const stockAgg = await Card.aggregate([
      { $match: { bot_id: botOid } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const stock = {};
    for (const s of stockAgg) {
      stock[s._id] = s.count;
    }

    return this.bot.sendMessage(chatId, [
      `${bold('📦 Estoque')}`,
      separator(),
      `Disponíveis: ${bold(String(stock.available || 0))}`,
      `Vendidos: ${bold(String(stock.sold || 0))}`,
      `Mortos: ${bold(String(stock.dead || 0))}`,
      `Trancados: ${bold(String(stock.locked || 0))}`,
      ``,
      `Total: ${bold(String(Object.values(stock).reduce((a, b) => a + b, 0)))}`,
    ].join('\n'), {
      parse_mode: 'HTML',
      ...MenuBuilder.backButton('admin:main'),
    });
  }

  // ─── GIFT CARDS ───
  async createGiftCard(chatId, value) {
    const valueNum = parseFloat(value);
    if (!valueNum || valueNum <= 0) {
      return this.bot.sendMessage(chatId, '❌ Valor inválido.');
    }

    const giftCode = require('crypto').randomBytes(8).toString('hex').toUpperCase();

    await GiftCard.create({
      code: giftCode,
      value: mongoose.Types.Decimal128.fromString(valueNum.toFixed(2)),
      bot_id: new mongoose.Types.ObjectId(this.botDoc._id),
      owner_id: new mongoose.Types.ObjectId(this.botDoc.owner_id),
      created_by: new mongoose.Types.ObjectId(this.botDoc.owner_id),
      status: 'active',
    });

    return this.bot.sendMessage(chatId, [
      `${bold('🎁 Gift Card Criado')}`,
      separator(),
      `Código: ${code(giftCode)}`,
      `Valor: ${bold(currency(valueNum))}`,
    ].join('\n'), { parse_mode: 'HTML' });
  }
}

module.exports = AdminCommands;
