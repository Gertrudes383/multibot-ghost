'use strict';

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { tenantAuth } = require('../middleware/tenantAuth');
const { purchaseLimiter, generalLimiter } = require('../middleware/rateLimiter');
const { sanitizeInputs } = require('../middleware/sanitize');
const cardService = require('../services/card.service');

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function listCards(req, res, next) {
  try {
    const botId = req.bot?._id || req.query.bot_id;
    const result = await cardService.listCards(botId, {
      ...req.query,
      ownerId: req.user.id,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getCountries(req, res, next) {
  try {
    const botId = req.bot?._id || req.query.bot_id;
    const countries = await cardService.getCardCountries(req.user.id, botId);
    res.json({ success: true, data: countries });
  } catch (err) {
    next(err);
  }
}

async function getGateways(req, res, next) {
  try {
    const botId = req.bot?._id || req.query.bot_id;
    const gateways = await cardService.getCardGateways(req.user.id, botId);
    res.json({ success: true, data: gateways });
  } catch (err) {
    next(err);
  }
}

async function massCheck(req, res, next) {
  try {
    const botId = req.bot?._id || req.body.bot_id;
    const { cardIds, gateway } = req.body;
    const result = await cardService.massCheck(botId, cardIds, gateway);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getCheckSessions(req, res, next) {
  try {
    const botId = req.bot?._id || req.query.bot_id;
    const sessions = await cardService.getCheckSessions(botId);
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Middleware + Rotas
// ---------------------------------------------------------------------------
router.use(authenticate, tenantAuth);

router.get('/', generalLimiter, listCards);
router.get('/countries', generalLimiter, getCountries);
router.get('/gateways', generalLimiter, getGateways);
router.post('/mass-check', purchaseLimiter, sanitizeInputs, massCheck);
router.get('/check-sessions', generalLimiter, getCheckSessions);

module.exports = router;
