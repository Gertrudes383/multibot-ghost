'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/roleAuth');
const { adminLimiter, authLimiter } = require('../middleware/rateLimiter');
const { sanitizeInputs } = require('../middleware/sanitize');
const { Bot, User, Card, Order, Recharge, Activity, Subscription } = require('../../database/schemas');
const config = require('../config');

// ─── PUBLIC: SuperAdmin login (no authenticate middleware) ────────────────────

router.post('/login', authLimiter, sanitizeInputs, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'username e password sao obrigatorios' });
    }

    const user = await User.findOne({
      $or: [
        { username: username.toLowerCase(), is_super_admin: true },
        { username: username.toLowerCase(), role: 'super_admin' },
      ],
    }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenciais invalidas' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Credenciais invalidas' });
    }

    if (user.banned) {
      return res.status(403).json({ success: false, message: 'Conta bloqueada' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role || 'super_admin', is_super_admin: true, owner_id: null },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: config.jwtExpiresIn }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        is_super_admin: user.is_super_admin,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── All routes below require authentication + superadmin role ────────────────

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

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalTenants,
      totalBots,
      totalUsers,
      totalOrders,
      activeSubscriptions,
      recentActivity,
    ] = await Promise.all([
      User.countDocuments({ role: 'admin' }),
      Bot.countDocuments(),
      User.countDocuments(),
      Order.countDocuments(),
      Subscription.countDocuments({ status: 'active', expires_at: { $gt: new Date() } }),
      Activity.find().sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    // Total revenue from subscriptions
    const revenueAgg = await Subscription.aggregate([
      { $match: { status: { $in: ['active', 'expired'] } } },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: '$price' } },
        },
      },
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    const botManager = req.app.get('botManager');

    res.json({
      success: true,
      dashboard: {
        totalTenants,
        totalBots,
        totalUsers,
        totalOrders,
        activeSubscriptions,
        totalRevenue,
        runningBots: botManager ? botManager.getRunningCount() : 0,
        recentActivity,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

router.get('/payments', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, plan } = req.query;
    const query = {};
    if (status) query.status = status;
    if (plan) query.plan = plan;

    const pageNum = Math.max(1, parseInt(page, 10));
    const lim = Math.min(100, parseInt(limit, 10));
    const skip = (pageNum - 1) * lim;

    const [subscriptions, total] = await Promise.all([
      Subscription.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate('tenant_id', 'username telegram_username')
        .lean(),
      Subscription.countDocuments(query),
    ]);

    res.json({
      success: true,
      payments: subscriptions,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / lim),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SEARCH ───────────────────────────────────────────────────────────────────

router.get('/search', async (req, res) => {
  try {
    const { q, type } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Parametro de busca "q" deve ter ao menos 2 caracteres' });
    }

    const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const limit = 20;

    const results = {};

    if (!type || type === 'users') {
      results.users = await User.find({
        $or: [{ username: regex }, { telegram_username: regex }],
      })
        .select('-password')
        .limit(limit)
        .lean();
    }

    if (!type || type === 'bots') {
      results.bots = await Bot.find({
        $or: [{ bot_name: regex }, { bot_username: regex }, { store_name: regex }],
      })
        .select('-bot_token')
        .limit(limit)
        .lean();
    }

    if (!type || type === 'orders') {
      results.orders = await Order.find({
        $or: [{ _id: mongoose.isValidObjectId(q) ? q : undefined }, { status: regex }].filter(
          (c) => Object.values(c).every((v) => v !== undefined)
        ),
      })
        .limit(limit)
        .lean();
    }

    res.json({ success: true, query: q, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── CREATE SUPPORT USER ──────────────────────────────────────────────────────

router.post('/create-support-user', sanitizeInputs, async (req, res) => {
  try {
    const { ownerId, username, password } = req.body;

    if (!ownerId) {
      return res.status(400).json({ success: false, message: 'ownerId e obrigatorio' });
    }
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'username e password sao obrigatorios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Senha deve ter no minimo 6 caracteres' });
    }

    // Verify owner exists
    const owner = await User.findById(ownerId).select('_id username role');
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner nao encontrado' });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username ja esta em uso' });
    }

    const supportUser = await User.create({
      username: username.toLowerCase(),
      password,
      role: 'support',
      isAdmin: false,
      owner_id: ownerId,
    });

    res.status(201).json({
      success: true,
      message: 'Usuario de suporte criado',
      user: {
        id: supportUser._id,
        username: supportUser.username,
        role: supportUser.role,
        owner_id: supportUser.owner_id,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Username ja esta em uso' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── CHANGE OWN PASSWORD ──────────────────────────────────────────────────────

router.put('/me/password', sanitizeInputs, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'currentPassword e newPassword sao obrigatorios' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Nova senha deve ter no minimo 6 caracteres' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Senha atual incorreta' });
    }

    user.password = newPassword; // pre-save hook will hash it
    await user.save();

    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
