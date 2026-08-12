'use strict';

/**
 * AntiFlood — Sistema anti-flood por bot instance.
 *
 * Porta do V2 Python (antiflood.py):
 * - 5 mensagens de texto em 5s = ban temporário
 * - 8 callbacks em 5s = ban temporário
 * - Ban temporário de 30s (CRITICAL) com notificação ao admin
 * - Cooldown de 1s entre callbacks (anti_flood_callback)
 */

const FLOOD_WINDOW_MS = 5000;
const TEXT_THRESHOLD = 5;
const CALLBACK_THRESHOLD = 8;
const TEMP_BAN_DURATION_MS = 30 * 1000;
const CALLBACK_COOLDOWN_MS = 1000;

class AntiFlood {
  constructor() {
    // userId -> { texts: [timestamp], callbacks: [timestamp] }
    this._events = new Map();
    // userId -> unbanTimestamp
    this._tempBans = new Map();
    // userId -> lastCallbackTimestamp
    this._lastCallback = new Map();

    // Limpar eventos antigos a cada 30s
    this._cleanupTimer = setInterval(() => this._cleanup(), 30000);
  }

  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    this._events.clear();
    this._tempBans.clear();
    this._lastCallback.clear();
  }

  /**
   * Verifica se o usuário está banido temporariamente.
   * @returns {boolean}
   */
  isBanned(userId) {
    const unbanAt = this._tempBans.get(String(userId));
    if (!unbanAt) return false;
    if (Date.now() >= unbanAt) {
      this._tempBans.delete(String(userId));
      return false;
    }
    return true;
  }

  /**
   * Desbanir manualmente.
   */
  unban(userId) {
    this._tempBans.delete(String(userId));
  }

  /**
   * Registra evento de texto e verifica flood.
   * @returns {{ banned: boolean, level: string|null }}
   */
  checkText(userId) {
    const uid = String(userId);
    if (this.isBanned(uid)) return { banned: true, level: 'BANNED' };

    const now = Date.now();
    const entry = this._getEntry(uid);
    entry.texts.push(now);

    // Limpar eventos fora da janela
    entry.texts = entry.texts.filter((t) => now - t < FLOOD_WINDOW_MS);

    if (entry.texts.length >= TEXT_THRESHOLD) {
      this._tempBans.set(uid, now + TEMP_BAN_DURATION_MS);
      entry.texts = [];
      return { banned: true, level: 'CRITICAL' };
    }

    return { banned: false, level: null };
  }

  /**
   * Registra evento de callback e verifica flood + cooldown.
   * @returns {{ blocked: boolean, reason: string|null }}
   */
  checkCallback(userId) {
    const uid = String(userId);
    if (this.isBanned(uid)) return { blocked: true, reason: 'BANNED' };

    const now = Date.now();

    // Cooldown de 1s entre callbacks
    const lastCb = this._lastCallback.get(uid) || 0;
    if (now - lastCb < CALLBACK_COOLDOWN_MS) {
      return { blocked: true, reason: 'COOLDOWN' };
    }
    this._lastCallback.set(uid, now);

    const entry = this._getEntry(uid);
    entry.callbacks.push(now);

    // Limpar eventos fora da janela
    entry.callbacks = entry.callbacks.filter((t) => now - t < FLOOD_WINDOW_MS);

    if (entry.callbacks.length >= CALLBACK_THRESHOLD) {
      this._tempBans.set(uid, now + TEMP_BAN_DURATION_MS);
      entry.callbacks = [];
      return { blocked: true, reason: 'CRITICAL' };
    }

    return { blocked: false, reason: null };
  }

  _getEntry(uid) {
    if (!this._events.has(uid)) {
      this._events.set(uid, { texts: [], callbacks: [] });
    }
    return this._events.get(uid);
  }

  _cleanup() {
    const now = Date.now();

    // Limpar bans expirados
    for (const [uid, unbanAt] of this._tempBans) {
      if (now >= unbanAt) this._tempBans.delete(uid);
    }

    // Limpar entries antigas
    for (const [uid, entry] of this._events) {
      entry.texts = entry.texts.filter((t) => now - t < FLOOD_WINDOW_MS);
      entry.callbacks = entry.callbacks.filter((t) => now - t < FLOOD_WINDOW_MS);
      if (entry.texts.length === 0 && entry.callbacks.length === 0) {
        this._events.delete(uid);
      }
    }

    // Limpar lastCallback antigos (>60s)
    for (const [uid, ts] of this._lastCallback) {
      if (now - ts > 60000) this._lastCallback.delete(uid);
    }
  }
}

module.exports = AntiFlood;
