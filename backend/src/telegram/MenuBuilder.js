'use strict';

/**
 * MenuBuilder V3 — Todos os menus inline do bot.
 *
 * Porta completa do V2 Python com todos os menus:
 * - Menu principal com emojis customizáveis
 * - Menu de compra com CC/Full/Mix/Por Banco
 * - Navegação de cards com ←/→ e ±50
 * - Menu de conta com saldo, histórico, diamantes, troca de pontos
 * - Menu de recarga PIX/Crypto/Manual
 * - Menu de troca (exchange)
 * - Painel admin completo
 */

const { currency, cardMask } = require('./utils/messageFormatter');

const e = (botConfig, key, fallback) => {
  const custom = botConfig?.metadata?.custom_emojis;
  return (custom && custom[key]) || fallback;
};

class MenuBuilder {
  // ─── MAIN ───
  static mainMenu(botConfig) {
    const keyboard = [];

    if (!botConfig.disable_purchases) {
      keyboard.push([{ text: `${e(botConfig, 'buy', '🛒')} Comprar`, callback_data: 'menu:buy' }]);
    }

    keyboard.push([{ text: `${e(botConfig, 'account', '👤')} Minha Conta`, callback_data: 'menu:account' }]);

    if (!botConfig.disable_pix) {
      keyboard.push([{ text: `${e(botConfig, 'recharge', '💰')} Adicionar Saldo`, callback_data: 'menu:recharge' }]);
    }

    if (botConfig.exchanges_enabled) {
      keyboard.push([{ text: `${e(botConfig, 'exchange', '🔄')} Trocas`, callback_data: 'menu:exchange' }]);
    }

    keyboard.push([{ text: `${e(botConfig, 'support', '📞')} Suporte`, callback_data: 'menu:support' }]);

    if (botConfig.referral_enabled) {
      keyboard.push([{ text: `${e(botConfig, 'referral', '🤝')} Indicações`, callback_data: 'menu:referral' }]);
    }

    return { reply_markup: { inline_keyboard: keyboard } };
  }

  // ─── BUY MENUS ───
  static buyTypeMenu() {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💳 CC', callback_data: 'buy:type:sem' },
            { text: '💳 CC Full', callback_data: 'buy:type:full' },
          ],
          [
            { text: '🔀 Mix', callback_data: 'buy:type:mix' },
            { text: '🏦 Por Banco', callback_data: 'buy:search:bank' },
          ],
          [
            { text: '🔍 Por BIN', callback_data: 'buy:search:bin' },
            { text: '🌍 Por País', callback_data: 'buy:search:country' },
          ],
          [{ text: '⬅️ Voltar', callback_data: 'menu:main' }],
        ],
      },
    };
  }

  static countryMenu(countries) {
    const keyboard = countries.slice(0, 20).map((c) => [{
      text: `${c.flag || '🌍'} ${c.country} (${c.count})`,
      callback_data: `buy:country:${c.country}`,
    }]);
    keyboard.push([{ text: '⬅️ Voltar', callback_data: 'menu:buy' }]);
    return { reply_markup: { inline_keyboard: keyboard } };
  }

  static levelMenu(levels, cardType) {
    const keyboard = levels.slice(0, 20).map((l) => [{
      text: `${l.level} — ${currency(l.price)} (${l.count})`,
      callback_data: `buy:level:${cardType}:${l.level}`,
    }]);
    keyboard.push([{ text: '⬅️ Voltar', callback_data: 'menu:buy' }]);
    return { reply_markup: { inline_keyboard: keyboard } };
  }

  static binMenu(bins, backCallback = 'menu:buy') {
    const keyboard = bins.slice(0, 20).map((b) => [{
      text: `${b.bin} ${b.brand || ''} — ${currency(b.price)} (${b.count})`,
      callback_data: `buy:bin:${b.bin}`,
    }]);
    keyboard.push([{ text: '⬅️ Voltar', callback_data: backCallback }]);
    return { reply_markup: { inline_keyboard: keyboard } };
  }

  static bankMenu(banks) {
    const keyboard = banks.slice(0, 20).map((b) => [{
      text: `🏦 ${b.bank} (${b.count})`,
      callback_data: `buy:bank:${b.bank}`,
    }]);
    keyboard.push([{ text: '⬅️ Voltar', callback_data: 'menu:buy' }]);
    return { reply_markup: { inline_keyboard: keyboard } };
  }

  // ─── CARD PREVIEW / NAVIGATION ───
  static cardPreviewMenu(encryptedId, navInfo) {
    const { index, total } = navInfo;
    const keyboard = [];

    // Navegação
    const navRow = [];
    if (index > 50) navRow.push({ text: '⏪ -50', callback_data: 'nav:prev50' });
    if (index > 0) navRow.push({ text: '◀️', callback_data: 'nav:prev' });
    navRow.push({ text: `${index + 1}/${total}`, callback_data: 'noop' });
    if (index < total - 1) navRow.push({ text: '▶️', callback_data: 'nav:next' });
    if (index < total - 51) navRow.push({ text: '+50 ⏩', callback_data: 'nav:next50' });

    if (navRow.length > 0) keyboard.push(navRow);

    // Botão de compra
    keyboard.push([{ text: '🛒 Comprar', callback_data: `buy:confirm:${encryptedId}` }]);

    // Auto-live (testar até 20)
    keyboard.push([{ text: '⚡ Auto Live (até 20)', callback_data: `buy:auto20:${encryptedId}` }]);

    // Voltar
    keyboard.push([{ text: '⬅️ Voltar', callback_data: 'menu:buy' }]);

    return { reply_markup: { inline_keyboard: keyboard } };
  }

  static confirmPurchaseMenu(card, price) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: `✅ Confirmar — ${currency(price)}`, callback_data: `buy:confirm:${card.bin}` }],
          [{ text: '❌ Cancelar', callback_data: 'menu:buy' }],
        ],
      },
    };
  }

  // ─── RECHARGE MENUS ───
  static rechargeMenu(botConfig) {
    const keyboard = [];

    if (!botConfig.disable_pix) {
      keyboard.push([{ text: '📱 PIX Automático', callback_data: 'recharge:pix' }]);
    }

    keyboard.push([{ text: '₿ Criptomoeda', callback_data: 'recharge:crypto' }]);
    keyboard.push([{ text: '🏦 Transferência Manual', callback_data: 'recharge:manual' }]);
    keyboard.push([{ text: '🎁 Resgatar Gift Card', callback_data: 'recharge:gift' }]);
    keyboard.push([{ text: '⬅️ Voltar', callback_data: 'menu:main' }]);

    return { reply_markup: { inline_keyboard: keyboard } };
  }

  static pixAmountMenu() {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'R$ 10', callback_data: 'recharge:pix:10' },
            { text: 'R$ 25', callback_data: 'recharge:pix:25' },
            { text: 'R$ 50', callback_data: 'recharge:pix:50' },
          ],
          [
            { text: 'R$ 100', callback_data: 'recharge:pix:100' },
            { text: 'R$ 200', callback_data: 'recharge:pix:200' },
            { text: 'R$ 500', callback_data: 'recharge:pix:500' },
          ],
          [{ text: '✏️ Outro Valor', callback_data: 'recharge:pix:custom' }],
          [{ text: '⬅️ Voltar', callback_data: 'menu:recharge' }],
        ],
      },
    };
  }

  static cryptoCurrencyMenu(currencies) {
    const keyboard = currencies.filter((c) => c.enabled).map((c) => [{
      text: `${c.symbol} — ${c.name}`,
      callback_data: `recharge:crypto:${c.symbol.toLowerCase()}`,
    }]);
    keyboard.push([{ text: '⬅️ Voltar', callback_data: 'menu:recharge' }]);
    return { reply_markup: { inline_keyboard: keyboard } };
  }

  static cryptoAmountMenu(curr) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'R$ 50', callback_data: `recharge:crypto:${curr}:50` },
            { text: 'R$ 100', callback_data: `recharge:crypto:${curr}:100` },
          ],
          [
            { text: 'R$ 200', callback_data: `recharge:crypto:${curr}:200` },
            { text: 'R$ 500', callback_data: `recharge:crypto:${curr}:500` },
          ],
          [{ text: '✏️ Outro Valor', callback_data: `recharge:crypto:${curr}:amount` }],
          [{ text: '⬅️ Voltar', callback_data: 'recharge:crypto' }],
        ],
      },
    };
  }

  // ─── ACCOUNT MENUS ───
  static accountMenu() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Saldo', callback_data: 'account:wallet' }],
          [{ text: '📜 Histórico de Compras', callback_data: 'account:history' }],
          [{ text: '🔄 Histórico de Recargas', callback_data: 'account:recharges' }],
          [{ text: '💎 Diamantes', callback_data: 'account:diamonds' }],
          [{ text: '🔔 Notificações', callback_data: 'account:notify' }],
          [{ text: '⬅️ Voltar', callback_data: 'menu:main' }],
        ],
      },
    };
  }

  // ─── EXCHANGE MENU ───
  static exchangeMenu(eligibleCount) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: `🔄 Trocar (${eligibleCount} elegíveis)`, callback_data: 'exchange:list' }],
          [{ text: '✏️ Inserir número do card', callback_data: 'exchange:manual' }],
          [{ text: '⬅️ Voltar', callback_data: 'menu:main' }],
        ],
      },
    };
  }

  static exchangeCardMenu(orderId) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Solicitar Troca', callback_data: `exchange:request:${orderId}` }],
          [{ text: '⬅️ Voltar', callback_data: 'exchange:list' }],
        ],
      },
    };
  }

  // ─── ADMIN MENUS ───
  static adminMenu() {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 Status', callback_data: 'admin:stats' },
            { text: '💰 Financeiro', callback_data: 'admin:finance' },
          ],
          [
            { text: '📦 Estoque', callback_data: 'admin:stock' },
            { text: '👥 Usuários', callback_data: 'admin:users' },
          ],
          [
            { text: '⚙️ Configurações', callback_data: 'admin:settings' },
            { text: '📢 Broadcast', callback_data: 'admin:broadcast' },
          ],
          [
            { text: '💲 Preços', callback_data: 'admin:prices' },
            { text: '🔌 Gates', callback_data: 'admin:gates' },
          ],
          [
            { text: '🎁 Gift Cards', callback_data: 'admin:giftcards' },
            { text: '🔄 Reembolso', callback_data: 'admin:refund' },
          ],
          [
            { text: '📋 Relatório', callback_data: 'admin:report' },
            { text: '🤝 Afiliados', callback_data: 'admin:affiliates' },
          ],
        ],
      },
    };
  }

  static adminSettingsMenu() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Msg Boas-vindas', callback_data: 'admin:edit:welcome_message' }],
          [{ text: '🏪 Nome da Loja', callback_data: 'admin:edit:store_name' }],
          [{ text: '🛒 Compras On/Off', callback_data: 'admin:toggle:disable_purchases' }],
          [{ text: '📱 PIX On/Off', callback_data: 'admin:toggle:disable_pix' }],
          [{ text: '🔄 Trocas On/Off', callback_data: 'admin:toggle:exchanges_enabled' }],
          [{ text: '📢 Canal Obrigatório', callback_data: 'admin:edit:required_channel' }],
          [{ text: '🤝 Indicações On/Off', callback_data: 'admin:toggle:referral_enabled' }],
          [{ text: '⬅️ Voltar', callback_data: 'admin:main' }],
        ],
      },
    };
  }

  static adminReportPeriodMenu() {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Hoje', callback_data: 'admin:report:0' },
            { text: '1 dia', callback_data: 'admin:report:1' },
            { text: '3 dias', callback_data: 'admin:report:3' },
          ],
          [
            { text: '7 dias', callback_data: 'admin:report:7' },
            { text: '15 dias', callback_data: 'admin:report:15' },
            { text: '30 dias', callback_data: 'admin:report:30' },
          ],
          [{ text: '⬅️ Voltar', callback_data: 'admin:main' }],
        ],
      },
    };
  }

  // ─── UTILITY ───
  static paginationRow(prefix, currentPage, totalPages) {
    const row = [];
    if (currentPage > 1) {
      row.push({ text: '⬅️', callback_data: `${prefix}:${currentPage - 1}` });
    }
    row.push({ text: `${currentPage}/${totalPages}`, callback_data: 'noop' });
    if (currentPage < totalPages) {
      row.push({ text: '➡️', callback_data: `${prefix}:${currentPage + 1}` });
    }
    return row;
  }

  static backButton(callbackData = 'menu:main', text = '⬅️ Voltar') {
    return { reply_markup: { inline_keyboard: [[{ text, callback_data: callbackData }]] } };
  }

  static unbanButton(userId) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔓 Desbanir', callback_data: `admin:unban:${userId}` }],
        ],
      },
    };
  }
}

module.exports = MenuBuilder;
