'use strict';

const TELEGRAM_RATE_LIMIT = 30;
const INTERVAL_MS = 1000;

class BroadcastRateLimiter {
  constructor(ratePerSecond = TELEGRAM_RATE_LIMIT) {
    this._rate = ratePerSecond;
    this._queue = [];
    this._processing = false;
    this._cancelled = false;
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      if (!this._processing) this._processQueue();
    });
  }

  cancel() {
    this._cancelled = true;
    const remaining = this._queue.length;
    this._queue = [];
    return remaining;
  }

  get pending() {
    return this._queue.length;
  }

  async _processQueue() {
    this._processing = true;

    while (this._queue.length > 0 && !this._cancelled) {
      const batch = this._queue.splice(0, this._rate);
      const start = Date.now();

      const results = await Promise.allSettled(batch.map(({ fn }) => fn()));

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled') {
          batch[i].resolve(result.value);
        } else {
          batch[i].reject(result.reason);
        }
      }

      const elapsed = Date.now() - start;
      if (elapsed < INTERVAL_MS && this._queue.length > 0) {
        await new Promise((r) => setTimeout(r, INTERVAL_MS - elapsed));
      }
    }

    this._processing = false;
    this._cancelled = false;
  }
}

module.exports = { BroadcastRateLimiter };
