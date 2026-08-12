'use strict';

const { Bot } = require('../../database/schemas');

const HEARTBEAT_INTERVAL = 2 * 60 * 1000;
const DEAD_THRESHOLD = 5 * 60 * 1000;
const MAX_RESTART_ATTEMPTS = 3;

class HealthMonitor {
  constructor(botManager) {
    this.botManager = botManager;
    this._timer = null;
    this._restartCounts = new Map();
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._check(), HEARTBEAT_INTERVAL);
    console.log('[HealthMonitor] Iniciado — verificação a cada 2 min');
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    console.log('[HealthMonitor] Parado');
  }

  async _check() {
    const instances = this.botManager.getAllInstances();
    const now = Date.now();

    for (const [botId, instance] of instances) {
      try {
        await this._heartbeat(botId, instance, now);
      } catch (err) {
        console.error(`[HealthMonitor] Erro ao verificar bot ${botId}: ${err.message}`);
      }
    }
  }

  async _heartbeat(botId, instance, now) {
    if (instance.status === 'stopped') return;

    await Bot.findByIdAndUpdate(botId, {
      $set: { last_heartbeat: new Date(now) },
    });

    if (instance.status === 'running') {
      this._restartCounts.delete(botId);
      return;
    }

    if (instance.status === 'error') {
      const attempts = this._restartCounts.get(botId) || 0;
      if (attempts >= MAX_RESTART_ATTEMPTS) {
        if (attempts === MAX_RESTART_ATTEMPTS) {
          console.error(`[HealthMonitor] Bot ${botId} atingiu máximo de ${MAX_RESTART_ATTEMPTS} tentativas de restart`);
          await Bot.findByIdAndUpdate(botId, { runtime_status: 'error' });
          this._restartCounts.set(botId, attempts + 1);
        }
        return;
      }

      console.log(`[HealthMonitor] Tentando reiniciar bot ${botId} (tentativa ${attempts + 1}/${MAX_RESTART_ATTEMPTS})`);
      this._restartCounts.set(botId, attempts + 1);

      try {
        await this.botManager.restartBot(botId);
        console.log(`[HealthMonitor] Bot ${botId} reiniciado com sucesso`);
        this._restartCounts.delete(botId);
      } catch (err) {
        console.error(`[HealthMonitor] Falha ao reiniciar bot ${botId}: ${err.message}`);
      }
    }
  }

  async checkAll() {
    const bots = await Bot.find({ status: 'active' }).select('_id last_heartbeat runtime_status').lean();
    const now = Date.now();

    const results = [];
    for (const bot of bots) {
      const lastHb = bot.last_heartbeat ? new Date(bot.last_heartbeat).getTime() : 0;
      const isDead = (now - lastHb) > DEAD_THRESHOLD;
      const instance = this.botManager.getInstance(String(bot._id));

      results.push({
        botId: String(bot._id),
        runtimeStatus: bot.runtime_status,
        instanceStatus: instance?.status || 'not_loaded',
        lastHeartbeat: bot.last_heartbeat,
        isDead,
        timeSinceHeartbeat: now - lastHb,
      });
    }

    return results;
  }

  resetRestartCount(botId) {
    this._restartCounts.delete(botId);
  }
}

module.exports = HealthMonitor;
