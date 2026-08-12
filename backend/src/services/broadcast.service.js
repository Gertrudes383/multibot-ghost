'use strict';

const mongoose = require('mongoose');
const { User, Activity } = require('../../database/schemas');
const { BroadcastRateLimiter } = require('../telegram/utils/rateLimiter');

class BroadcastService {
  constructor() {
    this._botManager = null;
    this._active = new Map();
  }

  setBotManager(botManager) {
    this._botManager = botManager;
  }

  async createBroadcast(botId, message, filters = {}) {
    if (!message || !message.trim()) {
      const err = new Error('Mensagem de broadcast não pode ser vazia');
      err.statusCode = 400;
      throw err;
    }

    const instance = this._botManager?.getInstance(botId);
    if (!instance || !instance.bot) {
      const err = new Error(`Bot ${botId} não está rodando`);
      err.statusCode = 503;
      throw err;
    }

    const query = { bot_id: botId, banned: false };
    if (filters.activeOnly !== false) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      query.telegram_last_seen = { $gte: thirtyDaysAgo };
    }
    if (filters.lastActiveAfter) {
      query.telegram_last_seen = { $gte: new Date(filters.lastActiveAfter) };
    }
    if (filters.minBalance) {
      query.balance = { $gte: mongoose.Types.Decimal128.fromString(String(filters.minBalance)) };
    }
    if (filters.minPurchases) {
      query.purchaseCount = { $gte: filters.minPurchases };
    }

    const users = await User.find(query).select('telegram_id').lean();
    if (!users.length) {
      return { broadcastId: null, totalRecipients: 0, status: 'empty' };
    }

    const broadcastId = new mongoose.Types.ObjectId().toString();
    const limiter = new BroadcastRateLimiter();
    const parseMode = filters.parseMode || 'HTML';

    const state = {
      limiter,
      broadcastId,
      totalRecipients: users.length,
      delivered: 0,
      failed: 0,
      blocked: 0,
      status: 'running',
      startedAt: new Date(),
      completedAt: null,
      message,
    };

    this._active.set(broadcastId, state);

    setImmediate(async () => {
      for (const u of users) {
        if (state.status === 'cancelled') break;
        if (!u.telegram_id) { state.failed++; continue; }

        limiter.enqueue(async () => {
          try {
            await instance.bot.sendMessage(u.telegram_id, message, { parse_mode: parseMode });
            state.delivered++;
          } catch (err) {
            if (err.response?.statusCode === 403) {
              state.blocked++;
            }
            state.failed++;
          }
        }).catch(() => { state.failed++; });
      }

      const waitDone = setInterval(() => {
        if (limiter.pending === 0 || state.status === 'cancelled') {
          clearInterval(waitDone);
          if (state.status !== 'cancelled') state.status = 'completed';
          state.completedAt = new Date();

          setTimeout(() => this._active.delete(broadcastId), 30 * 60 * 1000);
        }
      }, 1000);
    });

    return {
      broadcastId,
      totalRecipients: users.length,
      status: 'running',
      estimatedTime: Math.ceil(users.length / 30),
    };
  }

  async getBroadcastHistory(botId) {
    const results = [];
    for (const [id, state] of this._active) {
      results.push({
        broadcastId: id,
        message: state.message?.substring(0, 100),
        totalRecipients: state.totalRecipients,
        delivered: state.delivered,
        failed: state.failed,
        status: state.status,
        createdAt: state.startedAt,
        completedAt: state.completedAt,
      });
    }
    return results;
  }

  async cancelBroadcast(broadcastId) {
    const state = this._active.get(broadcastId);
    if (!state) {
      const err = new Error('Broadcast não encontrado');
      err.statusCode = 404;
      throw err;
    }

    if (state.status === 'completed' || state.status === 'cancelled') {
      const err = new Error(`Broadcast já ${state.status}`);
      err.statusCode = 400;
      throw err;
    }

    const cancelled = state.limiter.cancel();
    state.status = 'cancelled';
    state.completedAt = new Date();

    return {
      success: true,
      broadcastId,
      delivered: state.delivered,
      cancelled,
    };
  }

  async getBroadcastStats(broadcastId) {
    const state = this._active.get(broadcastId);
    if (!state) {
      const err = new Error('Broadcast não encontrado');
      err.statusCode = 404;
      throw err;
    }

    return {
      broadcastId,
      status: state.status,
      totalRecipients: state.totalRecipients,
      delivered: state.delivered,
      failed: state.failed,
      blocked: state.blocked,
      deactivated: 0,
      deliveryRate: state.totalRecipients > 0
        ? Math.round((state.delivered / state.totalRecipients) * 100)
        : 0,
      progress: state.totalRecipients > 0
        ? Math.round(((state.delivered + state.failed) / state.totalRecipients) * 100)
        : 0,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
    };
  }
}

module.exports = new BroadcastService();
