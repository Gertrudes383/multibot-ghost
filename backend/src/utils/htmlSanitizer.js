/**
 * htmlSanitizer.js
 *
 * CORREÇÃO: VULN-008 — Sanitização de HTML para prevenir XSS.
 *
 * Utiliza a biblioteca sanitize-html para remover tags e atributos perigosos,
 * permitindo apenas um subconjunto seguro de marcação HTML.
 *
 * Tags permitidas: b, i, em, strong, a (somente href), p, br, ul, ol, li
 * Todo o restante é removido (stripped).
 */

'use strict';

let sanitizeHtml;

try {
  sanitizeHtml = require('sanitize-html');
} catch (err) {
  // Fallback caso a dependência não esteja instalada.
  // Remove TODAS as tags HTML como medida de segurança.
  console.warn(
    '[htmlSanitizer] AVISO: pacote "sanitize-html" não encontrado. ' +
    'Usando fallback que remove todas as tags. ' +
    'Instale com: npm install sanitize-html'
  );
  sanitizeHtml = null;
}

/**
 * Configuração padrão do sanitize-html.
 * Define quais tags e atributos são permitidos.
 */
const SANITIZE_OPTIONS = {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
  allowedAttributes: {
    // Apenas <a> pode ter atributos, e somente href
    'a': ['href'],
  },
  allowedSchemes: ['https', 'http', 'mailto'],
  // Remove protocolos perigosos como javascript:, data:, vbscript:
  allowedSchemesByTag: {
    'a': ['https', 'http', 'mailto'],
  },
  // Não permitir atributos de estilo inline (prevenção de CSS injection)
  allowedStyles: {},
  // Remove tags não permitidas mas mantém seu conteúdo textual
  disallowedTagsMode: 'discard',
  // Configurações de segurança adicionais
  enforceHtmlBoundary: false,
  parseStyleAttributes: false,
};

/**
 * Remove tags HTML usando regex como fallback (quando sanitize-html não está disponível).
 * Essa é uma medida de emergência — a biblioteca sanitize-html é FORTEMENTE recomendada.
 *
 * @param {string} dirty - String HTML suja
 * @returns {string} - Texto sem tags HTML
 */
function fallbackStripAll(dirty) {
  if (typeof dirty !== 'string') return '';
  return dirty
    .replace(/<[^>]*>/g, '')       // Remove tags HTML
    .replace(/&lt;/g, '<')         // Decodifica entidades básicas
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')          // Normaliza espaços em branco
    .trim();
}

/**
 * Sanitiza uma string HTML, permitindo apenas tags e atributos seguros.
 *
 * Tags permitidas: b, i, em, strong, a (com href), p, br, ul, ol, li.
 * Tudo o que não estiver na lista é removido.
 *
 * @param {string} dirty - String HTML a ser sanitizada
 * @returns {string} - String HTML segura
 *
 * @example
 *   sanitize('<b>Negrito</b><script>alert("xss")</script>')
 *   → '<b>Negrito</b>'
 *
 *   sanitize('<a href="javascript:alert(1)">Link</a>')
 *   → '<a>Link</a>'
 */
function sanitize(dirty) {
  if (dirty === null || dirty === undefined) {
    return '';
  }

  const input = String(dirty);

  if (input.length === 0) {
    return '';
  }

  // Usa sanitize-html se disponível, senão remove tudo via fallback
  if (sanitizeHtml) {
    return sanitizeHtml(input, SANITIZE_OPTIONS);
  }

  // Fallback: remove todas as tags por segurança
  return fallbackStripAll(input);
}

/**
 * Sanitiza recursivamente todos os valores string dentro de um objeto.
 *
 * Percorre o objeto em profundidade e aplica sanitize() em cada string encontrada.
 * Arrays e objetos aninhados são processados recursivamente.
 * Valores não-string (números, booleanos, etc.) permanecem inalterados.
 *
 * @param {*} obj - Objeto, array ou valor a ser sanitizado
 * @returns {*} - Cópia do objeto com todas as strings sanitizadas
 *
 * @example
 *   sanitizeObject({ name: '<script>xss</script>Admin', count: 5 })
 *   → { name: 'Admin', count: 5 }
 */
function sanitizeObject(obj) {
  // Null/undefined retornados diretamente
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Strings são sanitizadas diretamente
  if (typeof obj === 'string') {
    return sanitize(obj);
  }

  // Tipos primitivos (número, boolean, etc.) retornados sem alteração
  if (typeof obj !== 'object') {
    return obj;
  }

  // Arrays: processa cada elemento
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  // Objetos: processa cada propriedade
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }

  return sanitized;
}

/**
 * Remove TODAS as tags HTML de uma string, retornando apenas texto puro.
 *
 * Útil para contextos onde nenhum HTML é aceitável (ex.: nomes de usuário,
 * campos de texto simples, valores de configuração).
 *
 * @param {string} dirty - String HTML a ser limpa
 * @returns {string} - Texto puro sem nenhuma tag HTML
 *
 * @example
 *   stripAll('<b>Olá</b> <a href="x">Mundo</a>!')
 *   → 'Olá Mundo!'
 */
function stripAll(dirty) {
  if (dirty === null || dirty === undefined) {
    return '';
  }

  const input = String(dirty);

  if (input.length === 0) {
    return '';
  }

  // Usa sanitize-html com nenhuma tag permitida
  if (sanitizeHtml) {
    return sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
    });
  }

  // Fallback via regex
  return fallbackStripAll(input);
}

module.exports = {
  sanitize,
  sanitizeObject,
  stripAll,
  SANITIZE_OPTIONS, // Exportado para testes ou customização
};
