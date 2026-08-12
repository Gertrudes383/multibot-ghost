'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { User, Card, Order, Recharge, Activity, Bot, Setting } = require('../../../database/schemas');

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

async function getAdvancedStats(req, res) {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [dailyRevenue, topBINs, topCountries, conversionAgg, orderValueAgg] = await Promise.all([
      // Daily revenue chart for last 30 days
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
      // Top BINs by order count
      Order.aggregate([
        { $match: { owner_id: ownerId, status: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$bin', count: { $sum: 1 }, revenue: { $sum: '$price' } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, bin: '$_id', count: 1, revenue: 1 } },
      ]),
      // Top countries by card stock
      Card.aggregate([
        { $match: { owner_id: ownerId, status: 'available' } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, country: '$_id', count: 1 } },
      ]),
      // Conversion rate: completed vs total orders (last 30 days)
      Order.aggregate([
        { $match: { owner_id: ownerId, createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          },
        },
      ]),
      // Average order value (last 30 days)
      Order.aggregate([
        { $match: { owner_id: ownerId, status: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, avgValue: { $avg: '$price' }, totalRevenue: { $sum: '$price' }, count: { $sum: 1 } } },
      ]),
    ]);

    const convData = conversionAgg[0] || { total: 0, completed: 0 };
    const conversionRate = convData.total > 0 ? (convData.completed / convData.total) * 100 : 0;

    res.json({
      dailyRevenue,
      topBINs,
      topCountries,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      avgOrderValue: orderValueAgg[0]?.avgValue || 0,
      totalRevenue: orderValueAgg[0]?.totalRevenue || 0,
      totalOrders: orderValueAgg[0]?.count || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getBanners(req, res) {
  try {
    const ownerId = req.user.id;
    const botId = req.query.botId || null;
    const banners = await Setting.getValue('dashboard_banners', ownerId, botId);
    res.json({ banners: banners ?? [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function setBanners(req, res) {
  try {
    const ownerId = req.user.id;
    const { banners, botId } = req.body;
    if (!Array.isArray(banners)) return res.status(400).json({ message: 'banners deve ser um array' });
    await Setting.setValue('dashboard_banners', banners, ownerId, botId || null);
    res.json({ message: 'Banners atualizados', banners });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

router.get('/', getDashboardOverview);
router.get('/stats', getDetailedStats);
router.get('/charts', getChartData);
router.get('/recent-activity', getRecentActivity);
router.get('/advanced', getAdvancedStats);
router.get('/banners', getBanners);
router.post('/banners', setBanners);

module.exports = router;
