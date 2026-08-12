'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { User, Card, Order, Recharge, Activity, Bot } = require('../../../database/schemas');

async function getDashboardOverview(req, res) {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);

    const [totalUsers, totalCards, totalOrders, totalRecharges, salesAgg, rechargesAgg, bots] = await Promise.all([
      User.countDocuments({ owner_id: ownerId }),
      Card.countDocuments({ owner_id: ownerId, status: 'available' }),
      Order.countDocuments({ owner_id: ownerId }),
      Recharge.countDocuments({ owner_id: ownerId, status: 'completed' }),
      Order.aggregate([
        { $match: { owner_id: ownerId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$price' }, count: { $sum: 1 } } },
      ]),
      Recharge.aggregate([
        { $match: { owner_id: ownerId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Bot.countDocuments({ owner_id: ownerId, status: 'active' }),
    ]);

    res.json({
      totalUsers,
      totalCards,
      totalOrders,
      totalRecharges,
      revenue: salesAgg[0]?.total || 0,
      salesCount: salesAgg[0]?.count || 0,
      rechargeVolume: rechargesAgg[0]?.total || 0,
      rechargeCount: rechargesAgg[0]?.count || 0,
      activeBots: bots,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getDetailedStats(req, res) {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const dateMatch = {};
    if (startDate) dateMatch.$gte = new Date(startDate);
    if (endDate) dateMatch.$lte = new Date(endDate);

    const dateGroup = {
      day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      week: { $dateToString: { format: '%Y-W%V', date: '$createdAt' } },
      month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
    };

    const matchStage = { owner_id: ownerId };
    if (Object.keys(dateMatch).length) matchStage.createdAt = dateMatch;

    const [salesByPeriod, rechargesByPeriod, usersByPeriod] = await Promise.all([
      Order.aggregate([
        { $match: { ...matchStage, status: 'completed' } },
        { $group: { _id: dateGroup[groupBy] || dateGroup.day, total: { $sum: '$price' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Recharge.aggregate([
        { $match: { ...matchStage, status: 'completed' } },
        { $group: { _id: dateGroup[groupBy] || dateGroup.day, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $match: matchStage },
        { $group: { _id: dateGroup[groupBy] || dateGroup.day, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({ salesByPeriod, rechargesByPeriod, usersByPeriod });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getChartData(req, res) {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [salesTimeline, cardsByCountry, cardsByBrand] = await Promise.all([
      Order.aggregate([
        { $match: { owner_id: ownerId, status: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$price' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Card.aggregate([
        { $match: { owner_id: ownerId, status: 'available' } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
      Card.aggregate([
        { $match: { owner_id: ownerId, status: 'available' } },
        { $group: { _id: '$brand', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({ salesTimeline, cardsByCountry, cardsByBrand });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getRecentActivity(req, res) {
  try {
    const { limit = 50, type } = req.query;
    const query = { owner_id: req.user.id };
    if (type) query.type = type;

    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 50, 200))
      .lean();

    res.json({ activities });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

router.get('/', getDashboardOverview);
router.get('/stats', getDetailedStats);
router.get('/charts', getChartData);
router.get('/recent-activity', getRecentActivity);

module.exports = router;
