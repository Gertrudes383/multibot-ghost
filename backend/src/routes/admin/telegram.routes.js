'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { sanitizeInputs } = require('../../middleware/sanitize');
const { Bot, User, Order, Recharge, GiftCard } = require('../../../database/schemas');
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

    const existing = await Bot.findOne({ bot_username: info.username });
    if (existing) return res.status(409).json({ message: 'Bot já cadastrado' });

    const bot = await Bot.create({
      owner_id: req.user.id,
      bot_token,
      bot_name: bot_name || info.firstName,
      bot_username: info.username,
      store_name: store_name || info.firstName,
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
  res.json({ exchanges: [], message: 'Módulo de trocas em desenvolvimento' });
});

router.put('/exchanges/:exchangeId', async (req, res) => {
  res.status(501).json({ message: 'Módulo de trocas em desenvolvimento' });
});

// ─── REFERENCES ───

router.get('/references', async (req, res) => {
  res.json({ references: [], message: 'Módulo de referências em desenvolvimento' });
});

router.get('/references/:refId', async (req, res) => {
  res.status(501).json({ message: 'Módulo de referências em desenvolvimento' });
});

router.put('/references/:refId', async (req, res) => {
  res.status(501).json({ message: 'Módulo de referências em desenvolvimento' });
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
    const { botId, message, filters } = req.body;
    if (!botId || !message) return res.status(400).json({ message: 'botId e message são obrigatórios' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const result = await broadcastService.createBroadcast(botId, message, filters || {});
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
  res.json({ affiliates: [], message: 'Módulo de afiliados em desenvolvimento' });
});

router.get('/affiliates/:affiliateId', async (req, res) => {
  res.status(501).json({ message: 'Módulo de afiliados em desenvolvimento' });
});

router.put('/affiliates/:affiliateId', async (req, res) => {
  res.status(501).json({ message: 'Módulo de afiliados em desenvolvimento' });
});

module.exports = router;
