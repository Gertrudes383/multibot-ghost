/**
 * Schema de Order (Compra) - Registro de todas as compras realizadas
 * Armazena dados da compra, cartao adquirido (embedded), e informacoes de fornecedor externo
 * Suporta compras avulsas e em grupo (mix packages)
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Sub-schema para dados do cartao embutido na compra
const EmbeddedCardSchema = new Schema(
  {
    bin: { type: String },
    brand: { type: String },
    type: { type: String },
    level: { type: String },
    country: { type: String },
    bank: { type: String },
    base: { type: String },
    maskedNumber: { type: String }, // ex: 123456******7890
    number: { type: String, select: false },
    expiry_month: { type: String, select: false },
    expiry_year: { type: String, select: false },
    cvv: { type: String, select: false },
    holder_name: { type: String, select: false },
    cpf: { type: String, select: false },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    // --- Comprador ---
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID do usuario e obrigatorio'],
      index: true,
    },
    username: {
      type: String,
      required: [true, 'Username e obrigatorio'],
    },
    telegram_id: {
      type: String,
      default: null,
    },

    // --- Valores ---
    price: {
      type: Schema.Types.Decimal128,
      required: [true, 'Preco e obrigatorio'],
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    original_price: {
      type: Schema.Types.Decimal128,
      default: null,
      get: (v) => (v ? parseFloat(v.toString()) : null),
    },
    discount_amount: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    promotion_name: {
      type: String,
      default: null,
    },

    // --- Status do pedido ---
    status: {
      type: String,
      enum: {
        values: ['pending', 'completed', 'cancelled', 'failed'],
        message: 'Status invalido: {VALUE}',
      },
      default: 'completed',
      index: true,
    },

    // --- Reembolso ---
    refunded: {
      type: Boolean,
      default: false,
    },
    refunded_at: {
      type: Date,
      default: null,
    },

    // --- Referencia ao card original ---
    card_id: {
      type: Schema.Types.ObjectId,
      ref: 'Card',
      default: null,
    },

    // --- Bot e tenant ---
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    bot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      required: [true, 'ID do bot e obrigatorio'],
      index: true,
    },
    bot_name: {
      type: String,
      default: null,
    },

    // --- Tipo e origem da compra ---
    purchase_type: {
      type: String,
      enum: ['card', 'gift_card', 'mix_package', 'other'],
      default: 'card',
    },
    source_detail: {
      type: String,
      enum: {
        values: [
          'telegram_bot',
          'web_store',
          'api',
          'admin_panel',
          'miniapp',
        ],
        message: 'Origem invalida: {VALUE}',
      },
      default: 'telegram_bot',
    },
    stock_origin: {
      type: String,
      enum: ['local', 'fornecedor_externo'],
      default: 'local',
    },

    // --- Dados do cartao comprado (snapshot no momento da compra) ---
    card: {
      type: EmbeddedCardSchema,
      default: null,
    },

    // --- Fornecedor externo (se aplicavel) ---
    external_supplier_order_id: {
      type: String,
      default: null,
    },
    external_order_status: {
      type: String,
      enum: ['pending', 'fulfilled', 'failed', 'cancelled', null],
      default: null,
    },
    supplier_price: {
      type: Schema.Types.Decimal128,
      default: null,
      get: (v) => (v ? parseFloat(v.toString()) : null),
    },

    // --- Compras em grupo (mix packages) ---
    purchase_group_id: {
      type: String,
      default: null,
    },
    mix_offer_name: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'orders',
  }
);

// --- Indices ---
// Indice para data de criacao (consultas de historico)
OrderSchema.index({ createdAt: -1 }, { name: 'idx_created_desc' });

// Indice para grupo de compra (mix packages)
OrderSchema.index(
  { purchase_group_id: 1 },
  {
    sparse: true,
    name: 'idx_purchase_group',
  }
);

// Indice composto para relatorios por bot e periodo
OrderSchema.index(
  { bot_id: 1, createdAt: -1 },
  { name: 'idx_bot_created' }
);

// Indice para reembolsos pendentes
OrderSchema.index(
  { refunded: 1, bot_id: 1 },
  { name: 'idx_refunded_bot' }
);

// --- Virtuals ---
// Indica se houve desconto na compra
OrderSchema.virtual('hasDiscount').get(function () {
  return this.discount_amount > 0;
});

// Margem de lucro (para compras de fornecedor externo)
OrderSchema.virtual('profitMargin').get(function () {
  if (!this.supplier_price) return null;
  const price = parseFloat(this.price?.toString() || '0');
  const cost = parseFloat(this.supplier_price?.toString() || '0');
  if (cost === 0) return null;
  return ((price - cost) / cost * 100).toFixed(2);
});

// --- Metodos estaticos ---
// Relatorio de vendas por periodo
OrderSchema.statics.getSalesReport = function (botId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        bot_id: new mongoose.Types.ObjectId(botId),
        createdAt: { $gte: startDate, $lte: endDate },
        refunded: false,
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: { $toDouble: '$price' } },
        avgOrderValue: { $avg: { $toDouble: '$price' } },
        totalDiscounts: { $sum: { $toDouble: '$discount_amount' } },
      },
    },
  ]);
};

// Busca compras de um usuario em um bot especifico
OrderSchema.statics.findByUserAndBot = function (userId, botId, limit = 50) {
  return this.find({ userId, bot_id: botId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Order', OrderSchema);
