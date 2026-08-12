'use strict';

/**
 * Schema de SubscriptionPlan — Catalogo de planos de assinatura
 * Basico (R$300/mes, 1 bot) e Premium (R$400/mes, 2 bots)
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const SubscriptionPlanSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Nome do plano e obrigatorio'],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    price: {
      type: Schema.Types.Decimal128,
      required: [true, 'Preco e obrigatorio'],
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },

    // Limites
    maxBots: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    duration_days: {
      type: Number,
      required: true,
      default: 30,
    },

    // Features incluidas
    features: [{
      type: String,
    }],

    // Status
    active: {
      type: Boolean,
      default: true,
    },

    // Ordem de exibicao
    display_order: {
      type: Number,
      default: 0,
    },

    // Descricao
    description: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'subscription_plans',
  }
);

module.exports = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
