'use strict';

const TelegramBot = require('node-telegram-bot-api');
const { User, Bot } = require('../../database/schemas');

class TelegramService {
  constructor() {
    this._botManager = null;
  }

  setBotManager(botManager) {
    this._botManager = botManager;
  }

  async sendMessage(chatId, message, options = {}) {
    const { botId, parseMode = 'HTML', replyMarkup, disablePreview = false, replyToMessageId } = options;

    if (!botId) {
      const err = new Error('botId é obrigatório para envio de mensagem');
      err.statusCode = 400;
      throw err;
    }

    const instance = this._botManager?.getInstance(botId);
    if (!instance || !instance.bot) {
      const err = new Error(`Bot ${botId} não está rodando`);
      err.statusCode = 503;
      throw err;
    }

    const sendOpts = {
      parse_mode: parseMode,
      disable_web_page_preview: disablePreview,
    };
    if (replyMarkup) sendOpts.reply_markup = replyMarkup;
    if (replyToMessageId) sendOpts.reply_to_message_id = replyToMessageId;

    const result = await instance.bot.sendMessage(chatId, message, sendOpts);
    return {
      messageId: result.message_id,
      chat: result.chat,
      date: result.date,
    };
  }

  async sendBroadcast(botId, message, filters = {}) {
    const instance = this._botManager?.getInstance(botId);
    if (!instance || !instance.adminCommands) {
      const err = new Error(`Bot ${botId} não está rodando`);
      err.statusCode = 503;
      throw err;
    }

    const broadcastId = await instance.adminCommands.broadcast(
      null, null, message, { onlyActive: filters.activeOnly }
    );

    return { broadcastId, status: 'started' };
  }

  async getBotInfo(botToken) {
    if (!botToken || typeof botToken !== 'string') {
      const err = new Error('Token inválido');
      err.statusCode = 400;
      throw err;
    }

    const tempBot = new TelegramBot(botToken);
    try {
      const me = await tempBot.getMe();
      return {
        id: me.id,
        username: me.username,
        firstName: me.first_name,
        canJoinGroups: me.can_join_groups,
        canReadMessages: me.can_read_all_group_messages,
      };
    } finally {
      tempBot.removeAllListeners();
    }
  }

  async registerWebhook(botId, webhookUrl) {
    const botDoc = await Bot.findById(botId).select('+bot_token').lean();
    if (!botDoc) {
      const err = new Error('Bot não encontrado');
      err.statusCode = 404;
      throw err;
    }

    const tempBot = new TelegramBot(botDoc.bot_token);
    try {
      await tempBot.setWebHook(webhookUrl);
      return { success: true, webhookUrl };
    } finally {
      tempBot.removeAllListeners();
    }
  }

  async handleUpdate(botId, update) {
    const instance = this._botManager?.getInstance(botId);
    if (!instance || !instance.bot) {
      return { handled: false, action: 'bot_not_running' };
    }

    instance.bot.processUpdate(update);
    return { handled: true, action: 'processed' };
  }

  async getUsers(botId, filters = {}) {
    const { search, activeOnly, page = 1, limit = 50 } = filters;

    const query = { bot_id: botId };
    if (activeOnly) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query.telegram_last_seen = { $gte: thirtyDaysAgo };
    }
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { telegram_username: { $regex: search, $options: 'i' } },
        { telegram_id: search },
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      User.countDocuments(query),
    ]);

    return {
      users,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / lim),
    };
  }
}

module.exports = new TelegramService();
