'use strict';

const { Bot } = require('../../database/schemas');
const BotInstance = require('./BotInstance');
const HealthMonitor = require('./HealthMonitor');

class BotManager {
  constructor() {
    this._instances = new Map();
    this.healthMonitor = new HealthMonitor(this);
  }

  async startAll() {
    const bots = await Bot.find({ status: 'active' }).select('+bot_token').lean();
    console.log(`[BotManager] Encontrados ${bots.length} bots ativos`);

    let started = 0;
    let failed = 0;

    for (const botDoc of bots) {
      try {
        await this.startBot(String(botDoc._id), botDoc);
        started++;
      } catch (err) {
        failed++;
        console.error(`[BotManager] Falha ao iniciar bot ${botDoc.name || botDoc.store_name}: ${err.message}`);
      }
    }

    console.log(`[BotManager] ${started} bots iniciados, ${failed} falhas`);
    this.healthMonitor.start();
  }

  async startBot(botId, botDoc = null) {
    if (this._instances.has(botId)) {
      const existing = this._instances.get(botId);
      if (existing.status === 'running') {
        console.log(`[BotManager] Bot ${botId} já está rodando`);
        return existing;
      }
    }

    if (!botDoc) {
      botDoc = await Bot.findById(botId).select('+bot_token').lean();
    }

    if (!botDoc) {
      const err = new Error(`Bot ${botId} não encontrado no banco`);
      err.statusCode = 404;
      throw err;
    }

    const instance = new BotInstance(botDoc);
    this._instances.set(botId, instance);

    await instance.start();
    return instance;
  }

  async stopBot(botId) {
    const instance = this._instances.get(botId);
    if (!instance) {
      const err = new Error(`Bot ${botId} não está carregado`);
      err.statusCode = 404;
      throw err;
    }

    await instance.stop();
    this._instances.delete(botId);
  }

  async restartBot(botId) {
    const instance = this._instances.get(botId);
    if (instance) {
      await instance.restart();
    } else {
      await this.startBot(botId);
    }
    this.healthMonitor.resetRestartCount(botId);
  }

  getBotStatus(botId) {
    const instance = this._instances.get(botId);
    if (!instance) {
      return { status: 'not_loaded', uptime: 0, lastHeartbeat: null };
    }

    return {
      status: instance.status,
      uptime: instance.uptime,
      botName: instance.botDoc.name || instance.botDoc.store_name,
      lastHeartbeat: instance.botDoc.last_heartbeat,
    };
  }

  getInstance(botId) {
    return this._instances.get(botId) || null;
  }

  getAllInstances() {
    return this._instances;
  }

  getRunningCount() {
    let count = 0;
    for (const instance of this._instances.values()) {
      if (instance.status === 'running') count++;
    }
    return count;
  }

  async shutdown() {
    console.log('[BotManager] Desligando todos os bots...');
    this.healthMonitor.stop();

    const promises = [];
    for (const [botId, instance] of this._instances) {
      promises.push(
        instance.stop().catch((err) => {
          console.error(`[BotManager] Erro ao parar bot ${botId}: ${err.message}`);
        })
      );
    }

    await Promise.all(promises);
    this._instances.clear();
    console.log('[BotManager] Todos os bots desligados');
  }
}

module.exports = BotManager;
