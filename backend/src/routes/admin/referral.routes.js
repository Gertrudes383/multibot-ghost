'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { Bot, User, Referral } = require('../../../database/schemas');
const { sanitizeInputs } = require('../../middleware/sanitize');

router.get('/settings', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    res.json({
      referral_enabled: bot.referral_enabled,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/settings', sanitizeInputs, async (req, res) => {
  try {
    const { botId, referral_enabled } = req.body;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id });
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    if (referral_enabled !== undefined) bot.referral_enabled = referral_enabled;
    await bot.save();
    res.json({ message: 'Configurações de referral atualizadas' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const matchStage = { owner_id: ownerId };
    if (req.query.botId) matchStage.bot_id = new mongoose.Types.ObjectId(req.query.botId);

    const [agg, activeReferrers] = await Promise.all([
      Referral.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalReferrals: { $sum: 1 },
            totalEarnings: { $sum: '$total_earnings' },
            totalRegistrationBonus: { $sum: '$registration_bonus' },
          },
        },
      ]),
      Referral.distinct('referrer_id', matchStage),
    ]);

    const stats = agg[0] || { totalReferrals: 0, totalEarnings: 0, totalRegistrationBonus: 0 };

    res.json({
      totalReferrals: stats.totalReferrals,
      totalEarnings: stats.totalEarnings,
      totalRegistrationBonus: stats.totalRegistrationBonus,
      activeReferrers: activeReferrers.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/top', async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const matchStage = { owner_id: ownerId };
    if (req.query.botId) matchStage.bot_id = new mongoose.Types.ObjectId(req.query.botId);

    const top = await Referral.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$referrer_id',
          totalReferrals: { $sum: 1 },
          totalEarnings: { $sum: '$total_earnings' },
          totalRegistrationBonus: { $sum: '$registration_bonus' },
        },
      },
      { $sort: { totalEarnings: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'referrer',
        },
      },
      { $unwind: { path: '$referrer', preserveNullAndEmpty: false } },
      {
        $project: {
          _id: 0,
          referrerId: '$_id',
          totalReferrals: 1,
          totalEarnings: 1,
          totalRegistrationBonus: 1,
          username: '$referrer.username',
          telegram_username: '$referrer.telegram_username',
          telegram_id: '$referrer.telegram_id',
        },
      },
    ]);

    res.json({ top });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/earnings', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const lim = Math.min(100, parseInt(limit, 10));
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * lim;

    const ownerId = req.user.id;
    const query = { owner_id: ownerId, total_earnings: { $gt: 0 } };
    if (req.query.botId) query.bot_id = req.query.botId;

    const [referrals, total] = await Promise.all([
      Referral.find(query)
        .sort({ total_earnings: -1 })
        .skip(skip)
        .limit(lim)
        .populate('referrer_id', 'username telegram_username telegram_id')
        .lean(),
      Referral.countDocuments(query),
    ]);

    res.json({ referrals, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const lim = Math.min(100, parseInt(limit, 10));
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * lim;

    const ownerId = req.user.id;
    const query = { owner_id: ownerId };
    if (req.query.botId) query.bot_id = req.query.botId;

    const [referrals, total] = await Promise.all([
      Referral.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate('referred_id', 'username telegram_username telegram_id createdAt')
        .populate('referrer_id', 'username telegram_username')
        .lean(),
      Referral.countDocuments(query),
    ]);

    res.json({ referrals, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:userId/referrals', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const lim = Math.min(100, parseInt(limit, 10));
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * lim;

    const ownerId = req.user.id;
    const query = { owner_id: ownerId, referrer_id: req.params.userId };
    if (req.query.botId) query.bot_id = req.query.botId;

    const [referrals, total] = await Promise.all([
      Referral.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate('referred_id', 'username telegram_username telegram_id createdAt')
        .lean(),
      Referral.countDocuments(query),
    ]);

    res.json({ referrals, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
