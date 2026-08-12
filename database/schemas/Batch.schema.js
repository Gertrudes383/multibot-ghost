/**
 * Schema de Batch (Lote) - Agrupa cartoes importados em lotes
 * Permite rastreabilidade da origem do estoque e controle de qualidade
 * Estatisticas de vendas e mortes sao mantidas via contadores
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const BatchSchema = new Schema(
  {
    // --- Identificacao do lote ---
    name: {
      type: String,
      required: [true, 'Nome do lote e obrigatorio'],
      trim: true,
      maxlength: [100, 'Nome do lote muito longo'],
    },

    // --- Multi-tenancy ---
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Dono do lote e obrigatorio'],
      index: true,
    },
    bot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      default: null,
      index: true,
    },

    // --- Fornecedor ---
    supplier: {
      type: String,
      default: null,
      trim: true,
      maxlength: [100, 'Nome do fornecedor muito longo'],
    },
    stock_origin: {
      type: String,
      enum: ['local', 'fornecedor_externo'],
      default: 'local',
    },

    // --- Destaque ---
    featured: {
      type: Boolean,
      default: false,
    },

    // --- Contadores de cartoes ---
    totalCards: {
      type: Number,
      default: 0,
      min: 0,
    },
    soldCards: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableCards: {
      type: Number,
      default: 0,
      min: 0,
    },
    deadCards: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'batches',
  }
);

// --- Indices ---
// Indice composto para listagem por dono e data
BatchSchema.index(
  { owner_id: 1, createdAt: -1 },
  { name: 'idx_owner_created' }
);

// --- Virtuals ---
// Percentual de cartoes vendidos
BatchSchema.virtual('soldPercentage').get(function () {
  if (this.totalCards === 0) return 0;
  return ((this.soldCards / this.totalCards) * 100).toFixed(1);
});

// Percentual de cartoes mortos (indicador de qualidade)
BatchSchema.virtual('deadPercentage').get(function () {
  if (this.totalCards === 0) return 0;
  return ((this.deadCards / this.totalCards) * 100).toFixed(1);
});

// Indica se o lote ainda tem estoque disponivel
BatchSchema.virtual('hasStock').get(function () {
  return this.availableCards > 0;
});

// --- Metodos estaticos ---
// Atualiza contadores do lote com base nos cartoes reais
BatchSchema.statics.recalculateCounters = async function (batchId) {
  const Card = mongoose.model('Card');

  const [stats] = await Card.aggregate([
    { $match: { batch_id: new mongoose.Types.ObjectId(batchId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const counters = { available: 0, sold: 0, dead: 0, locked: 0 };
  if (stats) {
    // O aggregate retorna array de grupos, nao um unico resultado
    const results = await Card.aggregate([
      { $match: { batch_id: new mongoose.Types.ObjectId(batchId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    results.forEach((r) => {
      counters[r._id] = r.count;
    });
  }

  const total =
    counters.available + counters.sold + counters.dead + counters.locked;

  return this.findByIdAndUpdate(
    batchId,
    {
      totalCards: total,
      availableCards: counters.available,
      soldCards: counters.sold,
      deadCards: counters.dead,
    },
    { new: true }
  );
};

module.exports = mongoose.model('Batch', BatchSchema);
