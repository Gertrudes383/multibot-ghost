'use strict';

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { tenantAuth } = require('../middleware/tenantAuth');
const { generalLimiter } = require('../middleware/rateLimiter');
const { sanitizeInputs } = require('../middleware/sanitize');
const rechargeService = require('../services/recharge.service');
const cryptoService = require('../services/crypto.service');

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function createRecharge(req, res, next) {
  try {
    const botId = req.bot?._id || req.body.bot_id;
    const ownerId = req.bot?.owner_id || req.user.id;
    const { amount, method, currency } = req.body;

    const result = await rechargeService.createRecharge(
      req.user.id, botId, ownerId, amount, method, { currency }
    );

    const io = req.app.get('io');
    if (io && botId) {
      io.to(`bot:${botId}`).emit('recharge:created', {
        userId: req.user.id,
        rechargeId: result.rechargeId,
        method: result.method,
      });
    }

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getRechargeHistory(req, res, next) {
  try {
    const botId = req.bot?._id || req.query.bot_id;
    const result = await rechargeService.getRechargeHistory(req.user.id, botId, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getRechargeSettings(req, res, next) {
  try {
    const botId = req.bot?._id || req.query.bot_id;
    const ownerId = req.bot?.owner_id || req.user.id;
    const result = await rechargeService.getRechargeSettings(ownerId, botId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function createPixRecharge(req, res, next) {
  try {
    const botId = req.bot?._id || req.body.bot_id;
    const ownerId = req.bot?.owner_id || req.user.id;
    const { amount } = req.body;

    const result = await rechargeService.createRecharge(
      req.user.id, botId, ownerId, amount, 'pix_auto'
    );

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function createManualRecharge(req, res, next) {
  try {
    const botId = req.bot?._id || req.body.bot_id;
    const ownerId = req.bot?.owner_id || req.user.id;
    const { amount } = req.body;

    const result = await rechargeService.createRecharge(
      req.user.id, botId, ownerId, amount, 'manual'
    );

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function createCryptoRecharge(req, res, next) {
  try {
    const botId = req.bot?._id || req.body.bot_id;
    const ownerId = req.bot?.owner_id || req.user.id;
    const { amount, currency } = req.body;

    const result = await rechargeService.createRecharge(
      req.user.id, botId, ownerId, amount, 'crypto', { currency }
    );

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getCryptoCurrencies(req, res, next) {
  try {
    const currencies = await cryptoService.getSupportedCurrencies();
    res.json({ success: true, data: currencies });
  } catch (err) {
    next(err);
  }
}

async function getCryptoEstimate(req, res, next) {
  try {
    const { amount, currency } = req.query;
    const result = await cryptoService.getEstimate(amount, currency);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Middleware + Rotas
// ---------------------------------------------------------------------------
router.use(authenticate, tenantAuth);

router.post('/create', generalLimiter, sanitizeInputs, createRecharge);
router.get('/history', getRechargeHistory);
router.get('/settings', getRechargeSettings);
router.post('/pix', generalLimiter, sanitizeInputs, createPixRecharge);
router.post('/manual', generalLimiter, sanitizeInputs, createManualRecharge);
router.post('/crypto', generalLimiter, sanitizeInputs, createCryptoRecharge);
router.get('/crypto/currencies', getCryptoCurrencies);
router.get('/crypto/estimate', getCryptoEstimate);

module.exports = router;
