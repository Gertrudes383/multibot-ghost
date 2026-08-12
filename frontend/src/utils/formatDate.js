/**
 * Utilitarios para formatacao de datas no padrao brasileiro.
 */

/**
 * Formata uma data para o padrao brasileiro completo.
 *
 * @param {string|Date} date - Data a ser formatada (ISO string ou Date)
 * @returns {string} Data formatada (ex: "10/08/2026 14:30")
 */
export function formatDate(date) {
  if (!date) return '-';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Formata uma data para exibicao curta (apenas data).
 *
 * @param {string|Date} date - Data a ser formatada
 * @returns {string} Data formatada (ex: "10/08/2026")
 */
export function formatShortDate(date) {
  if (!date) return '-';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Retorna uma descricao relativa do tempo (ex: "ha 5 minutos").
 *
 * @param {string|Date} date - Data de referencia
 * @returns {string} Tempo relativo em portugues
 */
export function timeAgo(date) {
  if (!date) return '-';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 60) return 'agora mesmo';
  if (seconds < 3600) return `ha ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `ha ${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `ha ${Math.floor(seconds / 86400)} dias`;

  return formatShortDate(date);
}
