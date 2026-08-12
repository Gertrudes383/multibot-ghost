'use strict';

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { User, Order, Recharge } = require('../../database/schemas');

// ─── GET / — User dashboard overview ───────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user financial summary
    const user = await User.findById(userId)
      .select('balance purchaseCount totalSpent total_recharged username')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Recent purchases (last 5)
    const recentPurchases = await Order.find({ userId, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('card.bin card.brand card.country price createdAt purchase_type bot_name')
      .lean();

    // Recent recharges (last 5)
    const recentRecharges = await Recharge.find({ userId, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('amount method status createdAt completed_at')
      .lean();

    res.json({
      balance: user.balance || 0,
      purchaseCount: user.purchaseCount || 0,
      totalSpent: user.totalSpent || 0,
      total_recharged: user.total_recharged || 0,
      recentPurchases,
      recentRecharges,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /recent-purchases — Last 10 orders for this user ──────────────────

router.get('/recent-purchases', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, bot_id } = req.query;

    const filter = { userId };
    if (bot_id) filter.bot_id = bot_id;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select('card.bin card.brand card.country card.type card.level price status createdAt purchase_type bot_name refunded')
      .lean();

    res.json({
      purchases: orders,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /recent-recharges — Last recharges for this user ──────────────────

router.get('/recent-recharges', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Recharge.countDocuments({ userId });

    const recharges = await Recharge.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select('amount method status createdAt completed_at txn_id')
      .lean();

    res.json({
      recharges,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
