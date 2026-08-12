'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/auth');
const { requireAssistant } = require('../middleware/roleAuth');
const { generalLimiter } = require('../middleware/rateLimiter');
const { sanitizeInputs } = require('../middleware/sanitize');
const { User, Order, Recharge, Activity } = require('../../database/schemas');
const rechargeService = require('../services/recharge.service');

router.use(authenticate, requireAssistant, generalLimiter);

router.get('/dashboard', async (req, res) => {
  try {
    const { botId } = req.query;
    const query = botId ? { bot_id: botId } : {};

    const [totalUsers, pendingRecharges, recentOrders] = await Promise.all([
      User.countDocuments(query),
      Recharge.countDocuments({ ...query, status: 'pending' }),
      Order.countDocuments({ ...query, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    ]);

    res.json({ totalUsers, pendingRecharges, recentOrders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, botId } = req.query;
    const query = {};
    if (botId) query.bot_id = botId;
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

router.get('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const { page = 1, limit = 50, botId, status } = req.query;
    const query = {};
    if (botId) query.bot_id = new mongoose.Types.ObjectId(botId);
    if (status) query.status = status;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Order.countDocuments(query),
    ]);

    res.json({ orders, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/orders/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).lean();
    if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/orders/:orderId/refund', sanitizeInputs, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });
    if (order.status === 'refunded') return res.status(400).json({ message: 'Pedido já reembolsado' });

    const price = parseFloat(order.price?.toString() || '0');
    await User.findByIdAndUpdate(order.user_id, {
      $inc: { balance: mongoose.Types.Decimal128.fromString(price.toFixed(2)) },
    });

    order.status = 'refunded';
    await order.save();

    Activity.log({
      userId: req.user.id, username: 'assistant', type: 'refund',
      amount: price, details: { orderId: order._id },
    }).catch(() => {});

    res.json({ message: 'Reembolso processado', order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/recharges', async (req, res) => {
  try {
    const { page = 1, limit = 50, botId, status } = req.query;
    const query = {};
    if (botId) query.bot_id = new mongoose.Types.ObjectId(botId);
    if (status) query.status = status;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [recharges, total] = await Promise.all([
      Recharge.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Recharge.countDocuments(query),
    ]);

    res.json({ recharges, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/recharges/:rechargeId/approve', async (req, res) => {
  try {
    const result = await rechargeService.processManualRecharge(req.params.rechargeId, req.user.id);
    res.json({ message: 'Recarga aprovada', recharge: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

module.exports = router;
