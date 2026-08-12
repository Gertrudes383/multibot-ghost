/**
 * Schema de Promotion (Promocao) - Descontos aplicaveis a compras
 * Suporta descontos por porcentagem ou valor fixo
 * Pode ser direcionada a BINs ou niveis especificos de cartao
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const PromotionSchema = new Schema(
  {
    // --- Identificacao ---
    name: {
      type: String,
      required: [true, 'Nome da promocao e obrigatorio'],
      trim: true,
      maxlength: [100, 'Nome muito longo'],
    },

    // --- Tipo e valor do desconto ---
    type: {
      type: String,
      enum: {
        values: ['percentage', 'fixed'],
        message: 'Tipo invalido: {VALUE}. Use percentage ou fixed',
      },
      required: [true, 'Tipo da promocao e obrigatorio'],
    },
    value: {
      type: Number,
      required: [true, 'Valor do desconto e obrigatorio'],
      min: [0, 'Valor nao pode ser negativo'],
      validate: {
        validator: function (v) {
          // Se porcentagem, nao pode exceder 100%
          if (this.type === 'percentage' && v > 100) return false;
          return true;
        },
        message: 'Porcentagem nao pode exceder 100%',
      },
    },

    // --- Segmentacao: BINs e niveis alvo ---
    target_bins: {
      type: [String],
      default: [], // vazio = aplica a todos os BINs
      validate: {
        validator: function (arr) {
          return arr.every((bin) => /^\d{6}$/.test(bin));
        },
        message: 'Todos os BINs devem ter 6 digitos numericos',
      },
    },
    target_levels: {
      type: [String],
      default: [], // vazio = aplica a todos os niveis
      enum: [
        'STANDARD',
        'GOLD',
        'PLATINUM',
        'BLACK',
        'INFINITE',
        'PREPAID',
        'BUSINESS',
      ],
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
    },

    // --- Ativacao e periodo ---
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    start_date: {
      type: Date,
      default: Date.now,
    },
    end_date: {
      type: Date,
      default: null, // null = sem data de termino
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'promotions',
  }
);

// --- Indices ---
// Indice composto para busca de promocoes ativas por bot
PromotionSchema.index(
  { bot_id: 1, active: 1 },
  { name: 'idx_bot_active' }
);

// --- Virtuals ---
// Indica se a promocao esta dentro do periodo de validade
PromotionSchema.virtual('isValid').get(function () {
  if (!this.active) return false;
  const now = new Date();
  if (this.start_date && now < this.start_date) return false;
  if (this.end_date && now > this.end_date) return false;
  return true;
});

// Descricao formatada do desconto
PromotionSchema.virtual('discountLabel').get(function () {
  if (this.type === 'percentage') {
    return `${this.value}% de desconto`;
  }
  return `R$ ${this.value.toFixed(2)} de desconto`;
});

// --- Metodos estaticos ---
// Busca promocao aplicavel a um cartao especifico
PromotionSchema.statics.findApplicable = function (botId, bin, level) {
  const now = new Date();
  return this.findOne({
    bot_id: botId,
    active: true,
    $or: [{ start_date: null }, { start_date: { $lte: now } }],
    $or: [{ end_date: null }, { end_date: { $gte: now } }],
    $or: [
      { target_bins: { $size: 0 } }, // aplica a todos
      { target_bins: bin },
    ],
    $or: [
      { target_levels: { $size: 0 } }, // aplica a todos
      { target_levels: level },
    ],
  }).sort({ value: -1 }); // retorna a melhor promocao
};

// Calcula desconto para um preco dado
PromotionSchema.methods.calculateDiscount = function (originalPrice) {
  const price = parseFloat(originalPrice);
  if (this.type === 'percentage') {
    return (price * this.value) / 100;
  }
  // Valor fixo — nunca desconta mais que o preco
  return Math.min(this.value, price);
};

module.exports = mongoose.model('Promotion', PromotionSchema);
