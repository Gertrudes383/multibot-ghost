'use strict';

const router = require('express').Router();
const { Bot, User } = require('../../../database/schemas');
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
    const { botId } = req.query;
    const totalUsers = botId
      ? await User.countDocuments({ bot_id: botId, owner_id: req.user.id })
      : await User.countDocuments({ owner_id: req.user.id });

    res.json({ totalUsers, totalReferrals: 0, conversionRate: 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/top', async (req, res) => {
  try {
    res.json({ top: [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:userId/referrals', async (req, res) => {
  try {
    res.json({ referrals: [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
