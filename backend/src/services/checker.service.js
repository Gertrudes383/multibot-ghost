'use strict';

const axios = require('axios');
const mongoose = require('mongoose');
const { CheckerSetting, Card, ValidationLog } = require('../../database/schemas');

class CheckerService {
  constructor() {
    this._activeChecks = 0;
    this._queueSize = 0;
    this._checksLast24h = 0;
    this._liveLast24h = 0;
  }

  async checkCard(cardData, gateway, ownerId, botId) {
    const { number, expMonth, expYear, cvv } = cardData;
    if (!number || !expMonth || !expYear) {
      const err = new Error('Dados do card incompletos (number, expMonth, expYear obrigatórios)');
      err.statusCode = 400;
      throw err;
    }

    const settings = await CheckerSetting.getOrCreate(ownerId, botId);
    const startTime = Date.now();
    this._activeChecks++;

    try {
      const bin = number.substring(0, 6);
      const payload = {
        cc: number,
        mes: expMonth,
        ano: expYear,
        cvv: cvv || '',
      };

      let response;
      if (settings.method === 'POST') {
        response = await axios.post(settings.api_url, payload, { timeout: settings.timeout });
      } else {
        const qs = new URLSearchParams(payload).toString();
        response = await axios.get(`${settings.api_url}?${qs}`, { timeout: settings.timeout });
      }

      const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const responseTime = Date.now() - startTime;

      let status;
      if (body.includes(settings.success_keyword)) {
        status = 'live';
        this._liveLast24h++;
      } else if (body.includes(settings.fail_keyword)) {
        status = 'die';
      } else if (settings.error_keyword && body.includes(settings.error_keyword)) {
        status = 'error';
      } else {
        status = 'unknown';
      }

      this._checksLast24h++;

      return {
        status,
        message: body.substring(0, 200),
        gateway: 'default',
        responseCode: String(response.status),
        responseTime,
        bin,
        brand: cardData.brand || null,
        level: cardData.level || null,
        country: cardData.country || null,
      };
    } catch (err) {
      return {
        status: 'error',
        message: err.message,
        gateway: 'default',
        responseCode: String(err.response?.status || 0),
        responseTime: Date.now() - startTime,
        bin: number.substring(0, 6),
      };
    } finally {
      this._activeChecks--;
    }
  }

  async checkBatch(cards, gateway, options = {}) {
    if (!cards || cards.length === 0) {
      const err = new Error('Lista de cards vazia');
      err.statusCode = 400;
      throw err;
    }

    const { concurrency = 3, delayMs = 1000, onProgress, ownerId, botId } = options;
    const results = [];
    let live = 0;
    let die = 0;
    let errorCount = 0;
    let idx = 0;

    const processCard = async (card) => {
      const result = await this.checkCard(card, gateway, ownerId, botId);
      if (result.status === 'live') live++;
      else if (result.status === 'die') die++;
      else errorCount++;
      results.push({ ...card, result });

      if (onProgress) {
        onProgress({ checked: results.length, total: cards.length, last: result });
      }

      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    };

    const workers = [];
    for (let w = 0; w < Math.min(concurrency, cards.length); w++) {
      workers.push(
        (async () => {
          while (idx < cards.length) {
            const card = cards[idx++];
            await processCard(card);
          }
        })()
      );
    }

    await Promise.all(workers);

    return {
      total: cards.length,
      live,
      die,
      error: errorCount,
      results,
    };
  }

  async getAvailableGateways(ownerId, botId) {
    const settings = await CheckerSetting.findOne({
      owner_id: ownerId,
      bot_id: botId,
    }).lean();

    if (!settings) {
      return [{
        id: 'default',
        name: 'Checker Padrão',
        status: 'offline',
        approvalRate: 0,
        avgResponseTime: 0,
        maxConcurrency: 3,
      }];
    }

    return [{
      id: 'default',
      name: 'Checker Padrão',
      status: settings.api_url ? 'online' : 'offline',
      approvalRate: this._checksLast24h > 0
        ? Math.round((this._liveLast24h / this._checksLast24h) * 100)
        : 0,
      avgResponseTime: 0,
      maxConcurrency: settings.max_threads_per_user,
    }];
  }

  async getCheckerStatus() {
    return {
      activeChecks: this._activeChecks,
      queueSize: this._queueSize,
      activeGateways: this._activeChecks > 0 ? 1 : 0,
      totalGateways: 1,
      checksLast24h: this._checksLast24h,
      liveRateLast24h: this._checksLast24h > 0
        ? Math.round((this._liveLast24h / this._checksLast24h) * 100)
        : 0,
    };
  }
}

module.exports = new CheckerService();
