'use strict';

const TelegramBot = require('node-telegram-bot-api');
const { Bot } = require('../../database/schemas');
const CallbackRouter = require('./CallbackRouter');
const AdminCommands = require('./AdminCommands');
const UserRegistration = require('./UserRegistration');
const MenuBuilder = require('./MenuBuilder');
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
  }

  async start() {
    if (this.status === 'running') return;

    const token = this.botDoc.bot_token;
    if (!token) {
      this.status = 'error';
      throw new Error(`Bot ${this.botDoc.bot_name}: token não encontrado`);
    }

    try {
      this.bot = new TelegramBot(token, { polling: true });
      this.callbackRouter = new CallbackRouter(this);
      this.adminCommands = new AdminCommands(this);

      this._registerHandlers();

      this.status = 'running';
      this._startedAt = Date.now();

      await Bot.findByIdAndUpdate(this.botId, {
        runtime_status: 'running',
        last_heartbeat: new Date(),
      });

      console.log(`[BotInstance] ${this.botDoc.bot_name} iniciado (polling)`);
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

    this.status = 'stopped';
    this.callbackRouter = null;
    this.adminCommands = null;
    this._startedAt = null;

    await Bot.findByIdAndUpdate(this.botId, { runtime_status: 'stopped' });
    console.log(`[BotInstance] ${this.botDoc.bot_name} parado`);
  }

  async restart() {
    await this.stop();
    this.botDoc = await Bot.findById(this.botId).select('+bot_token').lean();
    if (!this.botDoc) throw new Error(`Bot ${this.botId} não encontrado no DB`);
    await this.start();
  }

  get uptime() {
    if (!this._startedAt || this.status !== 'running') return 0;
    return Math.floor((Date.now() - this._startedAt) / 1000);
  }

  _registerHandlers() {
    this.bot.onText(/\/start(.*)/, (msg) => {
      this._safe(() => UserRegistration.handleStart(this.bot, msg, this.botDoc));
    });

    this.bot.onText(/\/menu/, (msg) => {
      this._safe(() =>
        this.bot.sendMessage(msg.chat.id, 'Escolha uma opção:', {
          parse_mode: 'HTML',
          ...MenuBuilder.mainMenu(this.botDoc),
        })
      );
    });

    this.bot.onText(/\/saldo/, (msg) => {
      this._safe(async () => {
        const { User } = require('../../database/schemas');
        const user = await User.findByTelegram(String(msg.from.id), this.botDoc.id);
        if (!user) return this.bot.sendMessage(msg.chat.id, '❌ Conta não encontrada. Envie /start');
        const balance = parseFloat(user.balance?.toString() || '0');
        return this.bot.sendMessage(msg.chat.id, `💰 Saldo: ${bold(currency(balance))}`, { parse_mode: 'HTML' });
      });
    });

    this.bot.onText(/\/suporte/, (msg) => {
      this._safe(() =>
        this.bot.sendMessage(msg.chat.id, [
          `${bold('📞 Suporte')}`,
          ``,
          this.botDoc.help_message || 'Entre em contato com o administrador.',
        ].join('\n'), { parse_mode: 'HTML' })
      );
    });

    this.bot.onText(/\/admin/, (msg) => {
      this._safe(() => this.adminCommands.handleAdminCommand(msg));
    });

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

    this.bot.on('callback_query', (query) => {
      this._safe(() => this.callbackRouter.handle(query));
    });

    this.bot.on('message', (msg) => {
      if (msg.text && msg.text.startsWith('/')) return;
      this._safe(() => this.callbackRouter.handleTextMessage(msg));
    });

    this.bot.on('polling_error', (err) => {
      if (err.code === 'ETELEGRAM' && err.response?.statusCode === 409) {
        console.warn(`[BotInstance] ${this.botDoc.bot_name}: conflito de polling (outra instância?)`);
        return;
      }
      console.error(`[BotInstance] ${this.botDoc.bot_name} polling error: ${err.message}`);
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
        console.error(`[BotInstance] ${this.botDoc.bot_name}: ${err.message}`);
      });
  }
}

module.exports = BotInstance;
