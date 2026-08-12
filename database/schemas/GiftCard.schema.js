/**
 * Schema de GiftCard (Vale-Presente) - Codigos de recarga pre-pagos
 * Gerados por admins/tenants e resgatados por usuarios finais
 * Codigos sao unicos e possuem controle de status e expiracao
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const GiftCardSchema = new Schema(
  {
    // --- Codigo do vale-presente (unico) ---
    code: {
      type: String,
      required: [true, 'Codigo e obrigatorio'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [6, 'Codigo deve ter no minimo 6 caracteres'],
      maxlength: [32, 'Codigo deve ter no maximo 32 caracteres'],
      match: [/^[A-Z0-9-]+$/, 'Codigo deve conter apenas letras maiusculas, numeros e hifens'],
    },

    // --- Valor ---
    value: {
      type: Schema.Types.Decimal128,
      required: [true, 'Valor e obrigatorio'],
      get: (v) => (v ? parseFloat(v.toString()) : 0),
      validate: {
        validator: (v) => parseFloat(v.toString()) > 0,
        message: 'Valor deve ser positivo',
      },
    },

    // --- Multi-tenancy ---
    bot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      required: [true, 'ID do bot e obrigatorio'],
      index: true,
    },
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID do dono e obrigatorio'],
      index: true,
    },

    // --- Criacao e resgate ---
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Criador e obrigatorio'],
    },
    redeemed_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    redeemed_at: {
      type: Date,
      default: null,
    },

    // --- Status ---
    status: {
      type: String,
      enum: {
        values: ['active', 'redeemed', 'expired'],
        message: 'Status invalido: {VALUE}',
      },
      default: 'active',
      index: true,
    },

    // --- Expiracao (opcional) ---
    expires_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'gift_cards',
  }
);

// --- Indices ---
// Indice composto para busca de gift cards ativos por bot
GiftCardSchema.index(
  { bot_id: 1, status: 1 },
  { name: 'idx_bot_status' }
);

// --- Virtuals ---
// Indica se o gift card pode ser resgatado
GiftCardSchema.virtual('isRedeemable').get(function () {
  if (this.status !== 'active') return false;
  if (this.expires_at && new Date() > this.expires_at) return false;
  return true;
});

// --- Metodos estaticos ---
// Resgata um gift card por codigo
GiftCardSchema.statics.redeemByCode = async function (code, userId) {
  const giftCard = await this.findOneAndUpdate(
    {
      code: code.toUpperCase(),
      status: 'active',
      $or: [
        { expires_at: null },
        { expires_at: { $gt: new Date() } },
      ],
    },
    {
      $set: {
        status: 'redeemed',
        redeemed_by: userId,
        redeemed_at: new Date(),
      },
    },
    { new: true }
  );
  return giftCard;
};

// Gera codigo aleatorio no formato XXXX-XXXX-XXXX
GiftCardSchema.statics.generateCode = function () {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1 para evitar confusao
  const segments = [];
  for (let s = 0; s < 3; s++) {
    let segment = '';
    for (let i = 0; i < 4; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join('-');
};

module.exports = mongoose.model('GiftCard', GiftCardSchema);
