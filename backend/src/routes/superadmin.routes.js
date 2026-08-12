'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/roleAuth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { sanitizeInputs } = require('../middleware/sanitize');
const { Bot, User, Card, Order, Recharge, Activity } = require('../../database/schemas');

router.use(authenticate, requireSuperAdmin, adminLimiter);

// ─── BOTS ───

router.get('/bots', async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const query = {};
    if (status) query.status = status;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [bots, total] = await Promise.all([
      Bot.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Bot.countDocuments(query),
    ]);

    const botManager = req.app.get('botManager');
    const result = bots.map((b) => ({
      ...b,
      runtime: botManager ? botManager.getBotStatus(String(b._id)) : { status: 'unknown' },
    }));

    res.json({ bots: result, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/bots', sanitizeInputs, async (req, res) => {
  try {
    const { bot_token, bot_name, owner_id } = req.body;
    if (!bot_token || !owner_id) return res.status(400).json({ message: 'bot_token e owner_id obrigatórios' });

    const telegramService = require('../services/telegram.service');
    const info = await telegramService.getBotInfo(bot_token);

    const bot = await Bot.create({
      owner_id, bot_token,
      bot_name: bot_name || info.firstName,
      bot_username: info.username,
      store_name: bot_name || info.firstName,
      status: 'active',
    });

    const botManager = req.app.get('botManager');
    if (botManager) await botManager.startBot(String(bot._id));

    res.status(201).json({ bot: { ...bot.toObject(), bot_token: undefined } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.put('/bots/:botId', sanitizeInputs, async (req, res) => {
  try {
    const bot = await Bot.findById(req.params.botId);
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const allowed = ['bot_name', 'store_name', 'status', 'owner_id'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) bot[key] = req.body[key];
    }
    await bot.save();
    res.json({ bot: { ...bot.toObject(), bot_token: undefined } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/bots/:botId', async (req, res) => {
  try {
    const botManager = req.app.get('botManager');
    if (botManager) {
      try { await botManager.stopBot(req.params.botId); } catch { /* ignore */ }
    }
    await Bot.findByIdAndUpdate(req.params.botId, { status: 'deleted' });
    res.json({ message: 'Bot removido' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── OWNERS ───

router.get('/owners', async (req, res) => {
  try {
    const owners = await User.find({ role: { $in: ['admin', 'superadmin'] } })
      .select('-password').sort({ createdAt: -1 }).lean();
    res.json({ owners });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/owners', sanitizeInputs, async (req, res) => {
  try {
    const { username, password, role = 'admin' } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'username e password obrigatórios' });

    const user = await User.create({ username, password, role });
    res.status(201).json({ owner: { ...user.toObject(), password: undefined } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Username já existe' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/owners/:ownerId', sanitizeInputs, async (req, res) => {
  try {
    const user = await User.findById(req.params.ownerId);
    if (!user) return res.status(404).json({ message: 'Owner não encontrado' });

    if (req.body.role) user.role = req.body.role;
    if (req.body.banned !== undefined) user.banned = req.body.banned;
    await user.save();
    res.json({ owner: { ...user.toObject(), password: undefined } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/owners/:ownerId', async (req, res) => {
  try {
    if (String(req.params.ownerId) === String(req.user.id)) {
      return res.status(400).json({ message: 'Não é possível remover a si mesmo' });
    }
    await User.findByIdAndDelete(req.params.ownerId);
    res.json({ message: 'Owner removido' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── SYSTEM ───

router.get('/system-stats', async (req, res) => {
  try {
    const [totalBots, totalUsers, totalCards, totalOrders] = await Promise.all([
      Bot.countDocuments({ status: 'active' }),
      User.countDocuments(),
      Card.countDocuments(),
      Order.countDocuments(),
    ]);

    const botManager = req.app.get('botManager');

    res.json({
      totalBots,
      totalUsers,
      totalCards,
      totalOrders,
      runningBots: botManager ? botManager.getRunningCount() : 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/maintenance', sanitizeInputs, async (req, res) => {
  try {
    const { action } = req.body;
    if (action === 'restart-all-bots') {
      const botManager = req.app.get('botManager');
      if (botManager) {
        await botManager.shutdown();
        await botManager.startAll();
      }
      return res.json({ message: 'Todos os bots reiniciados' });
    }
    res.json({ message: `Ação '${action}' em desenvolvimento` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const { page = 1, limit = 100, type, userId } = req.query;
    const query = {};
    if (type) query.type = type;
    if (userId) query.user_id = userId;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(200, parseInt(limit, 10));
    const lim = Math.min(200, parseInt(limit, 10));

    const [logs, total] = await Promise.all([
      Activity.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Activity.countDocuments(query),
    ]);

    res.json({ logs, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
