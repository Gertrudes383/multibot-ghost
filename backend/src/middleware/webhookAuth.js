/**
 * Middleware de autenticacao de webhooks (FIX para VULN-003).
 *
 * Valida a autenticidade de callbacks recebidos de provedores
 * externos (Plisio, gateway PIX, fornecedor) utilizando HMAC
 * e comparacao timing-safe para prevenir ataques de timing.
 *
 * Cada funcao exportada e um middleware Express que rejeita
 * requisicoes com assinatura ausente ou invalida (HTTP 401).
 *
 * Funcoes exportadas:
 *   - verifyNowPaymentsWebhook : HMAC-SHA512 do body (sorted keys) com NOWPAYMENTS_IPN_SECRET
 *   - verifyPixWebhook       : comparacao direta de X-Webhook-Secret
 *   - verifySupplierWebhook  : comparacao direta de X-Webhook-Secret
 */

'use strict';

const crypto = require('crypto');
const config = require('../config');

// ---------------------------------------------------------------------------
// Utilitario: comparacao timing-safe entre duas strings.
// Converte ambas para Buffer de tamanho igual antes de comparar,
// evitando vazamento de informacao via diferenca de tempo.
// ---------------------------------------------------------------------------
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Garante buffers de mesmo tamanho para timingSafeEqual
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  if (bufA.length !== bufB.length) {
    // Compara contra si mesmo para manter tempo constante
    // antes de retornar false — evita early-return side-channel.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// verifyNowPaymentsWebhook
//
// NOWPayments envia HMAC-SHA512 do JSON body (chaves ordenadas)
// no header "x-nowpayments-sig". Recalculamos e comparamos timing-safe.
// ---------------------------------------------------------------------------
function verifyNowPaymentsWebhook(req, res, next) {
  try {
    const secret = config.nowpaymentsIpnSecret;

    if (!secret) {
      console.error('[webhookAuth] NOWPAYMENTS_IPN_SECRET nao configurada.');
      return res.status(500).json({
        success: false,
        error: 'WEBHOOK_CONFIG_ERRO',
        message: 'Configuracao de webhook NOWPayments incompleta.',
      });
    }

    const receivedSignature =
      req.headers['x-nowpayments-sig'] || '';

    if (!receivedSignature) {
      return res.status(401).json({
        success: false,
        error: 'WEBHOOK_SEM_ASSINATURA',
        message: 'Header x-nowpayments-sig ausente na requisicao.',
      });
    }

    const sortedBody = JSON.stringify(sortObjectKeys(req.body || {}));

    const expectedSignature = crypto
      .createHmac('sha512', secret)
      .update(sortedBody)
      .digest('hex');

    if (!timingSafeCompare(receivedSignature, expectedSignature)) {
      console.warn('[webhookAuth] Assinatura NOWPayments invalida.');
      return res.status(401).json({
        success: false,
        error: 'WEBHOOK_ASSINATURA_INVALIDA',
        message: 'Assinatura HMAC do webhook NOWPayments invalida.',
      });
    }

    return next();
  } catch (err) {
    console.error('[webhookAuth] Erro ao verificar webhook NOWPayments:', err);
    return res.status(500).json({
      success: false,
      error: 'WEBHOOK_ERRO_INTERNO',
      message: 'Erro interno ao validar webhook.',
    });
  }
}

function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

// ---------------------------------------------------------------------------
// verifyPixWebhook
//
// O gateway PIX envia um segredo estatico no header X-Webhook-Secret.
// Comparamos timing-safe com PIX_WEBHOOK_SECRET configurado.
// ---------------------------------------------------------------------------
function verifyPixWebhook(req, res, next) {
  try {
    const secret = config.pixWebhookSecret;

    if (!secret) {
      console.error('[webhookAuth] PIX_WEBHOOK_SECRET nao configurada.');
      return res.status(500).json({
        success: false,
        error: 'WEBHOOK_CONFIG_ERRO',
        message: 'Configuracao de webhook PIX incompleta.',
      });
    }

    const receivedSecret = req.headers['x-webhook-secret'] || '';

    if (!receivedSecret) {
      return res.status(401).json({
        success: false,
        error: 'WEBHOOK_SEM_SEGREDO',
        message: 'Header X-Webhook-Secret ausente na requisicao.',
      });
    }

    if (!timingSafeCompare(receivedSecret, secret)) {
      console.warn('[webhookAuth] Segredo do webhook PIX invalido.');
      return res.status(401).json({
        success: false,
        error: 'WEBHOOK_SEGREDO_INVALIDO',
        message: 'Segredo do webhook PIX invalido.',
      });
    }

    return next();
  } catch (err) {
    console.error('[webhookAuth] Erro ao verificar webhook PIX:', err);
    return res.status(500).json({
      success: false,
      error: 'WEBHOOK_ERRO_INTERNO',
      message: 'Erro interno ao validar webhook PIX.',
    });
  }
}

// ---------------------------------------------------------------------------
// verifySupplierWebhook
//
// Callbacks do fornecedor seguem o mesmo padrao de segredo estatico
// no header X-Webhook-Secret, comparado com SUPPLIER_WEBHOOK_SECRET.
// ---------------------------------------------------------------------------
function verifySupplierWebhook(req, res, next) {
  try {
    const secret = config.supplierWebhookSecret;

    if (!secret) {
      console.error('[webhookAuth] SUPPLIER_WEBHOOK_SECRET nao configurada.');
      return res.status(500).json({
        success: false,
        error: 'WEBHOOK_CONFIG_ERRO',
        message: 'Configuracao de webhook do fornecedor incompleta.',
      });
    }

    const receivedSecret = req.headers['x-webhook-secret'] || '';

    if (!receivedSecret) {
      return res.status(401).json({
        success: false,
        error: 'WEBHOOK_SEM_SEGREDO',
        message: 'Header X-Webhook-Secret ausente na requisicao do fornecedor.',
      });
    }

    if (!timingSafeCompare(receivedSecret, secret)) {
      console.warn('[webhookAuth] Segredo do webhook do fornecedor invalido.');
      return res.status(401).json({
        success: false,
        error: 'WEBHOOK_SEGREDO_INVALIDO',
        message: 'Segredo do webhook do fornecedor invalido.',
      });
    }

    return next();
  } catch (err) {
    console.error('[webhookAuth] Erro ao verificar webhook do fornecedor:', err);
    return res.status(500).json({
      success: false,
      error: 'WEBHOOK_ERRO_INTERNO',
      message: 'Erro interno ao validar webhook do fornecedor.',
    });
  }
}

module.exports = {
  verifyNowPaymentsWebhook,
  verifyPixWebhook,
  verifySupplierWebhook,
};
