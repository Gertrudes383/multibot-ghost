'use strict';

/**
 * CardPaginator — Sistema de paginação de cards com preview mascarado.
 *
 * Porta do V2 Python (buy_cc.py preView/handle_navigation):
 * - Armazena estado de navegação por usuário
 * - Mostra card mascarado com botões ←/→ e ±50
 * - Encripta ID do card no callback_data via Security
 */

const Security = require('./Security');

class CardPaginator {
  constructor() {
    // userId -> { cards: [cardIds], index: number, filters: {}, ts: number }
    this._state = new Map();
  }

  destroy() {
    this._state.clear();
  }

  /**
   * Inicializa paginação com uma lista de card IDs e filtros usados.
   */
  init(userId, cardIds, filters = {}) {
    this._state.set(String(userId), {
      cards: cardIds,
      index: 0,
      filters,
      ts: Date.now(),
    });
  }

  /**
   * Retorna o card ID atual e informações de navegação.
   * @returns {{ cardId: string, encryptedId: string, index: number, total: number } | null}
   */
  current(userId) {
    const state = this._getValid(userId);
    if (!state || state.cards.length === 0) return null;

    const cardId = state.cards[state.index];
    return {
      cardId,
      encryptedId: Security.encryptId(cardId),
      index: state.index,
      total: state.cards.length,
    };
  }

  /**
   * Avança para o próximo card.
   */
  next(userId) {
    const state = this._getValid(userId);
    if (!state) return null;

    state.index = Math.min(state.index + 1, state.cards.length - 1);
    state.ts = Date.now();
    return this.current(userId);
  }

  /**
   * Volta para o card anterior.
   */
  prev(userId) {
    const state = this._getValid(userId);
    if (!state) return null;

    state.index = Math.max(state.index - 1, 0);
    state.ts = Date.now();
    return this.current(userId);
  }

  /**
   * Avança 50 cards.
   */
  next50(userId) {
    const state = this._getValid(userId);
    if (!state) return null;

    state.index = Math.min(state.index + 50, state.cards.length - 1);
    state.ts = Date.now();
    return this.current(userId);
  }

  /**
   * Volta 50 cards.
   */
  prev50(userId) {
    const state = this._getValid(userId);
    if (!state) return null;

    state.index = Math.max(state.index - 50, 0);
    state.ts = Date.now();
    return this.current(userId);
  }

  /**
   * Retorna os filtros da sessão de navegação.
   */
  getFilters(userId) {
    const state = this._getValid(userId);
    return state?.filters || null;
  }

  /**
   * Limpa a paginação do usuário.
   */
  clear(userId) {
    this._state.delete(String(userId));
  }

  /**
   * Limpa paginações expiradas (>30 min).
   */
  cleanup() {
    const now = Date.now();
    for (const [uid, state] of this._state) {
      if (now - state.ts > 30 * 60 * 1000) {
        this._state.delete(uid);
      }
    }
  }

  _getValid(userId) {
    const state = this._state.get(String(userId));
    if (!state) return null;
    // Expirar após 30 minutos
    if (Date.now() - state.ts > 30 * 60 * 1000) {
      this._state.delete(String(userId));
      return null;
    }
    return state;
  }
}

module.exports = CardPaginator;
