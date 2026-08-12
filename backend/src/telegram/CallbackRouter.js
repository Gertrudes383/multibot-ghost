'use strict';

const mongoose = require('mongoose');
const { User, Card, Order, Recharge } = require('../../database/schemas');
const MenuBuilder = require('./MenuBuilder');
const { bold, currency, code, separator, cardMask, formatDate, statusEmoji } = require('./utils/messageFormatter');
const { checkSubscription, sendSubscriptionRequired } = require('./utils/channelChecker');
const purchaseService = require('../services/purchase.service');
const rechargeService = require('../services/recharge.service');
const cryptoService = require('../services/crypto.service');
const cardService = require('../services/card.service');

class CallbackRouter {
  constructor(botInstance) {
    this.bot = botInstance.bot;
    this.botDoc = botInstance.botDoc;
    this.sessions = new Map();
  }

  async handle(query) {
    const chatId = query.message.chat.id;
    const data = query.data;
    const telegramId = String(query.from.id);

    try {
      await this.bot.answerCallbackQuery(query.id);
    } catch {
      // ignore expired queries
    }

    try {
      const user = await User.findByTelegram(telegramId, this.botDoc.id);
      if (!user) {
        return this.bot.sendMessage(chatId, '❌ Conta não encontrada. Envie /start para se registrar.');
      }

      const [prefix, ...parts] = data.split(':');

      switch (prefix) {
        case 'menu':
          return this._handleMenu(chatId, parts, user);
        case 'buy':
          return this._handleBuy(chatId, parts, user);
        case 'recharge':
          return this._handleRecharge(chatId, parts, user);
        case 'account':
          return this._handleAccount(chatId, parts, user);
        case 'check':
          return this._handleCheck(chatId, parts, user);
        case 'admin':
          return this._handleAdmin(chatId, parts, user);
        case 'noop':
          return;
        default:
          return this.bot.sendMessage(chatId, '❌ Ação desconhecida.');
      }
    } catch (err) {
      console.error(`[CallbackRouter] ${this.botDoc.bot_name}: ${err.message}`);
      const msg = err.statusCode ? err.message : 'Erro interno. Tente novamente.';
      return this.bot.sendMessage(chatId, `❌ ${msg}`);
    }
  }

  // ─── MENU ───
  async _handleMenu(chatId, parts, user) {
    const action = parts[0];

    switch (action) {
      case 'main':
        return this.bot.sendMessage(chatId, `Escolha uma opção:`, {
          parse_mode: 'HTML',
          ...MenuBuilder.mainMenu(this.botDoc),
        });
      case 'buy':
        if (this.botDoc.disable_purchases) {
          return this.bot.sendMessage(chatId, '🚫 Compras desabilitadas neste momento.');
        }
        return this.bot.sendMessage(chatId, `${bold('🛒 Comprar')}\n\nEscolha o tipo:`, {
          parse_mode: 'HTML',
          ...MenuBuilder.buyTypeMenu(),
        });
      case 'recharge':
        return this.bot.sendMessage(chatId, `${bold('💰 Adicionar Saldo')}\n\nEscolha o método:`, {
          parse_mode: 'HTML',
          ...MenuBuilder.rechargeMenu(this.botDoc),
        });
      case 'account':
        return this.bot.sendMessage(chatId, `${bold('👤 Minha Conta')}\n\nO que deseja ver?`, {
          parse_mode: 'HTML',
          ...MenuBuilder.accountMenu(),
        });
      case 'support':
        return this.bot.sendMessage(chatId, [
          `${bold('📞 Suporte')}`,
          ``,
          `Entre em contato com o administrador da loja para suporte.`,
          this.botDoc.help_message || '',
        ].filter(Boolean).join('\n'), { parse_mode: 'HTML' });
      case 'referral':
        return this._showReferral(chatId, user);
      default:
        return;
    }
  }

  async _showReferral(chatId, user) {
    if (!this.botDoc.referral_enabled) {
      return this.bot.sendMessage(chatId, '🚫 Sistema de indicações desabilitado.');
    }

    const botInfo = await this.bot.getMe();
    const refLink = `https://t.me/${botInfo.username}?start=ref_${user._id}`;

    return this.bot.sendMessage(chatId, [
      `${bold('🤝 Indicações')}`,
      ``,
      `Seu link de indicação:`,
      `${code(refLink)}`,
      ``,
      `Compartilhe com amigos!`,
    ].join('\n'), {
      parse_mode: 'HTML',
      ...MenuBuilder.backButton('menu:main'),
    });
  }

  // ─── BUY FLOW ───
  async _handleBuy(chatId, parts, user) {
    const action = parts[0];

    switch (action) {
      case 'type': {
        const type = parts[1];
        const typeMap = { full: null, sem: null, consultaveis: null, tracks: null };
        if (!(type in typeMap)) return;

        this._setSession(chatId, { buyType: type });

        const countries = await cardService.getCardCountries(this.botDoc.owner_id, this.botDoc.id);
        if (!countries.length) {
          return this.bot.sendMessage(chatId, '📦 Sem estoque disponível no momento.', {
            ...MenuBuilder.backButton('menu:buy'),
          });
        }

        return this.bot.sendMessage(chatId, `${bold('🌍 Selecione o país:')}\n\n${countries.length} países disponíveis`, {
          parse_mode: 'HTML',
          ...MenuBuilder.countryMenu(countries),
        });
      }

      case 'country': {
        const country = parts[1];
        if (!country) return;
        this._updateSession(chatId, { country });

        const bins = await Card.aggregate([
          {
            $match: {
              bot_id: new mongoose.Types.ObjectId(this.botDoc.id),
              country: country.toUpperCase(),
              status: 'available',
            },
          },
          {
            $group: {
              _id: '$bin',
              count: { $sum: 1 },
              brand: { $first: '$brand' },
              price: { $first: '$price' },
            },
          },
          { $project: { bin: '$_id', count: 1, brand: 1, price: 1, _id: 0 } },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ]);

        if (!bins.length) {
          return this.bot.sendMessage(chatId, `📦 Sem estoque para ${country}.`, {
            ...MenuBuilder.backButton('menu:buy'),
          });
        }

        const binsForMenu = bins.map((b) => ({
          bin: b.bin,
          brand: b.brand,
          price: parseFloat(b.price?.toString() || '0'),
          count: b.count,
        }));

        return this.bot.sendMessage(chatId, `${bold(`🏦 BINs disponíveis — ${country}`)}\n\nSelecione uma BIN:`, {
          parse_mode: 'HTML',
          ...MenuBuilder.binMenu(binsForMenu, country),
        });
      }

      case 'bin': {
        const bin = parts[1];
        if (!bin) return;

        const card = await Card.findOne({
          bot_id: new mongoose.Types.ObjectId(this.botDoc.id),
          bin,
          status: 'available',
        }).lean();

        if (!card) {
          return this.bot.sendMessage(chatId, '📦 BIN esgotada.', {
            ...MenuBuilder.backButton('menu:buy'),
          });
        }

        const price = await purchaseService._resolvePriceForCard(card, this.botDoc.id);

        this._updateSession(chatId, { bin, price });

        return this.bot.sendMessage(chatId, [
          `${bold('💳 Confirmar Compra')}`,
          separator(),
          `BIN: ${code(cardMask(bin))}`,
          `País: ${bold(card.country)}`,
          `Bandeira: ${bold(card.brand || '—')}`,
          `Preço: ${bold(currency(price))}`,
          `Seu saldo: ${bold(currency(parseFloat(user.balance?.toString() || '0')))}`,
          separator(),
        ].join('\n'), {
          parse_mode: 'HTML',
          ...MenuBuilder.confirmPurchaseMenu(card, price),
        });
      }

      case 'confirm': {
        const session = this._getSession(chatId);
        if (!session?.bin) {
          return this.bot.sendMessage(chatId, '❌ Sessão expirada. Comece novamente.', {
            ...MenuBuilder.backButton('menu:buy'),
          });
        }

        const result = await purchaseService.purchaseCard(
          user._id,
          this.botDoc.id,
          { bin: session.bin, country: session.country }
        );

        this._clearSession(chatId);

        const cardData = result.card || result;
        const newBalance = parseFloat(
          (await User.findById(user._id).lean()).balance?.toString() || '0'
        );

        return this.bot.sendMessage(chatId, [
          `${bold('✅ Compra Realizada!')}`,
          separator(),
          `${code(cardData.number || cardData.full || '—')}`,
          `Validade: ${code(cardData.expiry || `${cardData.exp_month}/${cardData.exp_year}` || '—')}`,
          cardData.cvv ? `CVV: ${code(cardData.cvv)}` : '',
          `País: ${cardData.country || '—'}`,
          `Bandeira: ${cardData.brand || '—'}`,
          separator(),
          `Valor: ${bold(currency(result.price || session.price))}`,
          `Novo saldo: ${bold(currency(newBalance))}`,
        ].filter(Boolean).join('\n'), {
          parse_mode: 'HTML',
          ...MenuBuilder.backButton('menu:main'),
        });
      }

      default:
        return;
    }
  }

  // ─── RECHARGE FLOW ───
  async _handleRecharge(chatId, parts, user) {
    const action = parts[0];

    switch (action) {
      case 'pix': {
        if (this.botDoc.disable_pix) {
          return this.bot.sendMessage(chatId, '🚫 PIX desabilitado neste momento.');
        }

        const amount = parts[1];
        if (!amount) {
          return this.bot.sendMessage(chatId, `${bold('📱 Recarga via PIX')}\n\nEscolha o valor:`, {
            parse_mode: 'HTML',
            ...MenuBuilder.pixAmountMenu(),
          });
        }

        if (amount === 'custom') {
          this._setSession(chatId, { awaitingPixAmount: true });
          return this.bot.sendMessage(chatId, '✏️ Digite o valor da recarga (ex: 75.50):', {
            ...MenuBuilder.backButton('menu:recharge'),
          });
        }

        return this._createPixRecharge(chatId, user, parseFloat(amount));
      }

      case 'crypto': {
        const curr = parts[1];
        if (!curr) {
          const currencies = cryptoService.getSupportedCurrencies();
          return this.bot.sendMessage(chatId, `${bold('₿ Recarga via Criptomoeda')}\n\nEscolha a moeda:`, {
            parse_mode: 'HTML',
            ...MenuBuilder.cryptoCurrencyMenu(currencies),
          });
        }

        if (parts[2] === 'amount') {
          this._setSession(chatId, { awaitingCryptoAmount: true, cryptoCurrency: curr });
          return this.bot.sendMessage(chatId, '✏️ Digite o valor em R$ para a recarga crypto:', {
            ...MenuBuilder.backButton('menu:recharge'),
          });
        }

        return this.bot.sendMessage(chatId, `${bold(`₿ Recarga ${curr.toUpperCase()}`)}\n\nDigite o valor em R$:`, {
          parse_mode: 'HTML',
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
        });
      }

      case 'manual': {
        return this._createManualRecharge(chatId, user);
      }

      default: {
        if (action && parts[1]) {
          const curr = action;
          const amountStr = parts[1];
          if (amountStr === 'amount') {
            this._setSession(chatId, { awaitingCryptoAmount: true, cryptoCurrency: curr });
            return this.bot.sendMessage(chatId, '✏️ Digite o valor em R$ para a recarga crypto:', {
              ...MenuBuilder.backButton('menu:recharge'),
            });
          }
          const amount = parseFloat(amountStr);
          if (amount > 0) {
            return this._createCryptoRecharge(chatId, user, amount, curr);
          }
        }
        return;
      }
    }
  }

  async _createPixRecharge(chatId, user, amount) {
    if (!amount || amount <= 0) {
      return this.bot.sendMessage(chatId, '❌ Valor inválido.');
    }

    const recharge = await rechargeService.createRecharge(
      user._id, this.botDoc.id, this.botDoc.owner_id, amount, 'pix_auto'
    );

    const lines = [
      `${bold('📱 PIX Gerado')}`,
      separator(),
      `Valor: ${bold(currency(amount))}`,
      ``,
    ];

    if (recharge.pix_wallet) {
      lines.push(`Copie o código abaixo:`);
      lines.push(`${code(recharge.pix_wallet)}`);
    }

    lines.push(``);
    lines.push(`⏳ Aguardando confirmação...`);
    lines.push(`O saldo será creditado automaticamente.`);

    return this.bot.sendMessage(chatId, lines.join('\n'), {
      parse_mode: 'HTML',
      ...MenuBuilder.backButton('menu:main'),
    });
  }

  async _createCryptoRecharge(chatId, user, amount, curr) {
    if (!amount || amount <= 0) {
      return this.bot.sendMessage(chatId, '❌ Valor inválido.');
    }

    const recharge = await rechargeService.createRecharge(
      user._id, this.botDoc.id, this.botDoc.owner_id, amount, 'crypto', { currency: curr }
    );

    const lines = [
      `${bold(`₿ Pagamento ${curr.toUpperCase()}`)}`,
      separator(),
      `Valor BRL: ${bold(currency(amount))}`,
    ];

    if (recharge.crypto_address) {
      lines.push(`Endereço:`);
      lines.push(`${code(recharge.crypto_address)}`);
    }
    if (recharge.crypto_amount) {
      lines.push(`Valor ${curr.toUpperCase()}: ${code(String(recharge.crypto_amount))}`);
    }

    lines.push(``);
    lines.push(`⏳ Aguardando confirmação na blockchain...`);
    lines.push(`O saldo será creditado automaticamente.`);

    return this.bot.sendMessage(chatId, lines.join('\n'), {
      parse_mode: 'HTML',
      ...MenuBuilder.backButton('menu:main'),
    });
  }

  async _createManualRecharge(chatId, user) {
    const recharge = await rechargeService.createRecharge(
      user._id, this.botDoc.id, this.botDoc.owner_id, 0, 'manual'
    );

    return this.bot.sendMessage(chatId, [
      `${bold('🏦 Recarga Manual')}`,
      separator(),
      `Envie o comprovante de pagamento para o administrador.`,
      ``,
      `ID da recarga: ${code(String(recharge._id))}`,
      ``,
      `Após o envio, aguarde a aprovação manual.`,
    ].join('\n'), {
      parse_mode: 'HTML',
      ...MenuBuilder.backButton('menu:main'),
    });
  }

  // ─── ACCOUNT ───
  async _handleAccount(chatId, parts, user) {
    const action = parts[0];

    switch (action) {
      case 'wallet': {
        const balance = parseFloat(user.balance?.toString() || '0');
        const spent = parseFloat(user.totalSpent?.toString() || '0');
        return this.bot.sendMessage(chatId, [
          `${bold('💰 Sua Carteira')}`,
          separator(),
          `Saldo: ${bold(currency(balance))}`,
          `Total gasto: ${currency(spent)}`,
          `Compras: ${user.purchaseCount || 0}`,
        ].join('\n'), {
          parse_mode: 'HTML',
          ...MenuBuilder.backButton('menu:account'),
        });
      }

      case 'history': {
        const page = parseInt(parts[1], 10) || 1;
        const result = await purchaseService.getPurchaseHistory(user._id, this.botDoc.id, { page, limit: 5 });

        if (!result.orders?.length) {
          return this.bot.sendMessage(chatId, '📜 Nenhuma compra encontrada.', {
            ...MenuBuilder.backButton('menu:account'),
          });
        }

        const lines = [`${bold('📜 Histórico de Compras')}\n`];
        for (const order of result.orders) {
          lines.push(
            `${statusEmoji(order.status)} ${cardMask(order.card_bin)} — ${currency(parseFloat(order.price?.toString() || '0'))} — ${formatDate(order.createdAt)}`
          );
        }

        const keyboard = [];
        if (result.totalPages > 1) {
          keyboard.push(MenuBuilder.paginationRow('account:history', page, result.totalPages));
        }
        keyboard.push([{ text: '⬅️ Voltar', callback_data: 'menu:account' }]);

        return this.bot.sendMessage(chatId, lines.join('\n'), {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard },
        });
      }

      case 'recharges': {
        const page = parseInt(parts[1], 10) || 1;
        const result = await rechargeService.getRechargeHistory(user._id, this.botDoc.id, { page, limit: 5 });

        if (!result.recharges?.length) {
          return this.bot.sendMessage(chatId, '🔄 Nenhuma recarga encontrada.', {
            ...MenuBuilder.backButton('menu:account'),
          });
        }

        const lines = [`${bold('🔄 Histórico de Recargas')}\n`];
        for (const r of result.recharges) {
          lines.push(
            `${statusEmoji(r.status)} ${r.method} — ${currency(parseFloat(r.amount?.toString() || '0'))} — ${formatDate(r.createdAt)}`
          );
        }

        const keyboard = [];
        if (result.totalPages > 1) {
          keyboard.push(MenuBuilder.paginationRow('account:recharges', page, result.totalPages));
        }
        keyboard.push([{ text: '⬅️ Voltar', callback_data: 'menu:account' }]);

        return this.bot.sendMessage(chatId, lines.join('\n'), {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard },
        });
      }

      default:
        return;
    }
  }

  // ─── CHECK (subscription verify) ───
  async _handleCheck(chatId, parts, user) {
    if (parts[0] === 'subscription') {
      if (!this.botDoc.require_subscription || !this.botDoc.required_channel) {
        return this.bot.sendMessage(chatId, '✅ Nenhum canal obrigatório configurado.');
      }

      const isMember = await checkSubscription(this.bot, chatId, this.botDoc.required_channel);
      if (isMember) {
        return this.bot.sendMessage(chatId, '✅ Verificado! Você já está no canal.', {
          ...MenuBuilder.mainMenu(this.botDoc),
        });
      }

      return sendSubscriptionRequired(this.bot, chatId, this.botDoc.required_channel, this.botDoc.store_name);
    }
  }

  // ─── ADMIN ───
  async _handleAdmin(chatId, parts, user) {
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return this.bot.sendMessage(chatId, '🚫 Acesso negado.');
    }

    const action = parts[0];
    if (!action || action === 'main') {
      return this.bot.sendMessage(chatId, `${bold('⚙️ Painel Admin')}`, {
        parse_mode: 'HTML',
        ...MenuBuilder.adminMenu(),
      });
    }

    if (action === 'settings') {
      return this.bot.sendMessage(chatId, `${bold('⚙️ Configurações')}`, {
        parse_mode: 'HTML',
        ...MenuBuilder.adminSettingsMenu(),
      });
    }

    // admin:toggle:<field>
    if (action === 'toggle') {
      const field = parts[1];
      const allowed = ['disable_purchases', 'disable_pix', 'referral_enabled'];
      if (!allowed.includes(field)) return;

      const { Bot } = require('../../database/schemas');
      const current = this.botDoc[field];
      await Bot.findByIdAndUpdate(this.botDoc._id, { [field]: !current });
      this.botDoc[field] = !current;

      const label = {
        disable_purchases: 'Compras',
        disable_pix: 'PIX',
        referral_enabled: 'Indicações',
      }[field];

      const state = field === 'referral_enabled'
        ? (this.botDoc[field] ? '🟢 Ativado' : '🔴 Desativado')
        : (this.botDoc[field] ? '🔴 Desativado' : '🟢 Ativado');

      return this.bot.sendMessage(chatId, `${label}: ${state}`, {
        ...MenuBuilder.adminSettingsMenu(),
      });
    }

    // admin:edit:<field>
    if (action === 'edit') {
      const field = parts[1];
      const allowed = ['welcome_message', 'store_name', 'required_channel'];
      if (!allowed.includes(field)) return;

      const labels = {
        welcome_message: 'mensagem de boas-vindas',
        store_name: 'nome da loja',
        required_channel: 'canal obrigatório (@username)',
      };

      this._setSession(chatId, { awaitingEdit: field });
      return this.bot.sendMessage(chatId, `✏️ Digite o novo valor para ${labels[field]}:`, {
        ...MenuBuilder.backButton('admin:settings'),
      });
    }

    if (action === 'users') {
      const count = await User.countDocuments({ bot_id: this.botDoc.id });
      return this.bot.sendMessage(chatId, [
        `${bold('👥 Usuários')}`,
        separator(),
        `Total: ${bold(String(count))}`,
      ].join('\n'), {
        parse_mode: 'HTML',
        ...MenuBuilder.backButton('admin:main'),
      });
    }

    if (action === 'stock') {
      const available = await Card.countDocuments({ bot_id: new mongoose.Types.ObjectId(this.botDoc.id), status: 'available' });
      const sold = await Card.countDocuments({ bot_id: new mongoose.Types.ObjectId(this.botDoc.id), status: 'sold' });
      return this.bot.sendMessage(chatId, [
        `${bold('📦 Estoque')}`,
        separator(),
        `Disponíveis: ${bold(String(available))}`,
        `Vendidos: ${bold(String(sold))}`,
      ].join('\n'), {
        parse_mode: 'HTML',
        ...MenuBuilder.backButton('admin:main'),
      });
    }

    if (action === 'finance') {
      const totalSales = await Order.aggregate([
        { $match: { bot_id: new mongoose.Types.ObjectId(this.botDoc.id), status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$price' } } },
      ]);
      const totalRecharges = await Recharge.aggregate([
        { $match: { bot_id: new mongoose.Types.ObjectId(this.botDoc.id), status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);

      return this.bot.sendMessage(chatId, [
        `${bold('💰 Financeiro')}`,
        separator(),
        `Vendas: ${bold(currency(totalSales[0]?.total || 0))}`,
        `Recargas: ${bold(currency(totalRecharges[0]?.total || 0))}`,
      ].join('\n'), {
        parse_mode: 'HTML',
        ...MenuBuilder.backButton('admin:main'),
      });
    }

    if (action === 'stats') {
      const totalUsers = await User.countDocuments({ bot_id: this.botDoc.id });
      const totalOrders = await Order.countDocuments({ bot_id: new mongoose.Types.ObjectId(this.botDoc.id) });
      const availableCards = await Card.countDocuments({ bot_id: new mongoose.Types.ObjectId(this.botDoc.id), status: 'available' });

      return this.bot.sendMessage(chatId, [
        `${bold('📊 Estatísticas')}`,
        separator(),
        `Usuários: ${bold(String(totalUsers))}`,
        `Pedidos: ${bold(String(totalOrders))}`,
        `Cards disponíveis: ${bold(String(availableCards))}`,
        `Status: ${statusEmoji(this.botDoc.runtime_status)} ${this.botDoc.runtime_status}`,
      ].join('\n'), {
        parse_mode: 'HTML',
        ...MenuBuilder.backButton('admin:main'),
      });
    }

    return this.bot.sendMessage(chatId, '⚙️ Funcionalidade em desenvolvimento.', {
      ...MenuBuilder.backButton('admin:main'),
    });
  }

  // ─── TEXT MESSAGE (awaiting input) ───
  async handleTextMessage(msg) {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);
    const text = (msg.text || '').trim();

    const session = this._getSession(chatId);
    if (!session) return false;

    const user = await User.findByTelegram(telegramId, this.botDoc.id);
    if (!user) return false;

    if (session.awaitingPixAmount) {
      this._clearSession(chatId);
      const amount = parseFloat(text.replace(',', '.'));
      if (!amount || amount <= 0) {
        return this.bot.sendMessage(chatId, '❌ Valor inválido. Digite um número positivo.');
      }
      await this._createPixRecharge(chatId, user, amount);
      return true;
    }

    if (session.awaitingCryptoAmount) {
      this._clearSession(chatId);
      const amount = parseFloat(text.replace(',', '.'));
      if (!amount || amount <= 0) {
        return this.bot.sendMessage(chatId, '❌ Valor inválido. Digite um número positivo.');
      }
      await this._createCryptoRecharge(chatId, user, amount, session.cryptoCurrency);
      return true;
    }

    if (session.awaitingEdit) {
      this._clearSession(chatId);
      const field = session.awaitingEdit;
      const { Bot } = require('../../database/schemas');
      await Bot.findByIdAndUpdate(this.botDoc._id, { [field]: text });
      this.botDoc[field] = text;

      return this.bot.sendMessage(chatId, `✅ Atualizado com sucesso!`, {
        ...MenuBuilder.adminSettingsMenu(),
      });
    }

    return false;
  }

  // ─── SESSION ───
  _setSession(chatId, data) {
    this.sessions.set(String(chatId), { ...data, ts: Date.now() });
  }

  _updateSession(chatId, data) {
    const existing = this.sessions.get(String(chatId)) || {};
    this.sessions.set(String(chatId), { ...existing, ...data, ts: Date.now() });
  }

  _getSession(chatId) {
    const session = this.sessions.get(String(chatId));
    if (!session) return null;
    if (Date.now() - session.ts > 10 * 60 * 1000) {
      this.sessions.delete(String(chatId));
      return null;
    }
    return session;
  }

  _clearSession(chatId) {
    this.sessions.delete(String(chatId));
  }
}

module.exports = CallbackRouter;
