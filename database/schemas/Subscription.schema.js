/**
 * Schema de Subscription (Assinatura) - Planos de assinatura dos tenants
 * Controla qual plano o tenant possui, limites de bots, e validade
 * Planos: basic (R$300, 3 bots), premium (R$400, bots ilimitados)
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const SubscriptionSchema = new Schema(
  {
    // --- Tenant assinante ---
    tenant_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID do tenant e obrigatorio'],
      index: true,
    },

    // --- Plano ---
    plan: {
      type: String,
      enum: {
        values: ['basic', 'premium'],
        message: 'Plano invalido: {VALUE}. Use basic ou premium',
      },
      required: [true, 'Plano e obrigatorio'],
    },

    // --- Preco ---
    price: {
      type: Schema.Types.Decimal128,
      required: [true, 'Preco e obrigatorio'],
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },

    // --- Limites do plano ---
    maxBots: {
      type: Number,
      required: [true, 'Numero maximo de bots e obrigatorio'],
      min: [1, 'Deve permitir pelo menos 1 bot'],
    },

    // --- Status da assinatura ---
    status: {
      type: String,
      enum: {
        values: ['active', 'expired', 'cancelled'],
        message: 'Status invalido: {VALUE}',
      },
      default: 'active',
      index: true,
    },

    // --- Periodo de validade ---
    started_at: {
      type: Date,
      default: Date.now,
    },
    expires_at: {
      type: Date,
      required: [true, 'Data de expiracao e obrigatoria'],
    },

    // --- Metodo de pagamento ---
    payment_method: {
      type: String,
      enum: ['pix', 'crypto', 'manual', 'free'],
      default: 'manual',
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'subscriptions',
  }
);

// --- Indices ---
// Indice composto para busca de assinatura ativa por tenant
SubscriptionSchema.index(
  { tenant_id: 1, status: 1 },
  { name: 'idx_tenant_status' }
);

// Indice para verificacao de expiracoes
SubscriptionSchema.index(
  { expires_at: 1, status: 1 },
  { name: 'idx_expires_status' }
);

// --- Virtuals ---
// Indica se a assinatura esta ativa e dentro da validade
SubscriptionSchema.virtual('isActive').get(function () {
  return this.status === 'active' && new Date() < this.expires_at;
});

// Dias restantes ate a expiracao
SubscriptionSchema.virtual('daysRemaining').get(function () {
  if (this.status !== 'active') return 0;
  const diff = this.expires_at.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Nome formatado do plano
SubscriptionSchema.virtual('planLabel').get(function () {
  const labels = {
    basic: 'Basico',
    premium: 'Premium',
  };
  return labels[this.plan] || this.plan;
});

// --- Metodos estaticos ---
// Busca assinatura ativa de um tenant
SubscriptionSchema.statics.getActive = function (tenantId) {
  return this.findOne({
    tenant_id: tenantId,
    status: 'active',
    expires_at: { $gt: new Date() },
  });
};

// Marca assinaturas expiradas
SubscriptionSchema.statics.expireOverdue = function () {
  return this.updateMany(
    {
      status: 'active',
      expires_at: { $lte: new Date() },
    },
    {
      $set: { status: 'expired' },
    }
  );
};

// Verifica se tenant pode criar mais bots
SubscriptionSchema.statics.canCreateBot = async function (tenantId) {
  const subscription = await this.getActive(tenantId);
  if (!subscription) return { allowed: false, reason: 'Sem assinatura ativa' };

  const Bot = mongoose.model('Bot');
  const botCount = await Bot.countDocuments({ tenant_id: tenantId });

  if (botCount >= subscription.maxBots) {
    return {
      allowed: false,
      reason: `Limite de ${subscription.maxBots} bots atingido no plano ${subscription.planLabel}`,
    };
  }

  return { allowed: true, remaining: subscription.maxBots - botCount };
};

module.exports = mongoose.model('Subscription', SubscriptionSchema);
