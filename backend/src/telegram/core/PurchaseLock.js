'use strict';

/**
 * PurchaseLock — Previne compras concorrentes por usuário.
 *
 * Porta do V2 Python:
 * - lock_user_buy() — seta is_action_pending e previne double-buy
 * - lock_navigation() — previne navegação concorrente
 */

class PurchaseLock {
  constructor() {
    // userId -> true (compra em andamento)
    this._buyLocks = new Set();
    // userId -> true (navegação em andamento)
    this._navLocks = new Set();
  }

  destroy() {
    this._buyLocks.clear();
    this._navLocks.clear();
  }

  /**
   * Tenta adquirir lock de compra para o usuário.
   * @returns {boolean} true se o lock foi adquirido
   */
  acquireBuyLock(userId) {
    const uid = String(userId);
    if (this._buyLocks.has(uid)) return false;
    this._buyLocks.add(uid);
    return true;
  }

  /**
   * Libera o lock de compra.
   */
  releaseBuyLock(userId) {
    this._buyLocks.delete(String(userId));
  }

  /**
   * Verifica se o usuário tem lock de compra ativo.
   */
  hasBuyLock(userId) {
    return this._buyLocks.has(String(userId));
  }

  /**
   * Tenta adquirir lock de navegação.
   */
  acquireNavLock(userId) {
    const uid = String(userId);
    if (this._navLocks.has(uid)) return false;
    this._navLocks.add(uid);
    return true;
  }

  /**
   * Libera o lock de navegação.
   */
  releaseNavLock(userId) {
    this._navLocks.delete(String(userId));
  }

  hasNavLock(userId) {
    return this._navLocks.has(String(userId));
  }

  /**
   * Wrapper para executar com lock de compra.
   * @param {string} userId
   * @param {Function} fn - async function
   */
  async withBuyLock(userId, fn) {
    if (!this.acquireBuyLock(userId)) {
      const err = new Error('⏳ Aguarde a compra anterior finalizar.');
      err.statusCode = 429;
      throw err;
    }
    try {
      return await fn();
    } finally {
      this.releaseBuyLock(userId);
    }
  }

  /**
   * Wrapper para executar com lock de navegação.
   */
  async withNavLock(userId, fn) {
    if (!this.acquireNavLock(userId)) {
      return null; // silencioso na navegação
    }
    try {
      return await fn();
    } finally {
      this.releaseNavLock(userId);
    }
  }
}

module.exports = PurchaseLock;
