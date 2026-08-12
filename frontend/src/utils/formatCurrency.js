/**
 * Utilitario para formatacao de valores monetarios em Real Brasileiro (BRL).
 *
 * @param {number} value - Valor numerico a ser formatado
 * @returns {string} Valor formatado no padrao BRL (ex: "R$ 1.234,56")
 *
 * @example
 * formatCurrency(1234.56) // "R$ 1.234,56"
 * formatCurrency(0)        // "R$ 0,00"
 */
export function formatCurrency(value) {
  if (value == null || isNaN(value)) return 'R$ 0,00';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata um valor em centavos para Real Brasileiro.
 *
 * @param {number} cents - Valor em centavos
 * @returns {string} Valor formatado no padrao BRL
 */
export function formatCentsToReal(cents) {
  return formatCurrency(cents / 100);
}
