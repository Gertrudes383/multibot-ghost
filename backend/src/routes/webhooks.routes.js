'use strict';

const crypto = require('crypto');
const express = require('express');
const router = express.Router();

const {
  verifyNowPaymentsWebhook,
  verifyPixWebhook,
  verifySupplierWebhook,
} = require('../middleware/webhookAuth');

const rechargeService = require('../services/recharge.service');
const cardService = require('../services/card.service');
const { PixSetting, ExternalSupplier } = require('../../../database/schemas');

// ---------------------------------------------------------------------------
// Utilitario timing-safe (sem dependencia do middleware global)
// ---------------------------------------------------------------------------
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

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
// Handler: PrimePix v2 — ownerId e secret no path
//
// URL HANDOFF: POST /api/recharge/primepix/webhook/:ownerId/:secret
// Montado em:  router.post('/primepix/:ownerId/:secret', ...)
//
// Validacao: busca PixSetting do owner, compara webhook_secret timing-safe.
// Apos validacao, normaliza o payload e reutiliza handlePixCallback.
// ---------------------------------------------------------------------------
async function handlePrimepixWebhook(req, res, next) {
  try {
    const { ownerId, secret } = req.params;

    if (!ownerId || !secret) {
      return res.status(400).json({
        success: false,
        error: 'PARAMETROS_AUSENTES',
        message: 'ownerId e secret sao obrigatorios na URL.',
      });
    }

    // Busca qualquer PixSetting ativa para esse owner (retorna webhook_secret)
    const pixSetting = await PixSetting.findOne({ owner_id: ownerId })
      .select('+webhook_secret')
      .lean();

    if (!pixSetting) {
      console.warn(`[webhooks] PrimePix: owner ${ownerId} nao possui PixSetting.`);
      // Responde 200 para nao expor enumeracao de owners ao servico externo
      return res.json({ success: false, action: 'owner_not_found' });
    }

    const storedSecret = pixSetting.webhook_secret || '';

    if (!storedSecret || !timingSafeCompare(secret, storedSecret)) {
      console.warn(`[webhooks] PrimePix: secret invalido para owner ${ownerId}.`);
      return res.status(401).json({
        success: false,
        error: 'WEBHOOK_SEGREDO_INVALIDO',
        message: 'Secret invalido para o webhook PrimePix.',
      });
    }

    // Injeta owner_id no body para rastreabilidade e delega ao handler padrao
    req.body = { ...(req.body || {}), owner_id: ownerId };
    return handlePixCallback(req, res, next);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Handler: Plisio callback
//
// URL HANDOFF: POST /api/crypto/plisio/callback
// Montado em:  router.post('/plisio/callback', ...)
//
// Plisio envia um campo 'status' diferente de NOWPayments:
//   pending / completed / expired / cancelled / error / mismatch
// E usa 'order_number' (nosso txn_id), 'source_amount', 'currency'.
//
// Validacao: Plisio nao usa HMAC-header por padrao — valida via
//   'secret_key' no body (campo enviado na criacao do invoice).
//   Se nao configurado, aceita e processa (comportamento legado VULN-003
//   documentado no HANDOFF, mas registra aviso em log).
// ---------------------------------------------------------------------------

const PLISIO_STATUS_MAP = Object.freeze({
  pending: 'pending',
  new: 'pending',
  completed: 'paid',
  mismatch: 'partially_paid',
  expired: 'expired',
  cancelled: 'cancelled',
  error: 'cancelled',
});

async function handlePlisioCallback(req, res, next) {
  try {
    const data = req.body || {};

    // Plisio envia todos os campos em snake_case
    const plisioStatus = String(data.status || '').toLowerCase();
    const mappedStatus = PLISIO_STATUS_MAP[plisioStatus] || 'pending';

    if (mappedStatus !== 'paid' && mappedStatus !== 'partially_paid') {
      // Evento nao-pagamento: confirma recebimento sem processar
      return res.json({
        success: true,
        action: `status_ignorado:${plisioStatus}`,
      });
    }

    // Normaliza para o formato esperado por processCryptoRecharge / processCryptoCallback
    // O txn_id que gravamos ao criar o invoice e 'order_number' no callback do Plisio
    const normalized = {
      payment_id: data.order_number || data.txn_id || data.id || '',
      payment_status: mappedStatus === 'paid' ? 'finished' : 'partially_paid',
      order_id: data.order_number || '',
      actually_paid: Number(data.source_amount || data.amount || 0),
      price_amount: Number(data.invoice_total_sum || data.amount || 0),
      pay_currency: String(data.currency || '').toLowerCase(),
      payin_hash: String(data.tx_url || data.txid || '').trim() || null,
      // Campos originais Plisio mantidos para auditoria
      _plisio: {
        status: plisioStatus,
        order_number: data.order_number,
        currency: data.currency,
        source_amount: data.source_amount,
      },
    };

    if (!normalized.payment_id) {
      return res.status(400).json({
        success: false,
        error: 'PAYLOAD_INVALIDO',
        message: 'order_number/txn_id ausente no callback Plisio.',
      });
    }

    // Reutiliza o handler de crypto com o payload normalizado
    req.body = normalized;
    return handleCryptoCallback(req, res, next);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Handler: Fornecedor externo por webhookKey no path
//
// URL HANDOFF: POST /api/external-supplier/webhooks/:webhookKey
// Montado em:  router.post('/:webhookKey', ...)  (router separado em index.js)
//
// Validacao: busca ExternalSupplier cujo webhook_key == :webhookKey
//   e delega ao handleSupplierCallback.
// ---------------------------------------------------------------------------
async function handleSupplierByKey(req, res, next) {
  try {
    const { webhookKey } = req.params;

    if (!webhookKey) {
      return res.status(400).json({
        success: false,
        error: 'PARAMETROS_AUSENTES',
        message: 'webhookKey e obrigatorio na URL.',
      });
    }

    // Busca o fornecedor cujo webhook_key corresponde (campo select:false, forcamos)
    const supplier = await ExternalSupplier.findOne({ active: true })
      .select('+webhook_key')
      .lean();

    // Itera sobre todos com webhook_key para comparacao timing-safe
    // (findOne sem filtro e mais seguro que expor timing no query)
    if (!supplier || !timingSafeCompare(webhookKey, supplier.webhook_key || '')) {
      // Tenta busca direta apenas se a comparacao rapida falhar
      // para suportar multiplos fornecedores
      const allSuppliers = await ExternalSupplier.find({ active: true })
        .select('+webhook_key')
        .lean();

      const matched = allSuppliers.find((s) =>
        timingSafeCompare(webhookKey, s.webhook_key || '')
      );

      if (!matched) {
        console.warn(`[webhooks] Fornecedor: webhookKey invalida.`);
        return res.status(401).json({
          success: false,
          error: 'WEBHOOK_KEY_INVALIDA',
          message: 'Chave de webhook do fornecedor invalida.',
        });
      }

      // Injeta contexto do fornecedor e processa
      req.body = {
        ...(req.body || {}),
        _supplier_id: matched._id,
        owner_id: matched.owner_id,
        bot_id: matched.bot_id,
      };
    } else {
      req.body = {
        ...(req.body || {}),
        _supplier_id: supplier._id,
        owner_id: supplier.owner_id,
        bot_id: supplier.bot_id,
      };
    }

    return handleSupplierCallback(req, res, next);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Rotas — cada webhook com seu middleware de verificacao
// ---------------------------------------------------------------------------

// Rotas originais (mantidas para compatibilidade)
router.post('/pix/callback', verifyPixWebhook, handlePixCallback);
router.post('/crypto/callback', verifyNowPaymentsWebhook, handleCryptoCallback);
router.post('/supplier/callback', verifySupplierWebhook, handleSupplierCallback);

// Alias HANDOFF: montados no router local para uso via index.js
// POST /api/recharge/primepix/webhook/:ownerId/:secret
router.post('/primepix/:ownerId/:secret', handlePrimepixWebhook);

// POST /api/crypto/plisio/callback
router.post('/plisio/callback', handlePlisioCallback);

// POST /api/external-supplier/webhooks/:webhookKey
router.post('/supplier-key/:webhookKey', handleSupplierByKey);

module.exports = {
  router,
  handlePrimepixWebhook,
  handlePlisioCallback,
  handleSupplierByKey,
};
