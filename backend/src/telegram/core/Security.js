'use strict';

/**
 * Security — Cifra de IDs para callback_data.
 *
 * Porta do V2 Python (security.py):
 * - Cifra baseada em seed diária para ofuscar IDs de cards em callback_data
 * - Previne usuários de adivinhar/spoofar IDs
 *
 * Em Node, usamos crypto para gerar uma cifra mais robusta baseada em HMAC.
 */

const crypto = require('crypto');

const SECRET_KEY = process.env.CARD_CIPHER_SECRET || 'multibot-ghost-cipher-v3';

class Security {
  /**
   * Encripta um ID para uso em callback_data.
   * Resultado é hex string curta e segura.
   */
  static encryptId(id) {
    const idStr = String(id);
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const hmac = crypto.createHmac('sha256', `${SECRET_KEY}-${day}`);
    hmac.update(idStr);
    const signature = hmac.digest('hex').slice(0, 8);
    // Encode: base64url do ID + signature
    const encoded = Buffer.from(idStr).toString('base64url');
    return `${encoded}.${signature}`;
  }

  /**
   * Decripta e valida um ID de callback_data.
   * Retorna o ID original ou null se inválido/expirado.
   */
  static decryptId(token) {
    if (!token || !token.includes('.')) return null;

    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;

    let idStr;
    try {
      idStr = Buffer.from(encoded, 'base64url').toString('utf-8');
    } catch {
      return null;
    }

    // Verificar com assinatura do dia atual
    const day = new Date().toISOString().slice(0, 10);
    const hmac = crypto.createHmac('sha256', `${SECRET_KEY}-${day}`);
    hmac.update(idStr);
    const expectedSig = hmac.digest('hex').slice(0, 8);

    if (signature === expectedSig) return idStr;

    // Tentar dia anterior (para tokens criados perto da meia-noite)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const hmacYesterday = crypto.createHmac('sha256', `${SECRET_KEY}-${yesterday}`);
    hmacYesterday.update(idStr);
    const yesterdaySig = hmacYesterday.digest('hex').slice(0, 8);

    if (signature === yesterdaySig) return idStr;

    return null;
  }

  /**
   * Gera um código aleatório (para gift cards, etc).
   */
  static generateCode(length = 16) {
    return crypto.randomBytes(length).toString('hex').toUpperCase().slice(0, length);
  }
}

module.exports = Security;
