'use strict';

/**
 * GateChecker — Sistema de verificação de cards via gates externos.
 *
 * Porta do V2 Python (gates.py):
 * - gate_off_check(): retorna live sem verificação
 * - generic_check(): HTTP request para gate URL com padrões live/die
 * - Auto-desabilita gate quando count_die >= limit_die
 */

const axios = require('axios');
const { CheckerSetting } = require('../../../database/schemas');

const GATE_TIMEOUT_MS = 30000;

class GateChecker {
  /**
   * Verificação "off" — sempre retorna live (venda sem check).
   */
  static gateOffCheck() {
    return { live: true, gateName: 'off', message: 'Gate OFF — sem verificação' };
  }

  /**
   * Verifica um card usando as configurações de checker do bot.
   *
   * @param {Object} cardData - { number, month, year, cvv }
   * @param {string} ownerId
   * @param {string} botId
   * @returns {{ live: boolean|null, gateName: string, message: string }}
   */
  static async check(cardData, ownerId, botId) {
    const settings = await CheckerSetting.findOne({
      owner_id: ownerId,
      bot_id: botId,
    }).lean();

    if (!settings || !settings.api_url) {
      return GateChecker.gateOffCheck();
    }

    if (!settings.enabled) {
      return GateChecker.gateOffCheck();
    }

    return GateChecker._genericCheck(cardData, settings);
  }

  /**
   * Verificação genérica via HTTP — porta do generic_check() do V2.
   */
  static async _genericCheck(cardData, gateConfig) {
    const { number, month, year, cvv } = cardData;
    const gateName = gateConfig.name || 'default';

    // Interpolar campos do card na URL
    let url = String(gateConfig.api_url || '');
    url = url
      .replace(/{number}/gi, number || '')
      .replace(/{mes}/gi, month || '')
      .replace(/{ano}/gi, year || '')
      .replace(/{cvv}/gi, cvv || '')
      .replace(/{cc}/gi, number || '')
      .replace(/{month}/gi, month || '')
      .replace(/{year}/gi, year || '');

    try {
      const method = (gateConfig.method || 'GET').toUpperCase();
      let response;

      if (method === 'POST') {
        const payload = {
          cc: number,
          mes: month,
          ano: year,
          cvv: cvv || '',
        };
        response = await axios.post(url, payload, {
          timeout: gateConfig.timeout || GATE_TIMEOUT_MS,
          headers: { Accept: '*/*' },
        });
      } else {
        // Se a URL já tem os parâmetros interpolados, usar GET direto
        // Senão, adicionar como query params
        if (!url.includes(number)) {
          const qs = new URLSearchParams({
            cc: number, mes: month, ano: year, cvv: cvv || '',
          }).toString();
          url = `${url}${url.includes('?') ? '&' : '?'}${qs}`;
        }

        response = await axios.get(url, {
          timeout: gateConfig.timeout || GATE_TIMEOUT_MS,
          headers: { Accept: '*/*' },
        });
      }

      const body = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      // Verificar padrões live/die
      const livePattern = gateConfig.success_keyword || gateConfig.live_pattern;
      const diePattern = gateConfig.fail_keyword || gateConfig.die_pattern;

      if (livePattern && body.includes(livePattern)) {
        return { live: true, gateName, message: body.substring(0, 200) };
      }

      if (diePattern && body.includes(diePattern)) {
        // Incrementar contador de dies para auto-disable
        if (gateConfig._id) {
          await CheckerSetting.findByIdAndUpdate(gateConfig._id, {
            $inc: { count_die: 1 },
          });
        }

        return { live: false, gateName, message: body.substring(0, 200) };
      }

      // Padrão error
      if (gateConfig.error_keyword && body.includes(gateConfig.error_keyword)) {
        return { live: null, gateName, message: `Gate error: ${body.substring(0, 200)}` };
      }

      // Sem match — tratar como desconhecido
      return { live: null, gateName, message: body.substring(0, 200) };
    } catch (err) {
      return {
        live: null,
        gateName,
        message: `Gate timeout/error: ${err.message}`,
      };
    }
  }
}

module.exports = GateChecker;
