'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { sanitizeInputs } = require('../../middleware/sanitize');
const { Bot, User, Order, Recharge, GiftCard, Exchange, Referral } = require('../../../database/schemas');
const { createUploadMiddleware, processImage } = require('../../middleware/uploadHandler');
const config = require('../../config');
const telegramService = require('../../services/telegram.service');
const broadcastService = require('../../services/broadcast.service');
const rechargeService = require('../../services/recharge.service');

// ─── BOTS ───

router.get('/bots', async (req, res) => {
  try {
    const bots = await Bot.find({ owner_id: req.user.id }).lean();
    const botManager = req.app.get('botManager');

    const result = bots.map((b) => ({
      ...b,
      runtime: botManager ? botManager.getBotStatus(String(b._id)) : { status: 'unknown' },
    }));

    res.json({ bots: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.post('/bots', sanitizeInputs, async (req, res) => {
  try {
    const { bot_token, bot_name, store_name } = req.body;
    if (!bot_token) return res.status(400).json({ message: 'bot_token é obrigatório' });

    const info = await telegramService.getBotInfo(bot_token);

    const existing = await Bot.findOne({ username: info.username });
    if (existing) return res.status(409).json({ message: 'Bot já cadastrado' });

    const bot = await Bot.create({
      owner_id: req.user.id,
      tenant_id: req.user.id,
      name: bot_name || info.firstName,
      username: info.username,
      bot_token,
      store_name: store_name || bot_name || info.firstName,
      status: 'active',
    });

    const botManager = req.app.get('botManager');
    if (botManager) {
      await botManager.startBot(String(bot._id));
    }

    res.status(201).json({ bot: { ...bot.toObject(), bot_token: undefined } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.put('/bots/:botId', sanitizeInputs, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, owner_id: req.user.id });
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const allowed = [
      'bot_name', 'store_name', 'welcome_message', 'help_message', 'terms_message',
      'store_color', 'start_image_url', 'disable_purchases', 'disable_pix',
      'referral_enabled', 'required_channel', 'require_subscription', 'status',
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) bot[key] = req.body[key];
    }

    await bot.save();
    res.json({ bot: { ...bot.toObject(), bot_token: undefined } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.delete('/bots/:botId', async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, owner_id: req.user.id });
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const botManager = req.app.get('botManager');
    if (botManager) {
      try { await botManager.stopBot(String(bot._id)); } catch { /* ignore */ }
    }

    await Bot.findByIdAndUpdate(bot._id, { status: 'deleted' });
    res.json({ message: 'Bot removido' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.post('/bots/:botId/restart', async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, owner_id: req.user.id });
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const botManager = req.app.get('botManager');
    if (!botManager) return res.status(503).json({ message: 'BotManager não disponível' });

    await botManager.restartBot(String(bot._id));
    res.json({ message: 'Bot reiniciado', status: botManager.getBotStatus(String(bot._id)) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── SETTINGS ───

router.get('/settings', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    res.json({
      settings: {
        welcome_message: bot.welcome_message,
        help_message: bot.help_message,
        terms_message: bot.terms_message,
        store_name: bot.store_name,
        store_color: bot.store_color,
        start_image_url: bot.start_image_url,
        disable_purchases: bot.disable_purchases,
        disable_pix: bot.disable_pix,
        referral_enabled: bot.referral_enabled,
        required_channel: bot.required_channel,
        require_subscription: bot.require_subscription,
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.put('/settings', sanitizeInputs, async (req, res) => {
  try {
    const { botId, ...updates } = req.body;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id });
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const allowed = [
      'welcome_message', 'help_message', 'terms_message', 'store_name',
      'store_color', 'start_image_url', 'disable_purchases', 'disable_pix',
      'referral_enabled', 'required_channel', 'require_subscription',
    ];

    for (const key of allowed) {
      if (updates[key] !== undefined) bot[key] = updates[key];
    }

    await bot.save();
    res.json({ message: 'Configurações atualizadas' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── USERS ───

router.get('/users', async (req, res) => {
  try {
    const { botId, search, page, limit, activeOnly } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const result = await telegramService.getUsers(botId, { search, page, limit, activeOnly: activeOnly === 'true' });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.get('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).lean();
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    const bot = await Bot.findOne({ _id: user.bot_id, owner_id: req.user.id }).lean();
    if (!bot) return res.status(403).json({ message: 'Acesso negado' });

    res.json({ user });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.put('/users/:userId', sanitizeInputs, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    const bot = await Bot.findOne({ _id: user.bot_id, owner_id: req.user.id }).lean();
    if (!bot) return res.status(403).json({ message: 'Acesso negado' });

    const allowed = ['banned', 'role', 'balance'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'balance') {
          user[key] = mongoose.Types.Decimal128.fromString(String(req.body[key]));
        } else {
          user[key] = req.body[key];
        }
      }
    }

    await user.save();
    res.json({ user });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── ORDERS ───

router.get('/orders', async (req, res) => {
  try {
    const { botId, page = 1, limit = 50, status } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const query = { bot_id: new mongoose.Types.ObjectId(botId) };
    if (status) query.status = status;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Order.countDocuments(query),
    ]);

    res.json({ orders, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.get('/orders/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).lean();
    if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });

    const bot = await Bot.findOne({ _id: order.bot_id, owner_id: req.user.id }).lean();
    if (!bot) return res.status(403).json({ message: 'Acesso negado' });

    res.json({ order });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── RECHARGES ───

router.get('/recharges', async (req, res) => {
  try {
    const { botId, page = 1, limit = 50, status } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const query = { bot_id: new mongoose.Types.ObjectId(botId) };
    if (status) query.status = status;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [recharges, total] = await Promise.all([
      Recharge.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Recharge.countDocuments(query),
    ]);

    res.json({ recharges, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.post('/recharges/:rechargeId/approve', async (req, res) => {
  try {
    const recharge = await Recharge.findById(req.params.rechargeId);
    if (!recharge) return res.status(404).json({ message: 'Recarga não encontrada' });

    const bot = await Bot.findOne({ _id: recharge.bot_id, owner_id: req.user.id }).lean();
    if (!bot) return res.status(403).json({ message: 'Acesso negado' });

    const result = await rechargeService.processManualRecharge(req.params.rechargeId, req.user.id);

    const io = req.app.get('io');
    if (io) io.to(`bot:${recharge.bot_id}`).emit('recharge:approved', { rechargeId: result._id });

    res.json({ message: 'Recarga aprovada', recharge: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── EXCHANGES ───

router.get('/exchanges', async (req, res) => {
  try {
    const { botId, page = 1, limit = 50, status } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const query = { bot_id: new mongoose.Types.ObjectId(botId) };
    if (status) query.status = status;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [exchanges, total] = await Promise.all([
      Exchange.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Exchange.countDocuments(query),
    ]);

    res.json({ exchanges, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.put('/exchanges/:exchangeId', sanitizeInputs, async (req, res) => {
  try {
    const exchange = await Exchange.findById(req.params.exchangeId);
    if (!exchange) return res.status(404).json({ message: 'Troca não encontrada' });

    const bot = await Bot.findOne({ _id: exchange.bot_id, owner_id: req.user.id }).lean();
    if (!bot) return res.status(403).json({ message: 'Acesso negado' });

    const { status, reason } = req.body;
    if (!status) return res.status(400).json({ message: 'status é obrigatório' });

    const validStatuses = ['approved', 'rejected', 'refunded', 'replaced'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status inválido. Use: ${validStatuses.join(', ')}` });
    }

    exchange.status = status;
    if (reason !== undefined) exchange.reason = reason;
    exchange.processed_by = req.user.id;
    exchange.processed_at = new Date();

    // Se aprovado com reembolso, creditar saldo ao usuário
    if (status === 'approved' && exchange.refund_amount) {
      const refundAmt = parseFloat(exchange.refund_amount.toString());
      if (refundAmt > 0) {
        const tgUser = await User.findById(exchange.userId);
        if (tgUser) {
          const currentBalance = parseFloat((tgUser.balance || '0').toString());
          tgUser.balance = mongoose.Types.Decimal128.fromString(
            String((currentBalance + refundAmt).toFixed(2))
          );
          await tgUser.save();
        }
      }
    }

    await exchange.save();
    res.json({ message: 'Troca atualizada', exchange });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── REFERENCES ───

router.get('/references', async (req, res) => {
  try {
    const { botId, page = 1, limit = 50 } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [references, total] = await Promise.all([
      Referral.find({ bot_id: new mongoose.Types.ObjectId(botId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      Referral.countDocuments({ bot_id: new mongoose.Types.ObjectId(botId) }),
    ]);

    res.json({ references, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.get('/references/:refId', async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.refId).lean();
    if (!referral) return res.status(404).json({ message: 'Referral não encontrado' });

    const bot = await Bot.findOne({ _id: referral.bot_id, owner_id: req.user.id }).lean();
    if (!bot) return res.status(403).json({ message: 'Acesso negado' });

    res.json({ referral });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.put('/references/:refId', sanitizeInputs, async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.refId);
    if (!referral) return res.status(404).json({ message: 'Referral não encontrado' });

    const bot = await Bot.findOne({ _id: referral.bot_id, owner_id: req.user.id }).lean();
    if (!bot) return res.status(403).json({ message: 'Acesso negado' });

    const { status } = req.body;
    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido. Use: active, inactive' });
      }
      referral.status = status;
    }

    await referral.save();
    res.json({ message: 'Referral atualizado', referral });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── GIFT CARDS ───

router.get('/gift-cards', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const giftCards = await GiftCard.find({ bot_id: botId }).sort({ createdAt: -1 }).lean();
    res.json({ giftCards });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.post('/gift-cards', sanitizeInputs, async (req, res) => {
  try {
    const { botId, code, value, quantity = 1 } = req.body;
    if (!botId || !value) return res.status(400).json({ message: 'botId e value são obrigatórios' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const crypto = require('crypto');
    const cards = [];
    for (let i = 0; i < Math.min(quantity, 100); i++) {
      cards.push({
        bot_id: botId,
        owner_id: req.user.id,
        code: code || crypto.randomBytes(8).toString('hex').toUpperCase(),
        value: parseFloat(value),
        status: 'active',
      });
    }

    const created = await GiftCard.insertMany(cards);
    res.status(201).json({ giftCards: created });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.delete('/gift-cards/:giftCardId', async (req, res) => {
  try {
    const gc = await GiftCard.findById(req.params.giftCardId);
    if (!gc) return res.status(404).json({ message: 'Gift card não encontrado' });

    const bot = await Bot.findOne({ _id: gc.bot_id, owner_id: req.user.id }).lean();
    if (!bot) return res.status(403).json({ message: 'Acesso negado' });

    await GiftCard.findByIdAndDelete(gc._id);
    res.json({ message: 'Gift card removido' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── BROADCAST ───

router.post('/broadcast', sanitizeInputs, async (req, res) => {
  try {
    const { botId, message, filters, imageUrl } = req.body;
    if (!botId || !message) return res.status(400).json({ message: 'botId e message são obrigatórios' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const result = await broadcastService.createBroadcast(botId, message, filters || {}, imageUrl || null);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.get('/broadcast/history', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const history = await broadcastService.getBroadcastHistory(botId);
    res.json({ broadcasts: history });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── AFFILIATES ───

router.get('/affiliates', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    res.json({
      bonus_percentage: bot.referral_bonus_percentage ?? 5,
      enabled: bot.referral_enabled ?? false,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.get('/affiliates/config', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    res.json({
      bonus_percentage: bot.referral_bonus_percentage ?? 5,
      enabled: bot.referral_enabled ?? false,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.put('/affiliates/config', sanitizeInputs, async (req, res) => {
  try {
    const { botId, referral_bonus_percentage, referral_enabled } = req.body;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id });
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    if (referral_bonus_percentage !== undefined) {
      const pct = parseFloat(referral_bonus_percentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ message: 'referral_bonus_percentage deve ser entre 0 e 100' });
      }
      bot.referral_bonus_percentage = pct;
    }
    if (referral_enabled !== undefined) bot.referral_enabled = Boolean(referral_enabled);

    await bot.save();
    res.json({
      message: 'Configuração de afiliados atualizada',
      bonus_percentage: bot.referral_bonus_percentage,
      enabled: bot.referral_enabled,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.get('/affiliates/users', async (req, res) => {
  try {
    const { botId, page = 1, limit = 50 } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const lim = Math.min(100, parseInt(limit, 10));
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * lim;

    const agg = await Referral.aggregate([
      { $match: { bot_id: new mongoose.Types.ObjectId(botId) } },
      {
        $group: {
          _id: '$referrer_id',
          referral_count: { $sum: 1 },
          total_earnings: { $sum: { $toDouble: '$total_earnings' } },
        },
      },
      { $sort: { referral_count: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: lim }],
          count: [{ $count: 'total' }],
        },
      },
    ]);

    const users = agg[0]?.data || [];
    const total = agg[0]?.count[0]?.total || 0;

    res.json({ users, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.get('/affiliates/recent-earnings', async (req, res) => {
  try {
    const { botId, limit = 20 } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const lim = Math.min(100, parseInt(limit, 10));

    const earnings = await Referral.find({
      bot_id: new mongoose.Types.ObjectId(botId),
      total_earnings: { $gt: 0 },
    })
      .sort({ updatedAt: -1 })
      .limit(lim)
      .lean();

    res.json({ earnings });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── START IMAGE ───

router.post('/start-image', createUploadMiddleware('image', 1), processImage, async (req, res) => {
  try {
    const { botId } = req.body;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id });
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    if (!req.processedFile) return res.status(400).json({ message: 'Nenhum arquivo enviado' });

    // Remove arquivo anterior se existir e for local
    if (bot.start_image_url) {
      const oldFilename = path.basename(bot.start_image_url);
      const oldPath = path.join(config.uploadDir || './uploads', oldFilename);
      fs.unlink(oldPath, () => { /* ignore errors */ });
    }

    const imageUrl = `/uploads/${req.processedFile.filename}`;
    bot.start_image_url = imageUrl;
    await bot.save();

    res.json({ message: 'Imagem de início atualizada', start_image_url: imageUrl });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.delete('/start-image', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id });
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    if (bot.start_image_url) {
      const oldFilename = path.basename(bot.start_image_url);
      const oldPath = path.join(config.uploadDir || './uploads', oldFilename);
      fs.unlink(oldPath, () => { /* ignore errors */ });
    }

    bot.start_image_url = null;
    await bot.save();

    res.json({ message: 'Imagem de início removida' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.get('/start-image-proxy', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    if (!bot.start_image_url) return res.status(404).json({ message: 'Imagem não configurada' });

    const filename = path.basename(bot.start_image_url);
    const filePath = path.join(config.uploadDir || './uploads', filename);

    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Arquivo não encontrado' });

    const ext = path.extname(filename).toLowerCase();
    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
    const contentType = mimeMap[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── GIFT CARDS BULK ───

router.post('/gift-cards/bulk', sanitizeInputs, async (req, res) => {
  try {
    const { botId, value, quantity = 1, prefix } = req.body;
    if (!botId || !value) return res.status(400).json({ message: 'botId e value são obrigatórios' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const qty = Math.min(100, Math.max(1, parseInt(quantity, 10)));
    const cards = [];

    for (let i = 0; i < qty; i++) {
      const baseCode = GiftCard.generateCode();
      const code = prefix ? `${prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${baseCode}` : baseCode;
      cards.push({
        bot_id: botId,
        owner_id: req.user.id,
        created_by: req.user.id,
        code,
        value: parseFloat(value),
        status: 'active',
      });
    }

    const created = await GiftCard.insertMany(cards, { ordered: false });
    res.status(201).json({ giftCards: created, count: created.length });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── USERS DELTA / BULK DELETE ───

router.get('/users/delta', async (req, res) => {
  try {
    const { botId, since } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });
    if (!since) return res.status(400).json({ message: 'since é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) return res.status(400).json({ message: 'Parâmetro since inválido' });

    const users = await User.find({
      bot_id: new mongoose.Types.ObjectId(botId),
      createdAt: { $gt: sinceDate },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ users, count: users.length, since: sinceDate });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.delete('/users/all', async (req, res) => {
  try {
    const { botId, confirm } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });
    if (confirm !== 'true') {
      return res.status(400).json({ message: 'Confirmação obrigatória. Passe confirm=true para confirmar.' });
    }

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const result = await User.deleteMany({ bot_id: new mongoose.Types.ObjectId(botId) });
    res.json({ message: 'Usuários removidos', deleted: result.deletedCount });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── CUSTOM EMOJIS ───

router.get('/custom-emojis', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const customEmojis = bot.metadata?.custom_emojis || {};
    res.json({ custom_emojis: customEmojis });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.put('/custom-emojis', sanitizeInputs, async (req, res) => {
  try {
    const { botId, custom_emojis } = req.body;
    if (!botId) return res.status(400).json({ message: 'botId é obrigatório' });
    if (!custom_emojis || typeof custom_emojis !== 'object') {
      return res.status(400).json({ message: 'custom_emojis deve ser um objeto' });
    }

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id });
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    bot.metadata = { ...(bot.metadata || {}), custom_emojis };
    bot.markModified('metadata');
    await bot.save();

    res.json({ message: 'Emojis personalizados atualizados', custom_emojis: bot.metadata.custom_emojis });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

module.exports = router;
