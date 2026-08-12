'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { Bot, Setting, Notification } = require('../../../database/schemas');
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
  try {
    const ownerId = req.user.id;
    const botId = req.query.botId || null;

    const [cpfRequired, cpfValidation, cpfVisible] = await Promise.all([
      Setting.getValue('cpf_required', ownerId, botId),
      Setting.getValue('cpf_validation', ownerId, botId),
      Setting.getValue('cpf_visible', ownerId, botId),
    ]);

    res.json({
      cpfRequired: cpfRequired ?? false,
      cpfValidation: cpfValidation ?? 'none',
      cpfVisible: cpfVisible ?? false,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/cpf', sanitizeInputs, async (req, res) => {
  try {
    const ownerId = req.user.id;
    const botId = req.body.botId || null;

    const updates = [];
    if (req.body.cpfRequired !== undefined) {
      updates.push(Setting.setValue('cpf_required', req.body.cpfRequired, ownerId, botId));
    }
    if (req.body.cpfValidation !== undefined) {
      updates.push(Setting.setValue('cpf_validation', req.body.cpfValidation, ownerId, botId));
    }
    if (req.body.cpfVisible !== undefined) {
      updates.push(Setting.setValue('cpf_visible', req.body.cpfVisible, ownerId, botId));
    }
    await Promise.all(updates);

    res.json({ message: 'Configurações CPF atualizadas' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── SECURITY ───

router.get('/security', async (req, res) => {
  try {
    const ownerId = req.user.id;
    const botId = req.query.botId || null;

    const [twoFactorEnabled, sessionTimeout, maxLoginAttempts, ipWhitelist] = await Promise.all([
      Setting.getValue('security_2fa_enabled', ownerId, botId),
      Setting.getValue('security_session_timeout', ownerId, botId),
      Setting.getValue('security_max_login_attempts', ownerId, botId),
      Setting.getValue('security_ip_whitelist', ownerId, botId),
    ]);

    res.json({
      twoFactorEnabled: twoFactorEnabled ?? false,
      sessionTimeout: sessionTimeout ?? 3600,
      maxLoginAttempts: maxLoginAttempts ?? 5,
      ipWhitelist: ipWhitelist ?? [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/security', sanitizeInputs, async (req, res) => {
  try {
    const ownerId = req.user.id;
    const botId = req.body.botId || null;

    const updates = [];
    if (req.body.twoFactorEnabled !== undefined) {
      updates.push(Setting.setValue('security_2fa_enabled', req.body.twoFactorEnabled, ownerId, botId));
    }
    if (req.body.sessionTimeout !== undefined) {
      updates.push(Setting.setValue('security_session_timeout', parseInt(req.body.sessionTimeout, 10), ownerId, botId));
    }
    if (req.body.maxLoginAttempts !== undefined) {
      updates.push(Setting.setValue('security_max_login_attempts', parseInt(req.body.maxLoginAttempts, 10), ownerId, botId));
    }
    if (req.body.ipWhitelist !== undefined) {
      updates.push(Setting.setValue('security_ip_whitelist', req.body.ipWhitelist, ownerId, botId));
    }
    await Promise.all(updates);

    res.json({ message: 'Configurações de segurança atualizadas' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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
  try {
    const ownerId = req.user.id;
    const botId = req.query.botId || null;

    const [emailNotifications, telegramNotifications, unreadCount] = await Promise.all([
      Setting.getValue('notifications_email_enabled', ownerId, botId),
      Setting.getValue('notifications_telegram_enabled', ownerId, botId),
      Notification.find({ owner_id: ownerId, read: false }).countDocuments(),
    ]);

    res.json({
      emailNotifications: emailNotifications ?? false,
      telegramNotifications: telegramNotifications ?? true,
      unreadCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/notifications', sanitizeInputs, async (req, res) => {
  try {
    const ownerId = req.user.id;
    const botId = req.body.botId || null;

    const updates = [];
    if (req.body.emailNotifications !== undefined) {
      updates.push(Setting.setValue('notifications_email_enabled', req.body.emailNotifications, ownerId, botId));
    }
    if (req.body.telegramNotifications !== undefined) {
      updates.push(Setting.setValue('notifications_telegram_enabled', req.body.telegramNotifications, ownerId, botId));
    }
    await Promise.all(updates);

    res.json({ message: 'Configurações de notificações atualizadas' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── KEY-VALUE ───

router.post('/key-value', sanitizeInputs, async (req, res) => {
  try {
    const { key, value, botId } = req.body;
    if (!key) return res.status(400).json({ message: 'key é obrigatório' });

    const ownerId = req.user.id;
    const setting = await Setting.setValue(key, value, ownerId, botId || null);
    res.json({ setting });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/key-value/:key', async (req, res) => {
  try {
    const ownerId = req.user.id;
    const botId = req.query.botId || null;
    const { key } = req.params;

    const value = await Setting.getValue(key, ownerId, botId);
    res.json({ key, value });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
