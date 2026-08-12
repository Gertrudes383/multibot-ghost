/**
 * Schema de ValidationLog - Log de validacoes do checker de cartoes
 * Registra cada tentativa de validacao para monitoramento e auditoria
 * Inclui tempo de resposta, gateway utilizado e origem do estoque
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ValidationLogSchema = new Schema(
  {
    // --- Usuario que solicitou a validacao ---
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID do usuario e obrigatorio'],
      index: true,
    },

    // --- Bot onde a validacao ocorreu ---
    botId: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      required: [true, 'ID do bot e obrigatorio'],
      index: true,
    },

    // --- Dados do cartao (parcialmente mascarados) ---
    cardMasked: {
      type: String,
      required: true,
      // Formato: 123456******7890
    },
    cardNumber: {
      type: String,
      default: null,
      // Armazena apenas primeiros 6 + ultimos 4 para referencia
    },
    bin: {
      type: String,
      default: null,
      maxlength: 6,
    },

    // --- Resultado da validacao ---
    validationStatus: {
      type: String,
      enum: {
        values: ['LIVE', 'DEAD', 'ERROR'],
        message: 'Status de validacao invalido: {VALUE}',
      },
      required: [true, 'Status da validacao e obrigatorio'],
    },

    // --- Detalhes tecnicos ---
    source: {
      type: String,
      default: null,
      // Ex: "telegram_bot", "web_api", "admin_panel"
    },
    gatewayUsed: {
      type: String,
      default: null,
      // Nome do gateway/API usado para validar
    },
    errorMessage: {
      type: String,
      default: null,
      maxlength: [500, 'Mensagem de erro muito longa'],
    },
    responseTimeMs: {
      type: Number,
      default: null,
      min: [0, 'Tempo de resposta nao pode ser negativo'],
    },

    // --- Origem do estoque ---
    stockOrigin: {
      type: String,
      enum: ['local', 'fornecedor_externo', null],
      default: null,
    },

    // --- Data/hora da tentativa ---
    attemptedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'validation_logs',
  }
);

// --- Indices ---
// Indice por data da tentativa (consultas de historico)
ValidationLogSchema.index(
  { attemptedAt: -1 },
  { name: 'idx_attempted_desc' }
);

// Indice composto para relatorios por bot e status
ValidationLogSchema.index(
  { botId: 1, validationStatus: 1, attemptedAt: -1 },
  { name: 'idx_bot_status_date' }
);

// TTL: remove logs com mais de 90 dias automaticamente
ValidationLogSchema.index(
  { attemptedAt: 1 },
  {
    expireAfterSeconds: 90 * 24 * 60 * 60, // 90 dias
    name: 'idx_ttl_90days',
  }
);

// --- Metodos estaticos ---
// Estatisticas de validacao por bot
ValidationLogSchema.statics.getStats = function (botId, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        botId: new mongoose.Types.ObjectId(botId),
        attemptedAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$validationStatus',
        count: { $sum: 1 },
        avgResponseTime: { $avg: '$responseTimeMs' },
      },
    },
  ]);
};

// Busca logs de um usuario especifico
ValidationLogSchema.statics.findByUser = function (userId, limit = 50) {
  return this.find({ userId })
    .sort({ attemptedAt: -1 })
    .limit(limit)
    .select('-cardNumber'); // nao expoe numero parcial por padrao
};

module.exports = mongoose.model('ValidationLog', ValidationLogSchema);
