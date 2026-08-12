'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { PixSetting, Bot, CheckerSetting } = require('../../../database/schemas');
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

module.exports = router;
