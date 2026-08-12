export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

export function formatDate(date) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}

export function formatDateTime(date) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}

export function formatNumber(n) {
  return new Intl.NumberFormat('pt-BR').format(n || 0);
}

export function maskToken(token) {
  if (!token || token.length < 10) return '***';
  return token.slice(0, 6) + '...' + token.slice(-4);
}
