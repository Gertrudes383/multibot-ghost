'use strict';

/**
 * Schema de CheckerSession — Sessoes de verificacao em massa de cards
 * Armazena resultados de cada sessao de check para o checker-monitor
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const CheckerSessionSchema = new Schema(
  {
    bot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
      index: true,
    },
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Contagens
    total_checked: {
      type: Number,
      default: 0,
    },
    live_count: {
      type: Number,
      default: 0,
    },
    dead_count: {
      type: Number,
      default: 0,
    },
    error_count: {
      type: Number,
      default: 0,
    },

    // Gateway usado
    gateway: {
      type: String,
      default: 'default',
    },

    // Status da sessao
    status: {
      type: String,
      enum: ['running', 'completed', 'cancelled', 'failed'],
      default: 'running',
    },

    // Tempo
    started_at: {
      type: Date,
      default: Date.now,
    },
    completed_at: {
      type: Date,
      default: null,
    },

    // Duracao em ms
    duration_ms: {
      type: Number,
      default: 0,
    },

    // Cards verificados (IDs)
    card_ids: [{
      type: Schema.Types.ObjectId,
      ref: 'Card',
    }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: 'checker_sessions',
  }
);

CheckerSessionSchema.index({ bot_id: 1, createdAt: -1 }, { name: 'idx_bot_created' });

CheckerSessionSchema.virtual('liveRate').get(function () {
  if (this.total_checked === 0) return 0;
  return Math.round((this.live_count / this.total_checked) * 100);
});

module.exports = mongoose.model('CheckerSession', CheckerSessionSchema);
