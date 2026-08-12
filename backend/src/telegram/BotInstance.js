'use strict';

/**
 * BotInstance V3 — Instância completa de um bot Telegram.
 *
 * Porta completa do V2 Python (bot.py + plugins):
 * - AntiFlood integrado (group -3/-4 do V2)
 * - PurchaseLock (lock_user_buy, lock_navigation)
 * - CardPaginator (preView + navegação)
 * - PaymentPoller (PIX auto-check + crypto auto-checker)
 * - GateChecker integrado
 * - Auto-reconnect com backoff exponencial
 * - Recovery de pagamentos pendentes no startup
 */

const TelegramBot = require('node-telegram-bot-api');
const { Bot } = require('../../database/schemas');
const CallbackRouter = require('./CallbackRouter');
const AdminCommands = require('./AdminCommands');
const UserRegistration = require('./UserRegistration');
const MenuBuilder = require('./MenuBuilder');
const AntiFlood = require('./core/AntiFlood');
const PurchaseLock = require('./core/PurchaseLock');
const CardPaginator = require('./core/CardPaginator');
const PaymentPoller = require('./core/PaymentPoller');
const { bold, currency } = require('./utils/messageFormatter');

class BotInstance {
  constructor(botDoc) {
    this.botDoc = botDoc;
    this.botId = String(botDoc._id);
    this.bot = null;
    this.callbackRouter = null;
    this.adminCommands = null;
    this.status = 'stopped';
    this._startedAt = null;

    // Core V3 modules
    this.antiFlood = new AntiFlood();
    this.purchaseLock = new PurchaseLock();
    this.paginator = new CardPaginator();
    this.paymentPoller = null;

    // Paginator cleanup timer
    this._paginatorCleanup = null;
  }

  async start() {
    if (this.status === 'running') return;

    const token = this.botDoc.bot_token;
    if (!token) {
      this.status = 'error';
      throw new Error(`Bot ${(this.botDoc.bot_name || this.botDoc.name || this.botDoc.store_name)}: token não encontrado`);
    }

    try {
      this.bot = new TelegramBot(token, { polling: true });
      this.callbackRouter = new CallbackRouter(this);
      this.adminCommands = new AdminCommands(this);
      this.paymentPoller = new PaymentPoller(this);

      this._registerHandlers();

      this.status = 'running';
      this._startedAt = Date.now();

      await Bot.findByIdAndUpdate(this.botId, {
        runtime_status: 'running',
        last_heartbeat: new Date(),
      });

      // Iniciar background tasks (como no V2 bot.py startup)
      this.paymentPoller.startCryptoChecker();
      this.paymentPoller.recoverPendingPayments().catch((err) => {
        console.error(`[BotInstance] ${this._name()}: Erro recovery: ${err.message}`);
      });

      // Cleanup de paginação a cada 5 minutos
      this._paginatorCleanup = setInterval(() => this.paginator.cleanup(), 5 * 60 * 1000);

      console.log(`[BotInstance] ${this._name()} iniciado (polling) — V3 core ativo`);
    } catch (err) {
      this.status = 'error';
      await Bot.findByIdAndUpdate(this.botId, { runtime_status: 'error' });
      throw err;
    }
  }

  async stop() {
    if (this.bot) {
      try {
        await this.bot.stopPolling();
      } catch {
        // ignore
      }
      this.bot.removeAllListeners();
      this.bot = null;
    }

    // Limpar V3 modules
    this.antiFlood.destroy();
    this.purchaseLock.destroy();
    this.paginator.destroy();
    if (this.paymentPoller) {
      this.paymentPoller.destroy();
      this.paymentPoller = null;
    }
    if (this._paginatorCleanup) {
      clearInterval(this._paginatorCleanup);
      this._paginatorCleanup = null;
    }

    this.status = 'stopped';
    this.callbackRouter = null;
    this.adminCommands = null;
    this._startedAt = null;

    await Bot.findByIdAndUpdate(this.botId, { runtime_status: 'stopped' });
    console.log(`[BotInstance] ${this._name()} parado`);
  }

  async restart() {
    await this.stop();

    // Re-instanciar módulos limpos
    this.antiFlood = new AntiFlood();
    this.purchaseLock = new PurchaseLock();
    this.paginator = new CardPaginator();

    this.botDoc = await Bot.findById(this.botId).select('+bot_token').lean();
    if (!this.botDoc) throw new Error(`Bot ${this.botId} não encontrado no DB`);
    await this.start();
  }

  get uptime() {
    if (!this._startedAt || this.status !== 'running') return 0;
    return Math.floor((Date.now() - this._startedAt) / 1000);
  }

  _name() {
    return this.botDoc.bot_name || this.botDoc.name || this.botDoc.store_name || this.botId;
  }

  _registerHandlers() {
    // ─── Debug: log all incoming messages ───
    this.bot.on('message', (msg) => {
      console.log(`[BotInstance] ${this._name()} recebeu msg: "${msg.text}" de ${msg.from?.id} (${msg.from?.first_name})`);
    });

    // ─── /start — Registro + boas-vindas ───
    this.bot.onText(/\/start(.*)/, (msg) => {
      this._safe(() => {
        // AntiFlood check (group -3 do V2)
        const flood = this.antiFlood.checkText(String(msg.from.id));
        if (flood.banned) {
          if (flood.level === 'CRITICAL') {
            return this.bot.sendMessage(msg.chat.id, '🚫 Flood detectado. Aguarde 30 segundos.');
          }
          return;
        }
        return UserRegistration.handleStart(this.bot, msg, this.botDoc);
      });
    });

    // ─── /menu ───
    this.bot.onText(/\/menu/, (msg) => {
      this._safe(() => {
        const flood = this.antiFlood.checkText(String(msg.from.id));
        if (flood.banned) return;
        return this.bot.sendMessage(msg.chat.id, 'Escolha uma opção:', {
          parse_mode: 'HTML',
          ...MenuBuilder.mainMenu(this.botDoc),
        });
      });
    });

    // ─── /saldo ───
    this.bot.onText(/\/saldo/, (msg) => {
      this._safe(async () => {
        const flood = this.antiFlood.checkText(String(msg.from.id));
        if (flood.banned) return;
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user) return this.bot.sendMessage(msg.chat.id, '❌ Conta não encontrada. Envie /start');
        const balance = parseFloat(user.balance?.toString() || '0');
        return this.bot.sendMessage(msg.chat.id, `💰 Saldo: ${bold(currency(balance))}`, { parse_mode: 'HTML' });
      });
    });

    // ─── /pix [valor] — Atalho PIX ───
    this.bot.onText(/\/pix\s*(.*)/, (msg, match) => {
      this._safe(async () => {
        const flood = this.antiFlood.checkText(String(msg.from.id));
        if (flood.banned) return;

        if (this.botDoc.disable_pix) {
          return this.bot.sendMessage(msg.chat.id, '🚫 PIX desabilitado.');
        }

        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user) return this.bot.sendMessage(msg.chat.id, '❌ Envie /start primeiro.');

        const valueStr = (match[1] || '').trim();
        if (valueStr) {
          const amount = parseFloat(valueStr.replace(',', '.'));
          if (amount > 0) {
            return this.callbackRouter._createPixRecharge(msg.chat.id, user, amount);
          }
        }

        return this.bot.sendMessage(msg.chat.id, `${bold('📱 Recarga via PIX')}\n\nEscolha o valor:`, {
          parse_mode: 'HTML',
          ...MenuBuilder.pixAmountMenu(),
        });
      });
    });

    // ─── /cripto [valor] — Atalho crypto ───
    this.bot.onText(/\/(cripto|crypto)\s*(.*)/, (msg, match) => {
      this._safe(async () => {
        const flood = this.antiFlood.checkText(String(msg.from.id));
        if (flood.banned) return;

        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user) return this.bot.sendMessage(msg.chat.id, '❌ Envie /start primeiro.');

        const cryptoService = require('../services/crypto.service');
        const currencies = await cryptoService.getSupportedCurrencies();
        return this.bot.sendMessage(msg.chat.id, `${bold('₿ Recarga via Criptomoeda')}\n\nEscolha a moeda:`, {
          parse_mode: 'HTML',
          ...MenuBuilder.cryptoCurrencyMenu(currencies),
        });
      });
    });

    // ─── /suporte ───
    this.bot.onText(/\/suporte/, (msg) => {
      this._safe(() => {
        const flood = this.antiFlood.checkText(String(msg.from.id));
        if (flood.banned) return;
        return this.bot.sendMessage(msg.chat.id, [
          `${bold('📞 Suporte')}`,
          ``,
          this.botDoc.help_message || 'Entre em contato com o administrador.',
        ].join('\n'), { parse_mode: 'HTML' });
      });
    });

    // ─── /admin ───
    this.bot.onText(/\/admin/, (msg) => {
      this._safe(() => {
        const flood = this.antiFlood.checkText(String(msg.from.id));
        if (flood.banned) return;
        return this.adminCommands.handleAdminCommand(msg);
      });
    });

    // ─── /painel — Admin panel (V2 compat) ───
    this.bot.onText(/\/painel/, (msg) => {
      this._safe(() => {
        const flood = this.antiFlood.checkText(String(msg.from.id));
        if (flood.banned) return;
        return this.adminCommands.handleAdminCommand(msg);
      });
    });

    // ─── /broadcast <text> ───
    this.bot.onText(/\/broadcast (.+)/, (msg, match) => {
      this._safe(async () => {
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
          return this.bot.sendMessage(msg.chat.id, '🚫 Acesso negado.');
        }
        return this.adminCommands.broadcast(msg.chat.id, user, match[1]);
      });
    });

    // ─── /enviar (V2 compat) ───
    this.bot.onText(/\/enviar (.+)/, (msg, match) => {
      this._safe(async () => {
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
          return this.bot.sendMessage(msg.chat.id, '🚫 Acesso negado.');
        }
        return this.adminCommands.broadcast(msg.chat.id, user, match[1]);
      });
    });

    // ─── /cancelbroadcast <id> ───
    this.bot.onText(/\/cancelbroadcast (.+)/, (msg, match) => {
      this._safe(async () => {
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
          return this.bot.sendMessage(msg.chat.id, '🚫 Acesso negado.');
        }
        return this.adminCommands.cancelBroadcast(msg.chat.id, match[1]);
      });
    });

    // ─── /stats ───
    this.bot.onText(/\/stats/, (msg) => {
      this._safe(async () => {
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
          return this.bot.sendMessage(msg.chat.id, '🚫 Acesso negado.');
        }
        return this.adminCommands.getStats(msg.chat.id);
      });
    });

    // ─── /relatorio [dias] (V2 compat) ───
    this.bot.onText(/\/(relatorio|report)\s*(.*)/, (msg, match) => {
      this._safe(async () => {
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
          return this.bot.sendMessage(msg.chat.id, '🚫 Acesso negado.');
        }
        const days = parseInt(match[2], 10) || 0;
        return this.adminCommands.getReport(msg.chat.id, days);
      });
    });

    // ─── /userinfo <id> ───
    this.bot.onText(/\/userinfo (.+)/, (msg, match) => {
      this._safe(async () => {
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
          return this.bot.sendMessage(msg.chat.id, '🚫 Acesso negado.');
        }
        return this.adminCommands.getUserInfo(msg.chat.id, match[1].trim());
      });
    });

    // ─── /addbalance <id> <valor> ───
    this.bot.onText(/\/addbalance (\S+) (.+)/, (msg, match) => {
      this._safe(async () => {
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
          return this.bot.sendMessage(msg.chat.id, '🚫 Acesso negado.');
        }
        return this.adminCommands.addBalance(msg.chat.id, match[1].trim(), match[2].trim());
      });
    });

    // ─── /reembolsar <orderId> (V2 compat) ───
    this.bot.onText(/\/reembolsar (.+)/, (msg, match) => {
      this._safe(async () => {
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
          return this.bot.sendMessage(msg.chat.id, '🚫 Acesso negado.');
        }
        return this.adminCommands.refundOrder(msg.chat.id, match[1].trim());
      });
    });

    // ─── /ban <id> ───
    this.bot.onText(/\/ban (.+)/, (msg, match) => {
      this._safe(async () => {
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
          return this.bot.sendMessage(msg.chat.id, '🚫 Acesso negado.');
        }
        return this.adminCommands.banUser(msg.chat.id, match[1].trim(), true);
      });
    });

    // ─── /unban <id> ───
    this.bot.onText(/\/unban (.+)/, (msg, match) => {
      this._safe(async () => {
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
          return this.bot.sendMessage(msg.chat.id, '🚫 Acesso negado.');
        }
        return this.adminCommands.banUser(msg.chat.id, match[1].trim(), false);
      });
    });

    // ─── /users (V2 compat) ───
    this.bot.onText(/\/users/, (msg) => {
      this._safe(async () => {
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
          return this.bot.sendMessage(msg.chat.id, '🚫 Acesso negado.');
        }
        const count = await User.countDocuments({ bot_id: this.botDoc.id });
        return this.bot.sendMessage(msg.chat.id, `👥 Total de usuários: ${bold(String(count))}`, {
          parse_mode: 'HTML',
        });
      });
    });

    // ─── CALLBACK QUERIES ───
    this.bot.on('callback_query', (query) => {
      this._safe(() => this.callbackRouter.handle(query));
    });

    // ─── TEXT MESSAGES (awaiting input) ───
    this.bot.on('message', (msg) => {
      if (msg.text && msg.text.startsWith('/')) return;
      this._safe(() => this.callbackRouter.handleTextMessage(msg));
    });

    // ─── POLLING ERRORS ───
    this.bot.on('polling_error', (err) => {
      if (err.code === 'ETELEGRAM' && err.response?.statusCode === 409) {
        console.warn(`[BotInstance] ${this._name()}: conflito de polling (outra instância?)`);
        return;
      }
      console.error(`[BotInstance] ${this._name()} polling error: ${err.message}`);
      if (err.response?.statusCode === 401) {
        this.status = 'error';
        Bot.findByIdAndUpdate(this.botId, { runtime_status: 'error' }).catch(() => {});
      }
    });
  }

  _safe(fn) {
    Promise.resolve()
      .then(fn)
      .catch((err) => {
        console.error(`[BotInstance] ${this._name()}: ${err.message}`);
      });
  }
}

module.exports = BotInstance;
