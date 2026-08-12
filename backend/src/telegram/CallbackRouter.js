'use strict';

/**
 * CallbackRouter V3 — Roteador completo de callbacks e mensagens.
 *
 * Porta completa do V2 Python com TODOS os fluxos:
 * - Compra com paginação de cards (preView, navegação ←/→/±50)
 * - Auto-live (buy_20) — testa até 20 cards, para no primeiro live
 * - Exchange/troca de cards
 * - Gift card redemption
 * - PIX auto-payment com QR code e polling
 * - Crypto payment com seleção de moeda
 * - Conta: saldo, histórico, diamantes, notificações
 * - Admin panel completo com report, stock, finance, settings, refund
 */

const mongoose = require('mongoose');
const { User, Card, Order, Recharge, Bot, GiftCard } = require('../../database/schemas');
const MenuBuilder = require('./MenuBuilder');
const {
  bold, currency, code, separator, cardMask,
  formatDate, statusEmoji,
} = require('./utils/messageFormatter');
const { checkSubscription, sendSubscriptionRequired } = require('./utils/channelChecker');
const purchaseService = require('../services/purchase.service');
const rechargeService = require('../services/recharge.service');
const cryptoService = require('../services/crypto.service');
const cardService = require('../services/card.service');
const Security = require('./core/Security');

class CallbackRouter {
  constructor(botInstance) {
    this.bot = botInstance.bot;
    this.botDoc = botInstance.botDoc;
    this.botInstance = botInstance;
    this.sessions = new Map();

    // Clarificar os dois tipos de bot ID:
    // botNumId (Number) — para User.bot_id queries
    // botOid (String ObjectId) — para Card/Order/Recharge.bot_id queries
    this.botNumId = botInstance.botDoc.id; // Number auto-increment (ex: 60)
    this.botOid = String(botInstance.botDoc._id); // ObjectId string (ex: "68001234abcd...")
    this.ownerOid = String(botInstance.botDoc.owner_id);
  }

  async handle(query) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;
    const telegramId = String(query.from.id);

    // Setar contexto de telegramId para isolamento de sessões
    this._currentTelegramId = telegramId;

    try {
      await this.bot.answerCallbackQuery(query.id);
    } catch {
      // ignore expired queries
    }

    // AntiFlood check
    const floodResult = this.botInstance.antiFlood.checkCallback(telegramId);
    if (floodResult.blocked) {
      if (floodResult.reason === 'CRITICAL') {
        return this.bot.sendMessage(chatId, '🚫 Você foi bloqueado temporariamente por flood. Aguarde 30 segundos.');
      }
      return; // COOLDOWN — silencioso
    }

    try {
      const user = await User.findByTelegram(telegramId, this.botNumId);
      if (!user) {
        return this.bot.sendMessage(chatId, '❌ Conta não encontrada. Envie /start para se registrar.');
      }

      if (user.banned) {
        return this.bot.sendMessage(chatId, '🚫 Sua conta está suspensa.');
      }

      const [prefix, ...parts] = data.split(':');

      switch (prefix) {
        case 'menu':
          return this._handleMenu(chatId, messageId, parts, user);
        case 'buy':
          return this._handleBuy(chatId, messageId, parts, user);
        case 'nav':
          return this._handleNavigation(chatId, messageId, parts, user);
        case 'recharge':
          return this._handleRecharge(chatId, messageId, parts, user);
        case 'account':
          return this._handleAccount(chatId, messageId, parts, user);
        case 'exchange':
          return this._handleExchange(chatId, messageId, parts, user);
        case 'check':
          return this._handleCheck(chatId, parts, user);
        case 'admin':
          return this._handleAdmin(chatId, messageId, parts, user);
        case 'noop':
          return;
        default:
          return;
      }
    } catch (err) {
      console.error(`[CallbackRouter] ${(this.botDoc.name || this.botDoc.store_name)}: ${err.message}`);
      const msg = err.statusCode ? err.message : 'Erro interno. Tente novamente.';
      return this.bot.sendMessage(chatId, `❌ ${msg}`);
    }
  }

  // ═══════════════════════════════════════════════
  // MENU
  // ═══════════════════════════════════════════════
  async _handleMenu(chatId, messageId, parts, user) {
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
      case 'exchange':
        return this._showExchangeMenu(chatId, user);
      case 'support':
        return this.bot.sendMessage(chatId, [
          `${bold('📞 Suporte')}`,
          ``,
          this.botDoc.help_message || 'Entre em contato com o administrador da loja.',
        ].filter(Boolean).join('\n'), {
          parse_mode: 'HTML',
          ...MenuBuilder.backButton('menu:main'),
        });
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

    // Contar referidos
    const referredCount = await User.countDocuments({
      bot_id: this.botNumId,
      referral_id: String(user._id),
    });

    return this.bot.sendMessage(chatId, [
      `${bold('🤝 Indicações')}`,
      separator(),
      `Seu link de indicação:`,
      `${code(refLink)}`,
      ``,
      `Indicados: ${bold(String(referredCount))}`,
      ``,
      `Compartilhe com amigos e ganhe bônus!`,
    ].join('\n'), {
      parse_mode: 'HTML',
      ...MenuBuilder.backButton('menu:main'),
    });
  }

  // ═══════════════════════════════════════════════
  // BUY FLOW — Com paginação de cards (V2 completo)
  // ═══════════════════════════════════════════════
  async _handleBuy(chatId, messageId, parts, user) {
    const action = parts[0];

    switch (action) {
      // Seleção de tipo (full, sem, mix, etc)
      case 'type': {
        const type = parts[1];
        const validTypes = ['full', 'sem', 'consultaveis', 'tracks', 'mix'];
        if (!validTypes.includes(type)) return;

        this._setSession(chatId, { buyType: type });

        // Listar países com estoque
        const countries = await cardService.getCardCountries(this.ownerOid, this.botOid);
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

      // Busca por banco
      case 'search': {
        const searchType = parts[1];
        if (searchType === 'bank') {
          const banks = await Card.aggregate([
            { $match: { bot_id: new mongoose.Types.ObjectId(this.botDoc._id), status: 'available' } },
            { $group: { _id: '$bank', count: { $sum: 1 } } },
            { $match: { _id: { $ne: null } } },
            { $project: { bank: '$_id', count: 1, _id: 0 } },
            { $sort: { count: -1 } },
            { $limit: 20 },
          ]);

          if (!banks.length) {
            return this.bot.sendMessage(chatId, '📦 Sem estoque por banco.', {
              ...MenuBuilder.backButton('menu:buy'),
            });
          }

          return this.bot.sendMessage(chatId, `${bold('🏦 Selecione o Banco:')}`, {
            parse_mode: 'HTML',
            ...MenuBuilder.bankMenu(banks),
          });
        }

        if (searchType === 'bin') {
          this._setSession(chatId, { awaitingBinSearch: true });
          return this.bot.sendMessage(chatId, '🔍 Digite os primeiros 6 dígitos da BIN:', {
            ...MenuBuilder.backButton('menu:buy'),
          });
        }

        if (searchType === 'country') {
          const countries = await cardService.getCardCountries(this.ownerOid, this.botOid);
          return this.bot.sendMessage(chatId, `${bold('🌍 Selecione o país:')}`, {
            parse_mode: 'HTML',
            ...MenuBuilder.countryMenu(countries),
          });
        }
        return;
      }

      // Seleção de país
      case 'country': {
        const country = parts[1];
        if (!country) return;
        this._updateSession(chatId, { country });

        const bins = await Card.aggregate([
          {
            $match: {
              bot_id: new mongoose.Types.ObjectId(this.botDoc._id),
              country: country.toUpperCase(),
              status: 'available',
            },
          },
          {
            $group: {
              _id: '$bin',
              count: { $sum: 1 },
              brand: { $first: '$brand' },
              level: { $first: '$level' },
              price: { $first: '$price' },
            },
          },
          { $project: { bin: '$_id', count: 1, brand: 1, level: 1, price: 1, _id: 0 } },
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
          ...MenuBuilder.binMenu(binsForMenu, `buy:country:${country}`),
        });
      }

      // Seleção por banco
      case 'bank': {
        const bank = parts.slice(1).join(':');
        if (!bank) return;

        const bins = await Card.aggregate([
          {
            $match: {
              bot_id: new mongoose.Types.ObjectId(this.botDoc._id),
              bank: bank,
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
          return this.bot.sendMessage(chatId, `📦 Sem estoque para ${bank}.`, {
            ...MenuBuilder.backButton('menu:buy'),
          });
        }

        const binsForMenu = bins.map((b) => ({
          bin: b.bin,
          brand: b.brand,
          price: parseFloat(b.price?.toString() || '0'),
          count: b.count,
        }));

        return this.bot.sendMessage(chatId, `${bold(`🏦 BINs — ${bank}`)}\n\nSelecione uma BIN:`, {
          parse_mode: 'HTML',
          ...MenuBuilder.binMenu(binsForMenu, 'buy:search:bank'),
        });
      }

      // Seleção de BIN → inicia paginação de cards
      case 'bin': {
        const bin = parts[1];
        if (!bin) return;
        this._updateSession(chatId, { bin });

        // Buscar cards disponíveis para essa BIN
        const cards = await Card.find({
          bot_id: new mongoose.Types.ObjectId(this.botDoc._id),
          bin,
          status: 'available',
        }).select('_id').sort({ _id: 1 }).lean();

        if (!cards.length) {
          return this.bot.sendMessage(chatId, '📦 BIN esgotada.', {
            ...MenuBuilder.backButton('menu:buy'),
          });
        }

        const cardIds = cards.map((c) => String(c._id));
        const session = this._getSession(chatId);

        // Inicializar paginação
        this.botInstance.paginator.init(String(user._id), cardIds, {
          bin,
          country: session?.country,
          buyType: session?.buyType,
        });

        // Mostrar primeiro card
        return this._showCardPreview(chatId, user);
      }

      // Confirmar compra (com encrypted ID do paginator ou BIN)
      case 'confirm': {
        const token = parts[1];
        if (!token) return;

        // Tentar decriptar como ID encriptado (do paginator)
        const decryptedId = Security.decryptId(token);

        return this.botInstance.purchaseLock.withBuyLock(String(user._id), async () => {
          let result;

          if (decryptedId) {
            // Compra por ID específico do card
            result = await this._purchaseByCardId(user, decryptedId);
          } else {
            // Compra por BIN (fallback)
            const session = this._getSession(chatId);
            result = await purchaseService.purchaseCard(
              user._id,
              this.botOid,
              { bin: token, country: session?.country }
            );
          }

          this.botInstance.paginator.clear(String(user._id));
          this._clearSession(chatId);

          const cardData = result.card || result;
          const price = result.price || parseFloat(result.purchase?.price?.toString() || '0');
          const balanceAfter = result.balanceAfter ?? parseFloat(
            (await User.findById(user._id).lean()).balance?.toString() || '0'
          );

          return this.bot.sendMessage(chatId, [
            `${bold('✅ Compra Realizada!')}`,
            separator(),
            cardData.number ? `Número: ${code(cardData.number)}` : '',
            cardData.expiry_month ? `Validade: ${code(`${cardData.expiry_month}/${cardData.expiry_year}`)}` : '',
            cardData.cvv ? `CVV: ${code(cardData.cvv)}` : '',
            cardData.holder_name ? `Titular: ${code(cardData.holder_name)}` : '',
            cardData.cpf ? `CPF: ${code(cardData.cpf)}` : '',
            `País: ${cardData.country || '—'}`,
            `Bandeira: ${cardData.brand || '—'}`,
            `Level: ${cardData.level || '—'}`,
            `Banco: ${cardData.bank || '—'}`,
            separator(),
            `Valor: ${bold(currency(price))}`,
            `Novo saldo: ${bold(currency(balanceAfter))}`,
          ].filter(Boolean).join('\n'), {
            parse_mode: 'HTML',
            ...MenuBuilder.backButton('menu:main'),
          });
        });
      }

      // Auto Live — Testa até 20 cards, para no primeiro live
      case 'auto20': {
        const token = parts[1];
        if (!token) return;

        return this.botInstance.purchaseLock.withBuyLock(String(user._id), async () => {
          const session = this._getSession(chatId);
          const filters = this.botInstance.paginator.getFilters(String(user._id)) || session || {};

          await this.bot.sendMessage(chatId, '⚡ Buscando card live... Aguarde.');

          const result = await purchaseService.purchaseAutoLive(
            user._id,
            this.botOid,
            {
              bin: filters.bin,
              country: filters.country,
              gateway: 'default',
              maxAttempts: 20,
            }
          );

          this.botInstance.paginator.clear(String(user._id));
          this._clearSession(chatId);

          const cardData = result.card || result;
          const price = parseFloat(result.purchase?.price?.toString() || '0');

          return this.bot.sendMessage(chatId, [
            `${bold('⚡ Card Live Encontrado!')}`,
            separator(),
            `Tentativas: ${bold(String(result.attempts))}`,
            ``,
            cardData.number ? `Número: ${code(cardData.number)}` : '',
            cardData.cvv ? `CVV: ${code(cardData.cvv)}` : '',
            cardData.holder_name ? `Titular: ${code(cardData.holder_name)}` : '',
            `País: ${cardData.country || '—'}`,
            `Bandeira: ${cardData.brand || '—'}`,
            separator(),
            `Valor: ${bold(currency(price))}`,
          ].filter(Boolean).join('\n'), {
            parse_mode: 'HTML',
            ...MenuBuilder.backButton('menu:main'),
          });
        });
      }

      default:
        return;
    }
  }

  // ─── CARD PREVIEW (V2 preView) ───
  async _showCardPreview(chatId, user) {
    const nav = this.botInstance.paginator.current(String(user._id));
    if (!nav) {
      return this.bot.sendMessage(chatId, '❌ Sessão expirada. Comece novamente.', {
        ...MenuBuilder.backButton('menu:buy'),
      });
    }

    // Buscar dados do card (mascarado) — verificar status tambem
    const card = await Card.findById(nav.cardId)
      .select('bin brand type level country bank base price status')
      .lean();

    if (!card || card.status !== 'available') {
      // Card foi vendido/removido enquanto navegava — avançar
      const next = this.botInstance.paginator.next(String(user._id));
      if (!next) {
        return this.bot.sendMessage(chatId, '📦 Estoque esgotado.', {
          ...MenuBuilder.backButton('menu:buy'),
        });
      }
      return this._showCardPreview(chatId, user);
    }

    let price;
    try {
      price = await purchaseService._resolvePriceForCard(card, this.botOid);
    } catch {
      price = parseFloat(card.price?.toString() || '0');
    }

    const balance = parseFloat(user.balance?.toString() || '0');
    const masked = cardMask(card.bin);

    return this.bot.sendMessage(chatId, [
      `${bold('💳 Card Preview')}`,
      separator(),
      `Número: ${code(masked)}`,
      `BIN: ${code(card.bin)}`,
      `Bandeira: ${bold(card.brand || '—')}`,
      `Tipo: ${bold(card.type || '—')}`,
      `Level: ${bold(card.level || '—')}`,
      `País: ${bold(card.country || '—')}`,
      `Banco: ${bold(card.bank || '—')}`,
      separator(),
      `Preço: ${bold(currency(price))}`,
      `Seu saldo: ${bold(currency(balance))}`,
    ].join('\n'), {
      parse_mode: 'HTML',
      ...MenuBuilder.cardPreviewMenu(nav.encryptedId, nav),
    });
  }

  // ─── NAVIGATION (←/→/±50) ───
  async _handleNavigation(chatId, messageId, parts, user) {
    const action = parts[0];
    const uid = String(user._id);

    await this.botInstance.purchaseLock.withNavLock(uid, async () => {
      let nav;
      switch (action) {
        case 'next':
          nav = this.botInstance.paginator.next(uid);
          break;
        case 'prev':
          nav = this.botInstance.paginator.prev(uid);
          break;
        case 'next50':
          nav = this.botInstance.paginator.next50(uid);
          break;
        case 'prev50':
          nav = this.botInstance.paginator.prev50(uid);
          break;
        default:
          return;
      }

      if (!nav) {
        return this.bot.sendMessage(chatId, '❌ Sessão expirada.', {
          ...MenuBuilder.backButton('menu:buy'),
        });
      }

      return this._showCardPreview(chatId, user);
    });
  }

  // ═══════════════════════════════════════════════
  // RECHARGE FLOW
  // ═══════════════════════════════════════════════
  async _handleRecharge(chatId, messageId, parts, user) {
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
          const currencies = await cryptoService.getSupportedCurrencies();
          return this.bot.sendMessage(chatId, `${bold('₿ Recarga via Criptomoeda')}\n\nEscolha a moeda:`, {
            parse_mode: 'HTML',
            ...MenuBuilder.cryptoCurrencyMenu(currencies),
          });
        }

        const amountStr = parts[2];
        if (!amountStr) {
          return this.bot.sendMessage(chatId, `${bold(`₿ Recarga ${curr.toUpperCase()}`)}\n\nEscolha o valor:`, {
            parse_mode: 'HTML',
            ...MenuBuilder.cryptoAmountMenu(curr),
          });
        }

        if (amountStr === 'amount') {
          this._setSession(chatId, { awaitingCryptoAmount: true, cryptoCurrency: curr });
          return this.bot.sendMessage(chatId, '✏️ Digite o valor em R$ para a recarga crypto:', {
            ...MenuBuilder.backButton('menu:recharge'),
          });
        }

        const cryptoAmount = parseFloat(amountStr);
        if (cryptoAmount > 0) {
          return this._createCryptoRecharge(chatId, user, cryptoAmount, curr);
        }
        return;
      }

      case 'manual': {
        return this._createManualRecharge(chatId, user);
      }

      case 'gift': {
        this._setSession(chatId, { awaitingGiftCode: true });
        return this.bot.sendMessage(chatId, '🎁 Digite o código do Gift Card:', {
          ...MenuBuilder.backButton('menu:recharge'),
        });
      }

      default:
        return;
    }
  }

  async _createPixRecharge(chatId, user, amount) {
    if (!amount || amount <= 0) {
      return this.bot.sendMessage(chatId, '❌ Valor inválido.');
    }

    try {
      const recharge = await rechargeService.createRecharge(
        user._id, this.botOid, this.ownerOid, amount, 'pix_auto'
      );

      const lines = [
        `${bold('📱 PIX Gerado')}`,
        separator(),
        `Valor: ${bold(currency(amount))}`,
        ``,
      ];

      if (recharge.paymentData?.copyPaste) {
        lines.push(`Copie o código abaixo:`);
        lines.push(`${code(recharge.paymentData.copyPaste)}`);
      } else if (recharge.pix_wallet) {
        lines.push(`Copie o código abaixo:`);
        lines.push(`${code(recharge.pix_wallet)}`);
      }

      lines.push(``);
      lines.push(`⏳ Aguardando pagamento... (30 min)`);
      lines.push(`O saldo será creditado automaticamente.`);

      await this.bot.sendMessage(chatId, lines.join('\n'), {
        parse_mode: 'HTML',
        ...MenuBuilder.backButton('menu:main'),
      });

      // Iniciar polling PIX
      const rechargeId = recharge.rechargeId || String(recharge._id);
      this.botInstance.paymentPoller.startPixPoll(rechargeId, chatId);
    } catch (err) {
      return this.bot.sendMessage(chatId, `❌ Erro ao gerar PIX: ${err.message}`, {
        ...MenuBuilder.backButton('menu:recharge'),
      });
    }
  }

  async _createCryptoRecharge(chatId, user, amount, curr) {
    if (!amount || amount <= 0) {
      return this.bot.sendMessage(chatId, '❌ Valor inválido.');
    }

    try {
      const recharge = await rechargeService.createRecharge(
        user._id, this.botOid, this.ownerOid, amount, 'crypto', { currency: curr }
      );

      const lines = [
        `${bold(`₿ Pagamento ${curr.toUpperCase()}`)}`,
        separator(),
        `Valor BRL: ${bold(currency(amount))}`,
      ];

      const pd = recharge.paymentData || recharge;
      if (pd.address) {
        lines.push(`Endereço:`);
        lines.push(`${code(pd.address)}`);
      }
      if (pd.amountCrypto) {
        lines.push(`Valor ${curr.toUpperCase()}: ${code(String(pd.amountCrypto))}`);
      }

      lines.push(``);
      lines.push(`⏳ Aguardando confirmação na blockchain...`);
      lines.push(`O saldo será creditado automaticamente.`);

      return this.bot.sendMessage(chatId, lines.join('\n'), {
        parse_mode: 'HTML',
        ...MenuBuilder.backButton('menu:main'),
      });
    } catch (err) {
      return this.bot.sendMessage(chatId, `❌ Erro crypto: ${err.message}`, {
        ...MenuBuilder.backButton('menu:recharge'),
      });
    }
  }

  async _createManualRecharge(chatId, user) {
    try {
      this._setSession(chatId, { awaitingManualAmount: true });
      return this.bot.sendMessage(chatId, [
        `${bold('🏦 Recarga Manual')}`,
        separator(),
        `Digite o valor que deseja recarregar:`,
      ].join('\n'), {
        parse_mode: 'HTML',
        ...MenuBuilder.backButton('menu:recharge'),
      });
    } catch (err) {
      return this.bot.sendMessage(chatId, `❌ Erro: ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════════
  // EXCHANGE FLOW (V2 exchange.py)
  // ═══════════════════════════════════════════════
  async _showExchangeMenu(chatId, user) {
    if (!this.botDoc.exchanges_enabled) {
      return this.bot.sendMessage(chatId, '🚫 Sistema de trocas desabilitado.');
    }

    // Contar cards elegíveis para troca (comprados recentemente, não trocados)
    const exchangeWindowHours = this.botDoc.metadata?.exchange_time_hours || 24;
    const cutoff = new Date(Date.now() - exchangeWindowHours * 60 * 60 * 1000);

    const eligibleCount = await Order.countDocuments({
      userId: user._id,
      bot_id: new mongoose.Types.ObjectId(this.botDoc._id),
      status: 'completed',
      refunded: { $ne: true },
      createdAt: { $gte: cutoff },
    });

    return this.bot.sendMessage(chatId, [
      `${bold('🔄 Sistema de Trocas')}`,
      separator(),
      `Cards elegíveis: ${bold(String(eligibleCount))}`,
      `Janela de troca: ${bold(`${exchangeWindowHours}h`)}`,
    ].join('\n'), {
      parse_mode: 'HTML',
      ...MenuBuilder.exchangeMenu(eligibleCount),
    });
  }

  async _handleExchange(chatId, messageId, parts, user) {
    const action = parts[0];

    switch (action) {
      case 'list': {
        const exchangeWindowHours = this.botDoc.metadata?.exchange_time_hours || 24;
        const cutoff = new Date(Date.now() - exchangeWindowHours * 60 * 60 * 1000);

        const orders = await Order.find({
          userId: user._id,
          bot_id: new mongoose.Types.ObjectId(this.botDoc._id),
          status: 'completed',
          refunded: { $ne: true },
          createdAt: { $gte: cutoff },
        }).sort({ createdAt: -1 }).limit(10).lean();

        if (!orders.length) {
          return this.bot.sendMessage(chatId, '📜 Nenhum card elegível para troca.', {
            ...MenuBuilder.backButton('menu:exchange'),
          });
        }

        const keyboard = orders.map((o) => [{
          text: `${cardMask(o.card?.bin || '------')} — ${currency(parseFloat(o.price?.toString() || '0'))} — ${formatDate(o.createdAt)}`,
          callback_data: `exchange:request:${o._id}`,
        }]);
        keyboard.push([{ text: '⬅️ Voltar', callback_data: 'menu:exchange' }]);

        return this.bot.sendMessage(chatId, `${bold('🔄 Selecione o card para troca:')}`, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard },
        });
      }

      case 'manual': {
        this._setSession(chatId, { awaitingExchangeCard: true });
        return this.bot.sendMessage(chatId, '✏️ Digite o número completo do card para troca:', {
          ...MenuBuilder.backButton('menu:exchange'),
        });
      }

      case 'request': {
        const orderId = parts[1];
        if (!orderId) return;

        // Atomic test-and-set para impedir double-refund
        const order = await Order.findOneAndUpdate(
          {
            _id: orderId,
            userId: user._id,
            status: 'completed',
            refunded: { $ne: true },
          },
          { $set: { refunded: true, refunded_at: new Date() } },
          { new: true }
        );

        if (!order) {
          return this.bot.sendMessage(chatId, '❌ Pedido não encontrado ou já trocado.');
        }

        const price = parseFloat(order.price?.toString() || '0');

        // Creditar saldo de volta
        const updatedUser = await User.findByIdAndUpdate(user._id, {
          $inc: {
            balance: mongoose.Types.Decimal128.fromString(price.toFixed(2)),
            totalSpent: mongoose.Types.Decimal128.fromString((-price).toFixed(2)),
            purchaseCount: -1,
          },
        }, { new: true });

        const newBalance = parseFloat(updatedUser?.balance?.toString() || '0');

        return this.bot.sendMessage(chatId, [
          `${bold('✅ Troca Processada!')}`,
          separator(),
          `Valor reembolsado: ${bold(currency(price))}`,
          `Novo saldo: ${bold(currency(newBalance))}`,
          ``,
          `Use o saldo para comprar um novo card.`,
        ].join('\n'), {
          parse_mode: 'HTML',
          ...MenuBuilder.backButton('menu:main'),
        });
      }

      default:
        return;
    }
  }

  // ═══════════════════════════════════════════════
  // ACCOUNT
  // ═══════════════════════════════════════════════
  async _handleAccount(chatId, messageId, parts, user) {
    const action = parts[0];

    switch (action) {
      case 'wallet': {
        const balance = parseFloat(user.balance?.toString() || '0');
        const spent = parseFloat(user.totalSpent?.toString() || '0');
        const recharged = parseFloat(user.total_recharged?.toString() || '0');

        return this.bot.sendMessage(chatId, [
          `${bold('💰 Sua Carteira')}`,
          separator(),
          `Saldo: ${bold(currency(balance))}`,
          `Total recarregado: ${currency(recharged)}`,
          `Total gasto: ${currency(spent)}`,
          `Compras: ${user.purchaseCount || 0}`,
        ].join('\n'), {
          parse_mode: 'HTML',
          ...MenuBuilder.backButton('menu:account'),
        });
      }

      case 'history': {
        const page = parseInt(parts[1], 10) || 1;
        const result = await purchaseService.getPurchaseHistory(user._id, this.botOid, { page, limit: 5 });

        if (!result.purchases?.length) {
          return this.bot.sendMessage(chatId, '📜 Nenhuma compra encontrada.', {
            ...MenuBuilder.backButton('menu:account'),
          });
        }

        const lines = [`${bold('📜 Histórico de Compras')}\n`];
        for (const order of result.purchases) {
          const orderPrice = parseFloat(order.price?.toString() || '0');
          lines.push(
            `${statusEmoji(order.status)} ${cardMask(order.card?.bin || order.card_bin)} — ${currency(orderPrice)} — ${formatDate(order.createdAt)}`
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
        const result = await rechargeService.getRechargeHistory(user._id, this.botOid, { page, limit: 5 });

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

      case 'diamonds': {
        const diamonds = user.diamonds || 0;
        const canSwap = diamonds >= 100;

        const keyboard = [];
        if (canSwap) {
          keyboard.push([{ text: '💱 Trocar Diamantes por Saldo', callback_data: 'account:swap_diamonds' }]);
        }
        keyboard.push([{ text: '⬅️ Voltar', callback_data: 'menu:account' }]);

        return this.bot.sendMessage(chatId, [
          `${bold('💎 Diamantes')}`,
          separator(),
          `Seus diamantes: ${bold(String(diamonds))}`,
          ``,
          `Ganhe diamantes a cada compra!`,
          canSwap ? `Mínimo para troca: 100 💎` : `Acumule pelo menos 100 💎 para trocar.`,
        ].join('\n'), {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard },
        });
      }

      case 'swap_diamonds': {
        const diamonds = user.diamonds || 0;
        if (diamonds < 100) {
          return this.bot.sendMessage(chatId, '❌ Mínimo de 100 diamantes para trocar.', {
            ...MenuBuilder.backButton('menu:account'),
          });
        }

        // 100 diamantes = R$ 1,00
        const creditValue = Math.floor(diamonds / 100);

        await User.findByIdAndUpdate(user._id, {
          $set: { diamonds: diamonds % 100 },
          $inc: { balance: mongoose.Types.Decimal128.fromString(creditValue.toFixed(2)) },
        });

        return this.bot.sendMessage(chatId, [
          `${bold('✅ Diamantes Trocados!')}`,
          separator(),
          `Diamantes trocados: ${bold(String(diamonds - (diamonds % 100)))}`,
          `Valor creditado: ${bold(currency(creditValue))}`,
          `Diamantes restantes: ${bold(String(diamonds % 100))}`,
        ].join('\n'), {
          parse_mode: 'HTML',
          ...MenuBuilder.backButton('menu:account'),
        });
      }

      case 'notify': {
        const currentNotify = user.notify !== false; // default true
        await User.findByIdAndUpdate(user._id, { notify: !currentNotify });

        return this.bot.sendMessage(chatId, [
          `${bold('🔔 Notificações')}`,
          separator(),
          `Status: ${!currentNotify ? '🟢 Ativadas' : '🔴 Desativadas'}`,
        ].join('\n'), {
          parse_mode: 'HTML',
          ...MenuBuilder.backButton('menu:account'),
        });
      }

      default:
        return;
    }
  }

  // ═══════════════════════════════════════════════
  // CHECK (subscription)
  // ═══════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════
  // ADMIN PANEL
  // ═══════════════════════════════════════════════
  async _handleAdmin(chatId, messageId, parts, user) {
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

    switch (action) {
      case 'settings':
        return this.bot.sendMessage(chatId, `${bold('⚙️ Configurações')}`, {
          parse_mode: 'HTML',
          ...MenuBuilder.adminSettingsMenu(),
        });

      case 'toggle': {
        const field = parts[1];
        const allowed = ['disable_purchases', 'disable_pix', 'referral_enabled', 'exchanges_enabled'];
        if (!allowed.includes(field)) return;

        const current = this.botDoc[field];
        await Bot.findByIdAndUpdate(this.botDoc._id, { [field]: !current });
        this.botDoc[field] = !current;

        const label = {
          disable_purchases: 'Compras',
          disable_pix: 'PIX',
          referral_enabled: 'Indicações',
          exchanges_enabled: 'Trocas',
        }[field];

        const isEnable = field.startsWith('disable_')
          ? (this.botDoc[field] ? '🔴 Desativado' : '🟢 Ativado')
          : (this.botDoc[field] ? '🟢 Ativado' : '🔴 Desativado');

        return this.bot.sendMessage(chatId, `${label}: ${isEnable}`, {
          ...MenuBuilder.adminSettingsMenu(),
        });
      }

      case 'edit': {
        const field = parts[1];
        const allowed = ['welcome_message', 'store_name', 'required_channel', 'help_message'];
        if (!allowed.includes(field)) return;

        const labels = {
          welcome_message: 'mensagem de boas-vindas',
          store_name: 'nome da loja',
          required_channel: 'canal obrigatório (@username)',
          help_message: 'mensagem de suporte',
        };

        this._setSession(chatId, { awaitingEdit: field });
        return this.bot.sendMessage(chatId, `✏️ Digite o novo valor para ${labels[field]}:`, {
          ...MenuBuilder.backButton('admin:settings'),
        });
      }

      case 'users': {
        const count = await User.countDocuments({ bot_id: this.botNumId });
        const activeCount = await User.countDocuments({
          bot_id: this.botNumId,
          telegram_last_seen: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        });

        return this.bot.sendMessage(chatId, [
          `${bold('👥 Usuários')}`,
          separator(),
          `Total: ${bold(String(count))}`,
          `Ativos (30d): ${bold(String(activeCount))}`,
          ``,
          `Use /userinfo {id} para buscar usuário.`,
        ].join('\n'), {
          parse_mode: 'HTML',
          ...MenuBuilder.backButton('admin:main'),
        });
      }

      case 'stock':
        return this.botInstance.adminCommands.getStockInfo(chatId);

      case 'stats':
        return this.botInstance.adminCommands.getStats(chatId);

      case 'finance':
        return this.botInstance.adminCommands.getReport(chatId, 0);

      case 'report': {
        const days = parseInt(parts[1], 10);
        if (isNaN(days)) {
          return this.bot.sendMessage(chatId, `${bold('📋 Relatório')}\n\nSelecione o período:`, {
            parse_mode: 'HTML',
            ...MenuBuilder.adminReportPeriodMenu(),
          });
        }
        return this.botInstance.adminCommands.getReport(chatId, days);
      }

      case 'broadcast': {
        this._setSession(chatId, { awaitingBroadcast: true });
        return this.bot.sendMessage(chatId, '📢 Digite a mensagem do broadcast:', {
          ...MenuBuilder.backButton('admin:main'),
        });
      }

      case 'giftcards': {
        this._setSession(chatId, { awaitingGiftValue: true });
        return this.bot.sendMessage(chatId, '🎁 Digite o valor do Gift Card a ser criado:', {
          ...MenuBuilder.backButton('admin:main'),
        });
      }

      case 'refund': {
        this._setSession(chatId, { awaitingRefundId: true });
        return this.bot.sendMessage(chatId, '🔄 Digite o ID do pedido para reembolsar:', {
          ...MenuBuilder.backButton('admin:main'),
        });
      }

      case 'toggle_ban': {
        const targetUserId = parts[1];
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
          return this.bot.sendMessage(chatId, '❌ Usuário não encontrado.');
        }
        return this.botInstance.adminCommands.banUser(chatId, targetUserId, !targetUser.banned);
      }

      case 'unban': {
        const uid = parts[1];
        // Desbanir do antiflood
        this.botInstance.antiFlood.unban(uid);
        return this.bot.sendMessage(chatId, '✅ Usuário desbanido do antiflood.');
      }

      case 'zero_balance': {
        const targetId = parts[1];
        await User.findByIdAndUpdate(targetId, {
          $set: { balance: mongoose.Types.Decimal128.fromString('0.00') },
        });
        return this.bot.sendMessage(chatId, '✅ Saldo zerado.', {
          ...MenuBuilder.backButton('admin:main'),
        });
      }

      case 'user_history': {
        const targetId = parts[1];
        const orders = await Order.find({
          userId: targetId,
          bot_id: new mongoose.Types.ObjectId(this.botDoc._id),
        }).sort({ createdAt: -1 }).limit(10).lean();

        if (!orders.length) {
          return this.bot.sendMessage(chatId, '📜 Nenhuma compra encontrada.', {
            ...MenuBuilder.backButton('admin:main'),
          });
        }

        const lines = [`${bold('📜 Histórico do Usuário')}\n`];
        for (const o of orders) {
          const p = parseFloat(o.price?.toString() || '0');
          lines.push(`${statusEmoji(o.status)} ${cardMask(o.card?.bin || '------')} — ${currency(p)} — ${formatDate(o.createdAt)}`);
        }

        return this.bot.sendMessage(chatId, lines.join('\n'), {
          parse_mode: 'HTML',
          ...MenuBuilder.backButton('admin:main'),
        });
      }

      default:
        return this.bot.sendMessage(chatId, '⚙️ Funcionalidade em desenvolvimento.', {
          ...MenuBuilder.backButton('admin:main'),
        });
    }
  }

  // ═══════════════════════════════════════════════
  // TEXT MESSAGE (awaiting input)
  // ═══════════════════════════════════════════════
  async handleTextMessage(msg) {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);
    const text = (msg.text || '').trim();

    // Setar contexto de telegramId para isolamento de sessões
    this._currentTelegramId = telegramId;

    const session = this._getSession(chatId);
    if (!session) return false;

    const user = await User.findByTelegram(telegramId, this.botNumId);
    if (!user) return false;

    // PIX amount
    if (session.awaitingPixAmount) {
      this._clearSession(chatId);
      const amount = parseFloat(text.replace(',', '.'));
      if (!amount || amount <= 0) {
        return this.bot.sendMessage(chatId, '❌ Valor inválido. Digite um número positivo.');
      }
      await this._createPixRecharge(chatId, user, amount);
      return true;
    }

    // Crypto amount
    if (session.awaitingCryptoAmount) {
      this._clearSession(chatId);
      const amount = parseFloat(text.replace(',', '.'));
      if (!amount || amount <= 0) {
        return this.bot.sendMessage(chatId, '❌ Valor inválido. Digite um número positivo.');
      }
      await this._createCryptoRecharge(chatId, user, amount, session.cryptoCurrency);
      return true;
    }

    // Manual recharge amount
    if (session.awaitingManualAmount) {
      this._clearSession(chatId);
      const amount = parseFloat(text.replace(',', '.'));
      if (!amount || amount <= 0) {
        return this.bot.sendMessage(chatId, '❌ Valor inválido.');
      }
      const recharge = await rechargeService.createRecharge(
        user._id, this.botOid, this.ownerOid, amount, 'manual'
      );
      return this.bot.sendMessage(chatId, [
        `${bold('🏦 Recarga Manual')}`,
        separator(),
        `ID: ${code(String(recharge.rechargeId || recharge._id))}`,
        `Valor: ${bold(currency(amount))}`,
        ``,
        `Envie o comprovante ao administrador e aguarde aprovação.`,
      ].join('\n'), {
        parse_mode: 'HTML',
        ...MenuBuilder.backButton('menu:main'),
      });
    }

    // Gift card
    if (session.awaitingGiftCode) {
      this._clearSession(chatId);
      try {
        const gift = await GiftCard.findOneAndUpdate(
          { code: text.toUpperCase(), status: 'active' },
          { $set: { status: 'redeemed', redeemed_by: user._id, redeemed_at: new Date() } },
          { new: false }
        );

        if (!gift) {
          return this.bot.sendMessage(chatId, '❌ Código inválido ou já utilizado.', {
            ...MenuBuilder.backButton('menu:recharge'),
          });
        }

        const giftValue = parseFloat(gift.value?.toString() || '0');
        await User.findByIdAndUpdate(user._id, {
          $inc: { balance: mongoose.Types.Decimal128.fromString(giftValue.toFixed(2)) },
        });

        return this.bot.sendMessage(chatId, [
          `${bold('🎁 Gift Card Resgatado!')}`,
          separator(),
          `Valor: ${bold(currency(giftValue))}`,
          `Seu saldo foi atualizado.`,
        ].join('\n'), {
          parse_mode: 'HTML',
          ...MenuBuilder.backButton('menu:main'),
        });
      } catch (err) {
        return this.bot.sendMessage(chatId, `❌ Erro ao resgatar: ${err.message}`);
      }
    }

    // BIN search
    if (session.awaitingBinSearch) {
      this._clearSession(chatId);
      const bin = text.replace(/\D/g, '').substring(0, 6);
      if (bin.length < 4) {
        return this.bot.sendMessage(chatId, '❌ Digite pelo menos 4 dígitos da BIN.');
      }

      const cards = await Card.find({
        bot_id: new mongoose.Types.ObjectId(this.botDoc._id),
        bin: { $regex: `^${bin}` },
        status: 'available',
      }).select('_id').sort({ _id: 1 }).lean();

      if (!cards.length) {
        return this.bot.sendMessage(chatId, `📦 Nenhum card encontrado para BIN ${bin}.`, {
          ...MenuBuilder.backButton('menu:buy'),
        });
      }

      const cardIds = cards.map((c) => String(c._id));
      this.botInstance.paginator.init(String(user._id), cardIds, { bin });
      return this._showCardPreview(chatId, user);
    }

    // Exchange manual card
    if (session.awaitingExchangeCard) {
      this._clearSession(chatId);
      const cardNumber = text.replace(/\D/g, '');

      const order = await Order.findOne({
        userId: user._id,
        bot_id: new mongoose.Types.ObjectId(this.botDoc._id),
        'card.number': cardNumber,
        status: 'completed',
        refunded: { $ne: true },
      }).lean();

      if (!order) {
        return this.bot.sendMessage(chatId, '❌ Card não encontrado no seu histórico ou já trocado.', {
          ...MenuBuilder.backButton('menu:exchange'),
        });
      }

      // Processar troca
      const price = parseFloat(order.price?.toString() || '0');
      await Order.findByIdAndUpdate(order._id, {
        $set: { refunded: true, refunded_at: new Date() },
      });
      await User.findByIdAndUpdate(user._id, {
        $inc: { balance: mongoose.Types.Decimal128.fromString(price.toFixed(2)) },
      });

      return this.bot.sendMessage(chatId, [
        `${bold('✅ Troca Processada!')}`,
        separator(),
        `Valor reembolsado: ${bold(currency(price))}`,
      ].join('\n'), {
        parse_mode: 'HTML',
        ...MenuBuilder.backButton('menu:main'),
      });
    }

    // Admin: edit field (com role check)
    if (session.awaitingEdit) {
      this._clearSession(chatId);
      if (user.role !== 'admin' && user.role !== 'superadmin') return false;
      const field = session.awaitingEdit;
      await Bot.findByIdAndUpdate(this.botDoc._id, { [field]: text });
      this.botDoc[field] = text;

      return this.bot.sendMessage(chatId, `✅ Atualizado com sucesso!`, {
        ...MenuBuilder.adminSettingsMenu(),
      });
    }

    // Admin: broadcast
    if (session.awaitingBroadcast) {
      this._clearSession(chatId);
      if (user.role !== 'admin' && user.role !== 'superadmin') return false;
      await this.botInstance.adminCommands.broadcast(chatId, user, text);
      return true;
    }

    // Admin: gift card creation
    if (session.awaitingGiftValue) {
      this._clearSession(chatId);
      if (user.role !== 'admin' && user.role !== 'superadmin') return false;
      await this.botInstance.adminCommands.createGiftCard(chatId, text);
      return true;
    }

    // Admin: refund
    if (session.awaitingRefundId) {
      this._clearSession(chatId);
      if (user.role !== 'admin' && user.role !== 'superadmin') return false;
      if (!mongoose.isValidObjectId(text)) {
        return this.bot.sendMessage(chatId, '❌ ID de pedido inválido.');
      }
      await this.botInstance.adminCommands.refundOrder(chatId, text);
      return true;
    }

    return false;
  }

  // ═══════════════════════════════════════════════
  // PURCHASE HELPER
  // ═══════════════════════════════════════════════
  async _purchaseByCardId(user, cardId) {
    // Reservar atomicamente o card específico
    const card = await Card.findOneAndUpdate(
      {
        _id: cardId,
        bot_id: new mongoose.Types.ObjectId(this.botDoc._id),
        status: 'available',
      },
      { $set: { status: 'locked' } },
      { new: true }
    );

    if (!card) {
      const err = new Error('Card não está mais disponível.');
      err.statusCode = 404;
      throw err;
    }

    try {
      return await purchaseService.purchaseCard(
        user._id,
        this.botOid,
        { bin: card.bin, country: card.country }
      );
    } catch (err) {
      // Liberar card se a compra falhou
      await Card.findByIdAndUpdate(cardId, { status: 'available' });
      throw err;
    }
  }

  // ═══════════════════════════════════════════════
  // SESSION MANAGEMENT
  // Keyed por telegramId (não chatId) para isolamento em grupos.
  // O _currentTelegramId é setado no início de handle() e handleTextMessage().
  // ═══════════════════════════════════════════════
  _sessionKey(chatId) {
    // Usar telegramId do contexto atual para isolar sessões por usuário
    const uid = this._currentTelegramId || chatId;
    return String(uid);
  }

  _setSession(chatId, data) {
    this.sessions.set(this._sessionKey(chatId), { ...data, ts: Date.now() });
  }

  _updateSession(chatId, data) {
    const key = this._sessionKey(chatId);
    const existing = this.sessions.get(key) || {};
    this.sessions.set(key, { ...existing, ...data, ts: Date.now() });
  }

  _getSession(chatId) {
    const key = this._sessionKey(chatId);
    const session = this.sessions.get(key);
    if (!session) return null;
    if (Date.now() - session.ts > 10 * 60 * 1000) {
      this.sessions.delete(key);
      return null;
    }
    return session;
  }

  _clearSession(chatId) {
    this.sessions.delete(this._sessionKey(chatId));
  }
}

module.exports = CallbackRouter;
