'use strict';

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const { PixSetting } = require('../../database/schemas');

const REQUEST_TIMEOUT_MS = 12000;
const DEFAULT_ENDPOINTS = {
  primepix: 'https://primepix.finance',
  'easy-pix': 'https://api.easy-pix.com',
};

const STATUS_MAP_PRIMEPIX = Object.freeze({
  waiting: 'pending',
  verified: 'paid',
  expired: 'expired',
  cancelled: 'cancelled',
});

const STATUS_MAP_EASYPIX = Object.freeze({
  waiting: 'pending',
  pending: 'pending',
  processing: 'pending',
  expired: 'expired',
  verified: 'paid',
  paid: 'paid',
  approved: 'paid',
  refunded: 'cancelled',
  cancelled: 'cancelled',
  canceled: 'cancelled',
});

const normalizeEndpoint = (raw, provider) => {
  const base = String(raw || DEFAULT_ENDPOINTS[provider] || '').replace(/\/+$/, '');
  if (!base) throw new Error(`pix:${provider}:missing_endpoint`);
  return base;
};

const resolveUserId = (userId) => {
  const value = String(userId || '').trim();
  if (!value) throw new Error('pix:missing_user_id');
  const digitsOnly = value.replace(/\D/g, '');
  return (digitsOnly || value).slice(-12).padStart(12, '0');
};

class PixService {
  async _loadSettings(ownerId, botId, withSecret = false) {
    let query = PixSetting.findOne({ owner_id: ownerId, bot_id: botId });
    if (withSecret) query = query.select('+api_key +webhook_secret');
    const settings = await query.lean();

    if (!settings || !settings.enabled) {
      const err = new Error('PIX nao esta habilitado para este bot.');
      err.statusCode = 400;
      throw err;
    }
    return settings;
  }

  async generatePixCharge(ownerId, botId, amount, userId) {
    const settings = await this._loadSettings(ownerId, botId, true);

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      const err = new Error('Valor da recarga deve ser positivo.');
      err.statusCode = 400;
      throw err;
    }
    if (amountNum < settings.min_amount) {
      const err = new Error(`Valor minimo: R$ ${settings.min_amount}`);
      err.statusCode = 400;
      throw err;
    }
    if (amountNum > settings.max_amount) {
      const err = new Error(`Valor maximo: R$ ${settings.max_amount}`);
      err.statusCode = 400;
      throw err;
    }

    if (!settings.api_key) {
      const err = new Error('Chave de API PIX nao configurada.');
      err.statusCode = 500;
      throw err;
    }

    const provider = settings.provider;
    const endpoint = normalizeEndpoint(settings.endpoint || config.pixGatewayUrl, provider);
    let result;

    if (provider === 'primepix') {
      result = await this._createPrimePix(endpoint, settings.api_key, amountNum, userId);
    } else if (provider === 'easy-pix') {
      result = await this._createEasyPix(endpoint, settings.api_key, amountNum, userId, settings.expiration_minutes);
    } else {
      const err = new Error(`Provedor PIX '${provider}' nao tem integracao automatica.`);
      err.statusCode = 400;
      throw err;
    }

    const fee = PixSetting.prototype.calculateFee.call(settings, amountNum);

    return {
      txid: result.txid,
      qrCode: result.wallet,
      copyPaste: result.wallet,
      provider,
      fee,
      expiresInMinutes: settings.expiration_minutes,
    };
  }

  async _createPrimePix(endpoint, apiKey, amountBrl, userId) {
    const resolvedUserId = resolveUserId(userId);
    const amountPath = amountBrl.toFixed(2);
    const url = `${endpoint}/api/v1/pix/${encodeURIComponent(apiKey)}/${encodeURIComponent(amountPath)}/${encodeURIComponent(resolvedUserId)}`;

    let response;
    try {
      response = await axios.get(url, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      const status = err.response?.status || 'network';
      throw new Error(`pix:primepix:http_${status}:${err.message}`);
    }

    const payload = response.data || {};
    if (payload.success === false) {
      throw new Error(`pix:primepix:api_error:${payload.message || 'request_failed'}`);
    }

    const data = payload.data || {};
    const txid = String(data.id || data.pixId || data.pix_id || '').trim();
    const wallet = String(data.pixCode || data.pix_code || data.code || '').trim();

    if (!txid) throw new Error('pix:primepix:missing_txid');
    if (!wallet) throw new Error('pix:primepix:missing_wallet');

    return { txid, wallet };
  }

  async _createEasyPix(endpoint, apiKey, amountBrl, userId, expirationMinutes = 30) {
    const amountCents = Math.round((amountBrl + Number.EPSILON) * 100);
    const idempotencyKey = `dep_${String(userId).slice(-12)}_${crypto.randomUUID()}`;

    let response;
    try {
      response = await axios.post(
        `${endpoint}/payments`,
        {
          amount: amountCents,
          currency: 'BRL',
          expirationMinutes,
          idempotencyKey,
          customer: { id: String(userId) },
        },
        {
          timeout: REQUEST_TIMEOUT_MS,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );
    } catch (err) {
      const status = err.response?.status || 'network';
      throw new Error(`pix:easy-pix:http_${status}:${err.message}`);
    }

    const payload = response.data || {};
    if (payload.success === false) {
      throw new Error(`pix:easy-pix:api_error:${payload.message || 'request_failed'}`);
    }

    const data = payload.data || payload;
    const txid = String(data.id || data.pixId || data.paymentId || '').trim();
    const wallet = String(
      data.code || data.pixCode || data.qrCode || data.brCode || data.copyPaste
      || data.method?.qrCode || data.method?.brCode || data.method?.copyPaste || ''
    ).trim();

    if (!txid) throw new Error('pix:easy-pix:missing_txid');
    if (!wallet) throw new Error('pix:easy-pix:missing_wallet');

    return { txid, wallet };
  }

  async checkPixStatus(ownerId, botId, txid) {
    const settings = await PixSetting.findOne({ owner_id: ownerId, bot_id: botId })
      .select('+api_key')
      .lean();

    if (!settings) {
      const err = new Error('Configuracao PIX nao encontrada.');
      err.statusCode = 404;
      throw err;
    }

    const provider = settings.provider;
    const endpoint = normalizeEndpoint(settings.endpoint || config.pixGatewayUrl, provider);

    if (provider === 'primepix') {
      return this._checkPrimePixStatus(endpoint, settings.api_key, txid);
    }
    if (provider === 'easy-pix') {
      return this._checkEasyPixStatus(endpoint, settings.api_key, txid);
    }

    const err = new Error(`Provedor PIX '${provider}' nao suporta verificacao de status.`);
    err.statusCode = 400;
    throw err;
  }

  async _checkPrimePixStatus(endpoint, apiKey, txid) {
    const url = `${endpoint}/api/v1/status/${encodeURIComponent(apiKey)}/${encodeURIComponent(txid)}`;

    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { Accept: 'application/json' },
    });

    const data = response.data?.data || {};
    const rawStatus = String(data.status || '').trim().toLowerCase();
    const mapped = STATUS_MAP_PRIMEPIX[rawStatus] || 'pending';

    if (mapped === 'paid') {
      const paidAtRaw = data.paidAt || data.paid_at || data.updatedAt || null;
      const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();
      return { status: 'paid', paidAt: Number.isNaN(paidAt.getTime()) ? new Date() : paidAt };
    }

    return { status: mapped, paidAt: null };
  }

  async _checkEasyPixStatus(endpoint, apiKey, txid) {
    const url = `${endpoint}/payments/${encodeURIComponent(txid)}`;

    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = response.data?.data || response.data || {};
    const rawStatus = String(data.status || '').trim().toLowerCase();
    const mapped = STATUS_MAP_EASYPIX[rawStatus] || 'pending';

    if (mapped === 'paid') {
      const paidAtRaw = data.paidAt || data.paid_at || data.updatedAt || null;
      const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();
      return { status: 'paid', paidAt: Number.isNaN(paidAt.getTime()) ? new Date() : paidAt };
    }

    return { status: mapped, paidAt: null };
  }

  async processPixCallback(callbackData) {
    const txnId = callbackData.txid || callbackData.txn_id || callbackData.id || callbackData.pixId;
    if (!txnId) {
      const err = new Error('txn_id ausente no callback PIX.');
      err.statusCode = 400;
      throw err;
    }

    const rawStatus = String(callbackData.status || '').toLowerCase();
    const isPaid = rawStatus === 'paid' || rawStatus === 'verified' || rawStatus === 'approved';
    if (!isPaid) {
      return { processed: false, txnId, action: `status_ignorado:${rawStatus}` };
    }

    return { processed: true, txnId, action: 'ready_to_credit' };
  }

  async getPixSettings(ownerId, botId) {
    const settings = await PixSetting.getForBot(ownerId, botId);
    if (!settings) return null;

    return {
      enabled: settings.enabled,
      provider: settings.provider,
      endpoint: settings.endpoint,
      fee_type: settings.fee_type,
      fee_value: settings.fee_value,
      min_amount: settings.min_amount,
      max_amount: settings.max_amount,
      daily_limit: settings.daily_limit,
      hourly_limit: settings.hourly_limit,
      cooldown_minutes: settings.cooldown_minutes,
      expiration_minutes: settings.expiration_minutes,
    };
  }

  async updatePixSettings(ownerId, botId, updates) {
    const allowedFields = [
      'enabled', 'provider', 'endpoint', 'api_key', 'webhook_secret',
      'fee_type', 'fee_value', 'min_amount', 'max_amount',
      'daily_limit', 'hourly_limit', 'cooldown_minutes', 'expiration_minutes',
    ];

    const sanitized = { owner_id: ownerId, bot_id: botId };
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        sanitized[key] = updates[key];
      }
    }

    const settings = await PixSetting.findOneAndUpdate(
      { owner_id: ownerId, bot_id: botId },
      { $set: sanitized },
      { new: true, upsert: true, runValidators: true }
    );

    return {
      enabled: settings.enabled,
      provider: settings.provider,
      endpoint: settings.endpoint,
      fee_type: settings.fee_type,
      fee_value: settings.fee_value,
      min_amount: settings.min_amount,
      max_amount: settings.max_amount,
      daily_limit: settings.daily_limit,
      hourly_limit: settings.hourly_limit,
      cooldown_minutes: settings.cooldown_minutes,
      expiration_minutes: settings.expiration_minutes,
    };
  }
}

module.exports = new PixService();
