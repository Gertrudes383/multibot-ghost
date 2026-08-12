'use strict';

const axios = require('axios');
const config = require('../config');

const REQUEST_TIMEOUT_MS = 15000;

const STATUS_MAP = Object.freeze({
  waiting: 'pending',
  confirming: 'pending',
  confirmed: 'paid',
  sending: 'pending',
  partially_paid: 'partially_paid',
  finished: 'paid',
  failed: 'cancelled',
  refunded: 'cancelled',
  expired: 'expired',
});

const SUPPORTED_CURRENCIES = [
  { symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', minDeposit: 0.0001, enabled: true },
  { symbol: 'ETH', name: 'Ethereum', network: 'ethereum', minDeposit: 0.005, enabled: true },
  { symbol: 'USDT', name: 'Tether (TRC20)', network: 'tron', minDeposit: 5.0, enabled: true },
  { symbol: 'LTC', name: 'Litecoin', network: 'litecoin', minDeposit: 0.01, enabled: true },
  { symbol: 'DOGE', name: 'Dogecoin', network: 'dogecoin', minDeposit: 10.0, enabled: true },
  { symbol: 'TRX', name: 'TRON', network: 'tron', minDeposit: 10.0, enabled: true },
];

const normalizeEndpoint = (raw) => String(raw || config.nowpaymentsEndpoint || 'https://api.nowpayments.io').replace(/\/+$/, '');

const resolveApiKey = () => {
  const apiKey = String(config.nowpaymentsApiKey || '').trim();
  if (!apiKey) {
    const err = new Error('NOWPAYMENTS_API_KEY nao configurada.');
    err.statusCode = 500;
    throw err;
  }
  return apiKey;
};

const toAmount = (value, decimals = 2) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('Valor invalido para pagamento cripto.');
    err.statusCode = 400;
    throw err;
  }
  return Number(amount.toFixed(decimals));
};

const nowRequest = async ({ path, method = 'GET', body = null }) => {
  const endpoint = normalizeEndpoint();
  const apiKey = resolveApiKey();
  const url = `${endpoint}${path}`;

  const headers = {
    Accept: 'application/json',
    'x-api-key': apiKey,
  };
  if (body) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await axios({
      url,
      method,
      headers,
      data: body || undefined,
      timeout: REQUEST_TIMEOUT_MS,
    });
  } catch (err) {
    const status = err.response?.status || 'network';
    const reason = err.response?.data?.message || err.message;
    throw new Error(`crypto:nowpayments:http_${status}:${reason}`);
  }

  const payload = response.data || {};
  if (payload.success === false) {
    throw new Error(`crypto:nowpayments:api_error:${payload.message || 'request_failed'}`);
  }

  return payload;
};

class CryptoService {
  async generateCryptoInvoice(amountBrl, currency, userId, botId) {
    const payCurrency = String(currency || '').trim().toLowerCase();
    const supported = SUPPORTED_CURRENCIES.find(
      (c) => c.symbol.toLowerCase() === payCurrency && c.enabled
    );
    if (!supported) {
      const err = new Error(`Moeda '${currency}' nao suportada.`);
      err.statusCode = 400;
      throw err;
    }

    const priceAmount = toAmount(amountBrl, 2);
    const orderId = `mb-${String(botId || 'global').slice(-8)}-${String(userId).slice(-12)}-${Date.now()}`;

    const body = {
      price_amount: priceAmount,
      price_currency: 'brl',
      pay_currency: payCurrency,
      order_id: orderId,
      order_description: `${supported.symbol} deposit`,
    };

    if (config.nowpaymentsCallbackUrl) {
      body.ipn_callback_url = config.nowpaymentsCallbackUrl;
    }

    const payload = await nowRequest({
      path: '/v1/payment',
      method: 'POST',
      body,
    });

    const invoiceId = String(payload.payment_id || payload.id || '').trim();
    const address = String(payload.pay_address || payload.payment_address || '').trim();
    const amountCrypto = Number(payload.pay_amount || 0);

    if (!invoiceId) throw new Error('crypto:nowpayments:missing_payment_id');
    if (!address) throw new Error('crypto:nowpayments:missing_pay_address');

    return {
      invoiceId,
      address,
      amountCrypto,
      amountFiat: priceAmount,
      currency: supported.symbol,
      network: supported.network,
      orderId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  async checkCryptoStatus(invoiceId) {
    const paymentId = String(invoiceId || '').trim();
    if (!paymentId) {
      const err = new Error('ID do invoice e obrigatorio.');
      err.statusCode = 400;
      throw err;
    }

    const payload = await nowRequest({
      path: `/v1/payment/${encodeURIComponent(paymentId)}`,
    });

    const rawStatus = String(payload.payment_status || payload.status || '').trim().toLowerCase();
    const status = STATUS_MAP[rawStatus] || 'pending';

    const result = {
      invoiceId: paymentId,
      status,
      rawStatus,
      actuallyPaid: Number(payload.actually_paid || 0),
      payAmount: Number(payload.pay_amount || 0),
      priceAmount: Number(payload.price_amount || 0),
      payCurrency: String(payload.pay_currency || '').toLowerCase(),
      priceCurrency: String(payload.price_currency || '').toLowerCase(),
      hash: String(payload.payin_hash || payload.txid || '').trim() || null,
      paidAt: null,
    };

    if (status === 'paid') {
      const raw = payload.updated_at || payload.created_at;
      result.paidAt = raw ? new Date(raw) : new Date();
      if (Number.isNaN(result.paidAt.getTime())) result.paidAt = new Date();
    }

    return result;
  }

  async processCryptoCallback(callbackData) {
    const paymentId = String(
      callbackData.payment_id || callbackData.id || callbackData.invoiceId || ''
    ).trim();

    if (!paymentId) {
      const err = new Error('payment_id ausente no callback NOWPayments.');
      err.statusCode = 400;
      throw err;
    }

    const rawStatus = String(callbackData.payment_status || callbackData.status || '').toLowerCase();
    const status = STATUS_MAP[rawStatus] || 'pending';

    if (status !== 'paid' && status !== 'partially_paid') {
      return { processed: false, invoiceId: paymentId, action: `status_ignorado:${rawStatus}` };
    }

    const orderId = String(callbackData.order_id || '').trim();
    const actuallyPaid = Number(callbackData.actually_paid || 0);
    const priceAmount = Number(callbackData.price_amount || 0);
    const payCurrency = String(callbackData.pay_currency || '').toLowerCase();
    const hash = String(callbackData.payin_hash || '').trim() || null;

    return {
      processed: true,
      invoiceId: paymentId,
      orderId,
      status,
      actuallyPaid,
      priceAmount,
      payCurrency,
      hash,
      action: 'ready_to_credit',
    };
  }

  async getEstimate(amountBrl, currency) {
    const payCurrency = String(currency || '').trim().toLowerCase();
    const amount = toAmount(amountBrl, 2);

    const payload = await nowRequest({
      path: `/v1/estimate?amount=${encodeURIComponent(amount)}&currency_from=brl&currency_to=${encodeURIComponent(payCurrency)}`,
    });

    const estimatedAmount = Number(payload.estimated_amount || payload.amount_to || 0);
    if (!Number.isFinite(estimatedAmount) || estimatedAmount <= 0) {
      throw new Error(`crypto:nowpayments:estimate_invalid:${estimatedAmount}`);
    }

    return {
      amountBrl: amount,
      amountCrypto: estimatedAmount,
      currency: payCurrency.toUpperCase(),
      rateBrl: Number((amount / estimatedAmount).toFixed(8)),
    };
  }

  async getSupportedCurrencies() {
    return SUPPORTED_CURRENCIES.filter((c) => c.enabled);
  }
}

module.exports = new CryptoService();
