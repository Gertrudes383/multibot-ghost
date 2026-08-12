'use strict';

const { currency } = require('./utils/messageFormatter');

const e = (botConfig, key, fallback) => {
  const custom = botConfig?.metadata?.custom_emojis;
  return (custom && custom[key]) || fallback;
};

class MenuBuilder {
  static mainMenu(botConfig) {
    const keyboard = [];

    if (!botConfig.disable_purchases) {
      keyboard.push([{ text: `${e(botConfig, 'buy', '🛒')} Comprar`, callback_data: 'menu:buy' }]);
    }

    if (!botConfig.disable_pix) {
      keyboard.push([{ text: `${e(botConfig, 'recharge', '💰')} Adicionar Saldo`, callback_data: 'menu:recharge' }]);
    }

    keyboard.push([{ text: `${e(botConfig, 'account', '👤')} Minha Conta`, callback_data: 'menu:account' }]);
    keyboard.push([{ text: `${e(botConfig, 'support', '📞')} Suporte`, callback_data: 'menu:support' }]);

    if (botConfig.referral_enabled) {
      keyboard.push([{ text: `${e(botConfig, 'referral', '🤝')} Indicações`, callback_data: 'menu:referral' }]);
    }

    return { reply_markup: { inline_keyboard: keyboard } };
  }

  static buyTypeMenu() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Full (CC)', callback_data: 'buy:type:full' }],
          [{ text: '📋 Sem CVV', callback_data: 'buy:type:sem' }],
          [{ text: '🔍 Consultáveis', callback_data: 'buy:type:consultaveis' }],
          [{ text: '📼 Tracks', callback_data: 'buy:type:tracks' }],
          [{ text: '⬅️ Voltar', callback_data: 'menu:main' }],
        ],
      },
    };
  }

  static countryMenu(countries) {
    const keyboard = countries.slice(0, 20).map((c) => [{
      text: `${c.country} (${c.count})`,
      callback_data: `buy:country:${c.country}`,
    }]);
    keyboard.push([{ text: '⬅️ Voltar', callback_data: 'menu:buy' }]);
    return { reply_markup: { inline_keyboard: keyboard } };
  }

  static binMenu(bins, country) {
    const keyboard = bins.slice(0, 20).map((b) => [{
      text: `${b.bin} ${b.brand || ''} - ${currency(b.price)}`,
      callback_data: `buy:bin:${b.bin}`,
    }]);
    keyboard.push([{ text: '⬅️ Voltar', callback_data: `buy:country:${country}` }]);
    return { reply_markup: { inline_keyboard: keyboard } };
  }

  static confirmPurchaseMenu(card, price) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: `✅ Confirmar - ${currency(price)}`, callback_data: `buy:confirm:${card.bin}` }],
          [{ text: '❌ Cancelar', callback_data: 'menu:buy' }],
        ],
      },
    };
  }

  static rechargeMenu(botConfig) {
    const keyboard = [];

    if (!botConfig.disable_pix) {
      keyboard.push([{ text: '📱 PIX Automático', callback_data: 'recharge:pix' }]);
    }

    keyboard.push([{ text: '₿ Criptomoeda', callback_data: 'recharge:crypto' }]);
    keyboard.push([{ text: '🏦 Transferência Manual', callback_data: 'recharge:manual' }]);
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
      text: `${c.symbol} - ${c.name}`,
      callback_data: `recharge:crypto:${c.symbol.toLowerCase()}`,
    }]);
    keyboard.push([{ text: '⬅️ Voltar', callback_data: 'menu:recharge' }]);
    return { reply_markup: { inline_keyboard: keyboard } };
  }

  static accountMenu() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Saldo', callback_data: 'account:wallet' }],
          [{ text: '📜 Histórico de Compras', callback_data: 'account:history' }],
          [{ text: '🔄 Histórico de Recargas', callback_data: 'account:recharges' }],
          [{ text: '⬅️ Voltar', callback_data: 'menu:main' }],
        ],
      },
    };
  }

  static adminMenu() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚙️ Configurações', callback_data: 'admin:settings' }],
          [{ text: '👥 Usuários', callback_data: 'admin:users' }],
          [{ text: '📦 Estoque', callback_data: 'admin:stock' }],
          [{ text: '📢 Broadcast', callback_data: 'admin:broadcast' }],
          [{ text: '💰 Financeiro', callback_data: 'admin:finance' }],
          [{ text: '🎁 Gift Cards', callback_data: 'admin:giftcards' }],
          [{ text: '📊 Estatísticas', callback_data: 'admin:stats' }],
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
          [{ text: '📢 Canal Obrigatório', callback_data: 'admin:edit:required_channel' }],
          [{ text: '🤝 Indicações On/Off', callback_data: 'admin:toggle:referral_enabled' }],
          [{ text: '⬅️ Voltar', callback_data: 'admin:main' }],
        ],
      },
    };
  }

  static paginationRow(prefix, currentPage, totalPages) {
    const row = [];
    if (currentPage > 1) {
      row.push({ text: '⬅️', callback_data: `${prefix}:page:${currentPage - 1}` });
    }
    row.push({ text: `${currentPage}/${totalPages}`, callback_data: 'noop' });
    if (currentPage < totalPages) {
      row.push({ text: '➡️', callback_data: `${prefix}:page:${currentPage + 1}` });
    }
    return row;
  }

  static backButton(callbackData = 'menu:main', text = '⬅️ Voltar') {
    return { reply_markup: { inline_keyboard: [[{ text, callback_data: callbackData }]] } };
  }
}

module.exports = MenuBuilder;
