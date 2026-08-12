'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { User, Order, Activity } = require('../../../database/schemas');
const { sanitizeInputs } = require('../../middleware/sanitize');

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, role, banned, botId } = req.query;
    const query = { owner_id: req.user.id };
    if (botId) query.bot_id = botId;
    if (role) query.role = role;
    if (banned === 'true') query.banned = true;
    if (banned === 'false') query.banned = { $ne: true };
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { telegram_username: { $regex: search, $options: 'i' } },
        { telegram_id: search },
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      User.countDocuments(query),
    ]);

    res.json({ users, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, owner_id: req.user.id }).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', sanitizeInputs, async (req, res) => {
  try {
    const { username, password, role = 'user', botId } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'username e password obrigatórios' });

    const user = await User.create({
      username, password, role,
      owner_id: req.user.id,
      bot_id: botId || null,
    });

    res.status(201).json({ user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Username já existe' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:userId', sanitizeInputs, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, owner_id: req.user.id });
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    const allowed = ['role', 'banned'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) user[key] = req.body[key];
    }
    await user.save();
    res.json({ user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:userId', async (req, res) => {
  try {
    const result = await User.findOneAndDelete({ _id: req.params.userId, owner_id: req.user.id });
    if (!result) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json({ message: 'Usuário removido' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:userId/ban', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.userId, owner_id: req.user.id },
      { banned: true }, { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    Activity.log({
      userId: req.user.id, username: 'admin', type: 'user_ban',
      details: { targetUserId: user._id, targetUsername: user.username },
      ownerId: req.user.id,
    }).catch(() => {});

    res.json({ message: 'Usuário banido', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:userId/unban', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.userId, owner_id: req.user.id },
      { banned: false }, { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

    Activity.log({
      userId: req.user.id, username: 'admin', type: 'user_unban',
      details: { targetUserId: user._id },
      ownerId: req.user.id,
    }).catch(() => {});

    res.json({ message: 'Usuário desbanido', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:userId/balance', sanitizeInputs, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const amountNum = parseFloat(amount);
    if (!amountNum) return res.status(400).json({ message: 'Valor inválido' });

    const user = await User.findOneAndUpdate(
      { _id: req.params.userId, owner_id: req.user.id },
      { $inc: { balance: mongoose.Types.Decimal128.fromString(amountNum.toFixed(2)) } },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json({ user, newBalance: parseFloat(user.balance?.toString() || '0') });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:userId/transactions', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const activities = await Activity.find({ user_id: req.params.userId })
      .sort({ createdAt: -1 }).skip(skip).limit(lim).lean();
    res.json({ transactions: activities });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:userId/purchases', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [orders, total] = await Promise.all([
      Order.find({ user_id: req.params.userId }).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Order.countDocuments({ user_id: req.params.userId }),
    ]);
    res.json({ purchases: orders, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── ACTIVITIES ───

router.get('/activities', async (req, res) => {
  try {
    const { page = 1, limit = 50, type, userId, startDate, endDate, botId } = req.query;
    const lim = Math.min(100, parseInt(limit, 10));
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * lim;

    const query = { owner_id: req.user.id };
    if (type) query.type = type;
    if (userId) query.user_id = userId;
    if (botId) query.bot_id = botId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [activities, total] = await Promise.all([
      Activity.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Activity.countDocuments(query),
    ]);

    res.json({ activities, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── TOP USERS ───

router.get('/top', async (req, res) => {
  try {
    const { sortBy = 'purchaseCount', botId } = req.query;
    const ownerId = new mongoose.Types.ObjectId(req.user.id);

    const matchStage = { owner_id: ownerId };
    if (botId) matchStage.bot_id = new mongoose.Types.ObjectId(botId);

    let sortField;
    if (sortBy === 'balance') {
      // Sort by balance field on User documents directly
      const query = { owner_id: req.user.id };
      if (botId) query.bot_id = botId;

      const users = await User.find(query)
        .select('-password')
        .sort({ balance: -1 })
        .limit(20)
        .lean();

      return res.json({ users, sortBy });
    }

    // Default: sort by purchase count via Order aggregation
    const topByPurchases = await Order.aggregate([
      { $match: { owner_id: ownerId, status: 'completed' } },
      {
        $group: {
          _id: '$user_id',
          purchaseCount: { $sum: 1 },
          totalSpent: { $sum: '$price' },
        },
      },
      { $sort: { purchaseCount: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmpty: false } },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          purchaseCount: 1,
          totalSpent: 1,
          username: '$user.username',
          telegram_username: '$user.telegram_username',
          telegram_id: '$user.telegram_id',
        },
      },
    ]);

    res.json({ users: topByPurchases, sortBy });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
