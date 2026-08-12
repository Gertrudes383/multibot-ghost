/**
 * Utilitario para mascaramento de numeros de cartao de credito.
 * Exibe apenas os primeiros 6 e ultimos 4 digitos.
 */

/**
 * Mascara um numero de cartao de credito.
 *
 * @param {string} cardNumber - Numero do cartao (com ou sem espacos/hifens)
 * @returns {string} Numero mascarado (ex: "4539 12** **** 3456")
 */
export function maskCard(cardNumber) {
  if (!cardNumber) return '****';

  const cleaned = cardNumber.replace(/[\s-]/g, '');

  if (cleaned.length < 10) return '****';

  const first6 = cleaned.substring(0, 6);
  const last4 = cleaned.substring(cleaned.length - 4);
  const maskedMiddle = '*'.repeat(cleaned.length - 10);

  return `${first6}${maskedMiddle}${last4}`;
}

/**
 * Formata um numero de cartao mascarado com espacos a cada 4 digitos.
 *
 * @param {string} cardNumber - Numero do cartao
 * @returns {string} Numero mascarado e formatado (ex: "4539 12** **** 3456")
 */
export function formatMaskedCard(cardNumber) {
  const masked = maskCard(cardNumber);
  return masked.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Extrai a bandeira do cartao pelo BIN (primeiros 6 digitos).
 *
 * @param {string} bin - BIN do cartao (6 digitos)
 * @returns {string} Nome da bandeira (visa, mastercard, amex, etc.)
 */
export function getCardBrand(bin) {
  if (!bin) return 'unknown';

  const firstDigit = bin.charAt(0);
  const firstTwo = bin.substring(0, 2);

  if (firstDigit === '4') return 'visa';
  if (['51', '52', '53', '54', '55'].includes(firstTwo)) return 'mastercard';
  if (['34', '37'].includes(firstTwo)) return 'amex';
  if (['36', '38'].includes(firstTwo)) return 'diners';
  if (firstTwo === '35') return 'jcb';
  if (['60', '65'].includes(firstTwo)) return 'discover';
  if (firstTwo === '50') return 'elo';

  return 'unknown';
}
