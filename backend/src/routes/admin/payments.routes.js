'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { PixSetting, Bot, CheckerSetting, Recharge } = require('../../../database/schemas');
const { maskObjectSecrets } = require('../../utils/secretMasker');
const { sanitizeInputs } = require('../../middleware/sanitize');
const pixService = require('../../services/pix.service');
const config = require('../../config');

// ─── PIX ───

router.get('/pix/settings', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const settings = await PixSetting.findOne({ bot_id: botId }).lean();
    res.json({ settings: settings ? maskObjectSecrets(settings) : null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/pix/settings', sanitizeInputs, async (req, res) => {
  try {
    const { botId, ...updates } = req.body;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const result = await pixService.updatePixSettings(req.user.id, botId, updates);
    res.json({ settings: maskObjectSecrets(result) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ─── CRYPTO ───

router.get('/crypto/settings', async (req, res) => {
  try {
    res.json({
      settings: maskObjectSecrets({
        apiKey: config.nowpaymentsApiKey,
        ipnSecret: config.nowpaymentsIpnSecret,
        endpoint: config.nowpaymentsEndpoint,
        callbackUrl: config.nowpaymentsCallbackUrl,
      }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/crypto/settings', sanitizeInputs, async (req, res) => {
  res.status(501).json({ message: 'Configurações crypto são definidas via variáveis de ambiente' });
});

// ─── MANUAL ───

router.get('/manual', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    res.json({
      methods: [{
        id: 'manual_transfer',
        name: 'Transferência Manual',
        enabled: true,
        instructions: bot.terms_message || 'Envie comprovante ao administrador',
      }],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/manual', sanitizeInputs, async (req, res) => {
  res.json({ message: 'Método manual configurado' });
});

router.put('/manual/:methodId', sanitizeInputs, async (req, res) => {
  res.json({ message: 'Método manual atualizado' });
});

router.delete('/manual/:methodId', async (req, res) => {
  res.json({ message: 'Método manual removido' });
});

// ─── GATEWAYS ───

router.get('/gateways', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.json({ gateways: [] });

    const settings = await CheckerSetting.findOne({ bot_id: botId }).lean();
    res.json({
      gateways: settings ? [{
        id: 'default',
        name: 'Checker Padrão',
        url: settings.api_url,
        active: true,
      }] : [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/gateways/:gatewayId', sanitizeInputs, async (req, res) => {
  res.json({ message: 'Gateway atualizado' });
});

// ─── RECHARGE SETTINGS ───

router.get('/recharge-settings', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const pixSettings = await PixSetting.findOne({ bot_id: botId }).lean();

    res.json({
      pix: { enabled: !bot.disable_pix, provider: pixSettings?.provider || 'primepix' },
      crypto: { enabled: !!config.nowpaymentsApiKey },
      manual: { enabled: true },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/recharge-settings', sanitizeInputs, async (req, res) => {
  try {
    const { botId, ...updates } = req.body;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id });
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    if (updates.pixEnabled !== undefined) bot.disable_pix = !updates.pixEnabled;
    await bot.save();

    res.json({ message: 'Configurações atualizadas' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PIX PAYMENTS ───────────────────────────────────────────────────────────

router.get('/pix/payments', async (req, res) => {
  try {
    const { botId, page = 1, limit = 20, status } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const filter = { bot_id: botId, method: 'pix_auto' };
    if (status) filter.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Recharge.countDocuments(filter);
    const payments = await Recharge.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select('userId amount status txn_id createdAt completed_at')
      .lean();

    res.json({
      payments,
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

// ─── MANUAL PAYMENTS ─────────────────────────────────────────────────────────

router.get('/manual/attempts', async (req, res) => {
  try {
    const { botId, page = 1, limit = 20, status } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const filter = { bot_id: botId, method: 'manual' };
    if (status) filter.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Recharge.countDocuments(filter);
    const attempts = await Recharge.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select('userId amount status txn_id createdAt completed_at')
      .lean();

    res.json({
      attempts,
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

router.get('/manual/settings', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id })
      .select('terms_message support_username')
      .lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    res.json({
      settings: {
        enabled: true,
        instructions: bot.terms_message || '',
        support_username: bot.support_username || null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/manual/settings', sanitizeInputs, async (req, res) => {
  try {
    const { botId, instructions, support_username } = req.body;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id });
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    if (instructions !== undefined) bot.terms_message = instructions;
    if (support_username !== undefined) bot.support_username = support_username;
    await bot.save();

    res.json({ message: 'Configurações manuais atualizadas' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/manual/statistics', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const [stats] = await Recharge.aggregate([
      { $match: { bot_id: new mongoose.Types.ObjectId(botId), method: 'manual' } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amount' } },
        },
      },
    ]);

    // Restructure aggregation results by status
    const results = await Recharge.aggregate([
      { $match: { bot_id: new mongoose.Types.ObjectId(botId), method: 'manual' } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amount' } },
        },
      },
    ]);

    const byStatus = { approved: { count: 0, total: 0 }, pending: { count: 0, total: 0 } };
    results.forEach((r) => {
      if (r._id === 'completed') {
        byStatus.approved = { count: r.count, total: r.totalAmount };
      } else if (r._id === 'pending') {
        byStatus.pending = { count: r.count, total: r.totalAmount };
      }
    });

    res.json({
      statistics: {
        total_approved: byStatus.approved.count,
        total_pending: byStatus.pending.count,
        total_value_approved: byStatus.approved.total,
        total_value_pending: byStatus.pending.total,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── UNIFIED SETTINGS ────────────────────────────────────────────────────────

router.get('/unified-settings', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id })
      .select('disable_pix terms_message support_username')
      .lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const pixSettings = await PixSetting.findOne({ bot_id: botId }).lean();

    res.json({
      settings: {
        pix: {
          enabled: !bot.disable_pix,
          provider: pixSettings?.provider || 'primepix',
          min_amount: pixSettings?.min_amount || 5,
          max_amount: pixSettings?.max_amount || 5000,
          fee_type: pixSettings?.fee_type || 'none',
          fee_value: pixSettings?.fee_value || 0,
        },
        crypto: {
          enabled: !!config.nowpaymentsApiKey,
          endpoint: config.nowpaymentsEndpoint || null,
        },
        manual: {
          enabled: true,
          instructions: bot.terms_message || '',
          support_username: bot.support_username || null,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/unified-settings', sanitizeInputs, async (req, res) => {
  try {
    const { botId, pix, manual } = req.body;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id });
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    // Update PIX enabled flag on Bot doc
    if (pix && pix.enabled !== undefined) {
      bot.disable_pix = !pix.enabled;
    }

    // Update manual recharge settings
    if (manual) {
      if (manual.instructions !== undefined) bot.terms_message = manual.instructions;
      if (manual.support_username !== undefined) bot.support_username = manual.support_username;
    }

    await bot.save();

    // Update PIX provider settings if provided
    if (pix && Object.keys(pix).length > 1) {
      const { enabled, ...pixUpdates } = pix;
      await PixSetting.findOneAndUpdate(
        { bot_id: botId },
        { $set: pixUpdates },
        { upsert: false }
      );
    }

    res.json({ message: 'Configurações unificadas atualizadas' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── RECHARGE BONUS ──────────────────────────────────────────────────────────

const DEFAULT_BONUS_TIERS = [
  { min_amount: 50,  max_amount: 99,   bonus_percentage: 5,  label: '5% bônus' },
  { min_amount: 100, max_amount: 199,  bonus_percentage: 10, label: '10% bônus' },
  { min_amount: 200, max_amount: 499,  bonus_percentage: 15, label: '15% bônus' },
  { min_amount: 500, max_amount: null, bonus_percentage: 20, label: '20% bônus' },
];

router.get('/recharge-bonus', async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const pixSettings = await PixSetting.findOne({ bot_id: botId }).lean();
    const tiers =
      pixSettings && Array.isArray(pixSettings.bonus_tiers) && pixSettings.bonus_tiers.length
        ? pixSettings.bonus_tiers
        : DEFAULT_BONUS_TIERS;

    res.json({ bonus_tiers: tiers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/recharge-bonus', sanitizeInputs, async (req, res) => {
  try {
    const { botId, bonus_tiers } = req.body;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });
    if (!Array.isArray(bonus_tiers)) return res.status(400).json({ message: 'bonus_tiers deve ser um array' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    await PixSetting.findOneAndUpdate(
      { bot_id: botId },
      { $set: { bonus_tiers } },
      { upsert: false }
    );

    res.json({ message: 'Bônus de recarga atualizados', bonus_tiers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── CRYPTO PAYMENTS ─────────────────────────────────────────────────────────

router.get('/crypto/payments', async (req, res) => {
  try {
    const { botId, page = 1, limit = 20, status } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const bot = await Bot.findOne({ _id: botId, owner_id: req.user.id }).lean();
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    const filter = { bot_id: botId, method: 'crypto' };
    if (status) filter.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Recharge.countDocuments(filter);
    const payments = await Recharge.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select('userId amount status txn_id createdAt completed_at')
      .lean();

    res.json({
      payments,
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
