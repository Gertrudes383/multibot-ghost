'use strict';

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { tenantAuth } = require('../middleware/tenantAuth');
const { purchaseLimiter } = require('../middleware/rateLimiter');
const { sanitizeInputs } = require('../middleware/sanitize');
const purchaseService = require('../services/purchase.service');

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function purchaseCard(req, res, next) {
  try {
    const botId = req.bot?._id || req.body.bot_id;
    const { bin, country, base, level, brand } = req.body;
    const result = await purchaseService.purchaseCard(req.user.id, botId, { bin, country, base, level, brand });

    const io = req.app.get('io');
    if (io && botId) {
      io.to(`bot:${botId}`).emit('purchase:completed', {
        userId: req.user.id,
        orderId: result.purchase._id,
        bin,
      });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function asyncPurchase(req, res, next) {
  try {
    const botId = req.bot?._id || req.body.bot_id;
    const result = await purchaseService.purchaseAsync(req.user.id, botId, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function autoLivePurchase(req, res, next) {
  try {
    const botId = req.bot?._id || req.body.bot_id;
    const result = await purchaseService.purchaseAutoLive(req.user.id, botId, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function mixPackagePurchase(req, res, next) {
  try {
    const botId = req.bot?._id || req.body.bot_id;
    const result = await purchaseService.purchaseMixPackage(req.user.id, botId, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getPurchaseHistory(req, res, next) {
  try {
    const botId = req.bot?._id || req.query.bot_id;
    const result = await purchaseService.getPurchaseHistory(req.user.id, botId, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Middleware + Rotas
// ---------------------------------------------------------------------------
router.use(authenticate, tenantAuth);

router.post('/purchase', purchaseLimiter, sanitizeInputs, purchaseCard);
router.post('/async', purchaseLimiter, sanitizeInputs, asyncPurchase);
router.post('/auto-live', purchaseLimiter, sanitizeInputs, autoLivePurchase);
router.post('/mix-package', purchaseLimiter, sanitizeInputs, mixPackagePurchase);
router.get('/history', getPurchaseHistory);

module.exports = router;
