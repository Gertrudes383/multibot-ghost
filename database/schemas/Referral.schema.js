'use strict';

/**
 * Schema de Referral (Indicacao) — Relacionamentos e ganhos do sistema de referral
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ReferralSchema = new Schema(
  {
    // Quem indicou
    referrer_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID do indicador e obrigatorio'],
      index: true,
    },
    // Quem foi indicado
    referred_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID do indicado e obrigatorio'],
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

    // Bonus de registro (one-time)
    registration_bonus: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    registration_bonus_paid: {
      type: Boolean,
      default: false,
    },

    // Ganhos acumulados (comissao sobre recargas do indicado)
    total_earnings: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'referrals',
  }
);

ReferralSchema.index(
  { referrer_id: 1, referred_id: 1 },
  { unique: true, name: 'idx_referral_pair' }
);
ReferralSchema.index({ bot_id: 1, status: 1 }, { name: 'idx_bot_status' });

module.exports = mongoose.model('Referral', ReferralSchema);
