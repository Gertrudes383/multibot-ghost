/**
 * secretMasker.js
 *
 * CORREÇÃO: VULN-007 — Mascaramento de chaves de API e segredos.
 *
 * Impede que segredos (API keys, tokens, senhas) sejam expostos em logs,
 * respostas de API ou interfaces de administração. Exibe apenas os últimos
 * N caracteres, substituindo o restante por asteriscos.
 */

'use strict';

/**
 * Campos considerados sensíveis por padrão.
 * Qualquer campo cujo nome corresponda a um destes será mascarado automaticamente.
 */
const DEFAULT_SENSITIVE_FIELDS = [
  'api_key',
  'apiKey',
  'secret',
  'password',
  'token',
  'private_key',
  'privateKey',
  'webhook_secret',
  'webhookSecret',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'client_secret',
  'clientSecret',
  'encryption_key',
  'encryptionKey',
];

/**
 * Mascara um segredo, exibindo apenas os últimos N caracteres.
 *
 * @param {string} secret - O valor secreto a ser mascarado
 * @param {number} [visibleChars=4] - Quantidade de caracteres visíveis no final
 * @returns {string} - String mascarada (ex.: "****abcd")
 *
 * @example
 *   maskSecret('sk_live_abc123xyz789')       → '***************z789'
 *   maskSecret('minhasenha', 2)              → '********ha'
 *   maskSecret('ab', 4)                      → '**' (segredo menor que visibleChars)
 *   maskSecret('')                           → '[VAZIO]'
 */
function maskSecret(secret, visibleChars = 4) {
  // Validação de entrada
  if (secret === null || secret === undefined) {
    return '[NULO]';
  }

  // Converte para string caso não seja
  const str = String(secret);

  if (str.length === 0) {
    return '[VAZIO]';
  }

  // Garante que visibleChars é um número positivo
  const visible = Math.max(0, Math.min(Math.floor(visibleChars), str.length));

  // Se o segredo for menor ou igual ao número de caracteres visíveis,
  // mascara tudo por segurança (não revelar segredos curtos)
  if (str.length <= visible) {
    return '*'.repeat(str.length);
  }

  // Quantidade de caracteres a mascarar
  const maskedLength = str.length - visible;
  const maskedPart = '*'.repeat(maskedLength);
  const visiblePart = str.substring(maskedLength);

  return maskedPart + visiblePart;
}

/**
 * Mascara campos sensíveis em um objeto, retornando uma cópia segura.
 *
 * Itera sobre as propriedades do objeto e mascara aquelas cujo nome
 * corresponde à lista de campos sensíveis. Funciona recursivamente
 * para objetos aninhados.
 *
 * @param {object} obj - Objeto contendo possíveis campos sensíveis
 * @param {string[]} [sensitiveFields] - Lista de nomes de campos a mascarar
 * @param {number} [visibleChars=4] - Caracteres visíveis no mascaramento
 * @returns {object} - Nova cópia do objeto com campos sensíveis mascarados
 *
 * @example
 *   maskObjectSecrets({ name: 'Bot', api_key: 'sk_live_abc123' })
 *   → { name: 'Bot', api_key: '**********c123' }
 */
function maskObjectSecrets(obj, sensitiveFields = DEFAULT_SENSITIVE_FIELDS, visibleChars = 4) {
  // Validação de entrada
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  // Arrays: processa cada elemento recursivamente
  if (Array.isArray(obj)) {
    return obj.map(item => maskObjectSecrets(item, sensitiveFields, visibleChars));
  }

  // Converte a lista de campos para um Set para buscas O(1)
  const fieldsSet = new Set(sensitiveFields);

  // Cria um novo objeto para não modificar o original
  const masked = {};

  for (const [key, value] of Object.entries(obj)) {
    if (fieldsSet.has(key) && typeof value === 'string') {
      // Campo sensível encontrado — mascara o valor
      masked[key] = maskSecret(value, visibleChars);
    } else if (value !== null && typeof value === 'object') {
      // Objeto ou array aninhado — processa recursivamente
      masked[key] = maskObjectSecrets(value, sensitiveFields, visibleChars);
    } else {
      // Campo normal — copia sem alteração
      masked[key] = value;
    }
  }

  return masked;
}

module.exports = {
  maskSecret,
  maskObjectSecrets,
  DEFAULT_SENSITIVE_FIELDS,
};
