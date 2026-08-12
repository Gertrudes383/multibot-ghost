'use strict';

const escapeHtml = (text) => String(text || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const bold = (text) => `<b>${escapeHtml(text)}</b>`;
const italic = (text) => `<i>${escapeHtml(text)}</i>`;
const code = (text) => `<code>${escapeHtml(text)}</code>`;
const link = (text, url) => `<a href="${url}">${escapeHtml(text)}</a>`;

const currency = (value) => {
  const num = Number(value || 0);
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
};

const separator = (char = '─', length = 20) => char.repeat(length);

const statusEmoji = (status) => {
  const map = {
    active: '🟢', running: '🟢', online: '🟢', completed: '✅', paid: '✅',
    pending: '🟡', waiting: '🟡', confirming: '🟡', processing: '⏳',
    inactive: '🔴', stopped: '🔴', error: '❌', failed: '❌', cancelled: '🚫',
    expired: '⏰', maintenance: '🔧', restarting: '🔄',
  };
  return map[String(status).toLowerCase()] || '⚪';
};

const cardMask = (bin) => `${String(bin || '').slice(0, 6)}******`;

const truncate = (text, max = 100) => {
  const str = String(text || '');
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
};

const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

const formatUptime = (seconds) => {
  const s = Math.floor(Number(seconds || 0));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
};

module.exports = {
  escapeHtml, bold, italic, code, link,
  currency, separator, statusEmoji, cardMask,
  truncate, formatDate, formatUptime,
};
