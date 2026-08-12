'use strict';

const router = require('express').Router();
const { Bot } = require('../../../database/schemas');
const { sanitize } = require('../../utils/htmlSanitizer');
const { sanitizeInputs } = require('../../middleware/sanitize');

async function getBotForOwner(req) {
  const botId = req.query.botId || req.body?.botId;
  if (!botId) return null;
  return Bot.findOne({ _id: botId, owner_id: req.user.id });
}

// ─── SITE ───

router.get('/site', async (req, res) => {
  try {
    const bot = await getBotForOwner(req);
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });
    res.json({
      store_name: bot.store_name,
      store_color: bot.store_color,
      start_image_url: bot.start_image_url,
      welcome_message: bot.welcome_message,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/site', sanitizeInputs, async (req, res) => {
  try {
    const bot = await getBotForOwner(req);
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    if (req.body.store_name !== undefined) bot.store_name = req.body.store_name;
    if (req.body.store_color !== undefined) bot.store_color = req.body.store_color;
    if (req.body.start_image_url !== undefined) bot.start_image_url = req.body.start_image_url;
    if (req.body.welcome_message !== undefined) bot.welcome_message = sanitize(req.body.welcome_message);

    await bot.save();
    res.json({ message: 'Configurações do site atualizadas' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── REGISTRATION ───

router.get('/registration', async (req, res) => {
  try {
    const bot = await getBotForOwner(req);
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });
    res.json({
      require_subscription: bot.require_subscription,
      required_channel: bot.required_channel,
      referral_enabled: bot.referral_enabled,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/registration', sanitizeInputs, async (req, res) => {
  try {
    const bot = await getBotForOwner(req);
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    if (req.body.require_subscription !== undefined) bot.require_subscription = req.body.require_subscription;
    if (req.body.required_channel !== undefined) bot.required_channel = req.body.required_channel;
    if (req.body.referral_enabled !== undefined) bot.referral_enabled = req.body.referral_enabled;

    await bot.save();
    res.json({ message: 'Configurações de registro atualizadas' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── RULES ───

router.get('/rules', async (req, res) => {
  try {
    const bot = await getBotForOwner(req);
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });
    res.json({
      terms_message: bot.terms_message,
      disable_purchases: bot.disable_purchases,
      disable_pix: bot.disable_pix,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/rules', sanitizeInputs, async (req, res) => {
  try {
    const bot = await getBotForOwner(req);
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    if (req.body.terms_message !== undefined) bot.terms_message = sanitize(req.body.terms_message);
    if (req.body.disable_purchases !== undefined) bot.disable_purchases = req.body.disable_purchases;
    if (req.body.disable_pix !== undefined) bot.disable_pix = req.body.disable_pix;

    await bot.save();
    res.json({ message: 'Regras atualizadas' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── CPF ───

router.get('/cpf', async (req, res) => {
  res.json({ cpfRequired: false, cpfValidation: 'none' });
});

router.put('/cpf', sanitizeInputs, async (req, res) => {
  res.json({ message: 'Configurações CPF atualizadas' });
});

// ─── SECURITY ───

router.get('/security', async (req, res) => {
  res.json({
    twoFactorEnabled: false,
    sessionTimeout: 3600,
    maxLoginAttempts: 5,
  });
});

router.put('/security', sanitizeInputs, async (req, res) => {
  res.json({ message: 'Configurações de segurança atualizadas' });
});

// ─── SUPPORT ───

router.get('/support', async (req, res) => {
  try {
    const bot = await getBotForOwner(req);
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });
    res.json({ help_message: bot.help_message });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/support', sanitizeInputs, async (req, res) => {
  try {
    const bot = await getBotForOwner(req);
    if (!bot) return res.status(404).json({ message: 'Bot não encontrado' });

    if (req.body.help_message !== undefined) bot.help_message = sanitize(req.body.help_message);
    await bot.save();
    res.json({ message: 'Configurações de suporte atualizadas' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── NOTIFICATIONS ───

router.get('/notifications', async (req, res) => {
  res.json({ emailNotifications: false, telegramNotifications: true });
});

router.put('/notifications', sanitizeInputs, async (req, res) => {
  res.json({ message: 'Configurações de notificações atualizadas' });
});

module.exports = router;
