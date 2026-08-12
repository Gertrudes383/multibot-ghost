'use strict';

/**
 * Schema de Exchange (Troca) — Rastreamento de trocas de cards
 * Quando um card nao funciona, o cliente solicita troca dentro de uma janela de tempo
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ExchangeSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'ID do pedido e obrigatorio'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID do usuario e obrigatorio'],
      index: true,
    },
    bot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      required: true,
    },
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Card original
    original_card: {
      bin: { type: String },
      brand: { type: String },
      level: { type: String },
      country: { type: String },
      maskedNumber: { type: String },
    },

    // Card substituto (se houver)
    replacement_card_id: {
      type: Schema.Types.ObjectId,
      ref: 'Card',
      default: null,
    },

    // Valores
    refund_amount: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },

    // Status
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected', 'refunded', 'replaced'],
        message: 'Status invalido: {VALUE}',
      },
      default: 'pending',
      index: true,
    },

    // Motivo / observacoes
    reason: {
      type: String,
      default: null,
      maxlength: 500,
    },

    // Resultado do check (se executado)
    check_result: {
      type: String,
      enum: ['live', 'die', 'error', null],
      default: null,
    },
    check_message: {
      type: String,
      default: null,
    },

    // Admin que processou
    processed_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    processed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'exchanges',
  }
);

ExchangeSchema.index({ bot_id: 1, status: 1 }, { name: 'idx_bot_status' });
ExchangeSchema.index({ userId: 1, createdAt: -1 }, { name: 'idx_user_created' });

ExchangeSchema.virtual('isProcessed').get(function () {
  return ['approved', 'rejected', 'refunded', 'replaced'].includes(this.status);
});

module.exports = mongoose.model('Exchange', ExchangeSchema);
