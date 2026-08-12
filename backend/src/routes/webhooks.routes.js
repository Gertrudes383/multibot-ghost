'use strict';

const express = require('express');
const router = express.Router();

const {
  verifyNowPaymentsWebhook,
  verifyPixWebhook,
  verifySupplierWebhook,
} = require('../middleware/webhookAuth');

const rechargeService = require('../services/recharge.service');
const cardService = require('../services/card.service');

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handlePixCallback(req, res, next) {
  try {
    const callbackData = req.body || {};
    const txnId = callbackData.txid || callbackData.txn_id || callbackData.id || callbackData.pixId;

    const result = await rechargeService.processPixRecharge(txnId, callbackData);

    if (result.success) {
      const io = req.app.get('io');
      if (io && result.rechargeId) {
        io.emit('recharge:completed', {
          rechargeId: result.rechargeId,
          amount: result.amount,
          method: 'pix_auto',
        });
      }
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function handleCryptoCallback(req, res, next) {
  try {
    const callbackData = req.body || {};

    const result = await rechargeService.processCryptoRecharge(callbackData);

    if (result.success) {
      const io = req.app.get('io');
      if (io && result.rechargeId) {
        io.emit('recharge:completed', {
          rechargeId: result.rechargeId,
          amount: result.amount,
          method: 'crypto',
        });
      }
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function handleSupplierCallback(req, res, next) {
  try {
    const { cards, bot_id, owner_id, batch_name, source } = req.body || {};

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'PAYLOAD_INVALIDO',
        message: 'Array de cards obrigatorio.',
      });
    }

    if (!bot_id || !owner_id) {
      return res.status(400).json({
        success: false,
        error: 'PAYLOAD_INVALIDO',
        message: 'bot_id e owner_id obrigatorios.',
      });
    }

    const result = await cardService.uploadCards(owner_id, bot_id, cards, {
      name: batch_name || `Fornecedor ${new Date().toISOString().slice(0, 10)}`,
      source: source || 'supplier_webhook',
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`bot:${bot_id}`).emit('supplier:delivery', {
        botId: bot_id,
        uploaded: result.uploaded,
        batchId: result.batchId,
      });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Rotas — cada webhook com seu middleware de verificacao
// ---------------------------------------------------------------------------

router.post('/pix/callback', verifyPixWebhook, handlePixCallback);
router.post('/crypto/callback', verifyNowPaymentsWebhook, handleCryptoCallback);
router.post('/supplier/callback', verifySupplierWebhook, handleSupplierCallback);

module.exports = router;
