/**
 * Schema de CheckerSetting - Configuracoes do checker de cartoes por bot
 * Define API de validacao, palavras-chave de resultado, precos e limites
 * Cada par owner_id+bot_id tem no maximo uma configuracao
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const CheckerSettingSchema = new Schema(
  {
    // --- Multi-tenancy ---
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID do dono e obrigatorio'],
    },
    bot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      required: [true, 'ID do bot e obrigatorio'],
    },

    // --- Configuracao da API de validacao ---
    api_url: {
      type: String,
      required: [true, 'URL da API e obrigatoria'],
      validate: {
        validator: function (v) {
          return /^https?:\/\/.+/i.test(v);
        },
        message: 'URL da API invalida. Deve comecar com http:// ou https://',
      },
    },
    method: {
      type: String,
      enum: ['GET', 'POST'],
      default: 'GET',
    },

    // --- Palavras-chave para interpretar resposta ---
    success_keyword: {
      type: String,
      required: [true, 'Palavra-chave de sucesso e obrigatoria'],
      trim: true,
      default: 'LIVE',
    },
    fail_keyword: {
      type: String,
      required: [true, 'Palavra-chave de falha e obrigatoria'],
      trim: true,
      default: 'DEAD',
    },
    error_keyword: {
      type: String,
      trim: true,
      default: 'ERROR',
    },

    // --- Precos da validacao ---
    live_price: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    dead_price: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },

    // --- Limites e performance ---
    max_threads_per_user: {
      type: Number,
      default: 3,
      min: [1, 'Minimo 1 thread por usuario'],
      max: [50, 'Maximo 50 threads por usuario'],
    },
    timeout: {
      type: Number,
      default: 30000, // 30 segundos em ms
      min: [5000, 'Timeout minimo: 5 segundos'],
      max: [120000, 'Timeout maximo: 2 minutos'],
    },

    // --- Limites de troca (exchange) ---
    daily_exchange_limit: {
      type: Number,
      default: 5,
      min: [0, 'Limite nao pode ser negativo'],
    },
    exchange_window_minutes: {
      type: Number,
      default: 30, // janela de troca apos compra (em minutos)
      min: [5, 'Janela minima: 5 minutos'],
      max: [1440, 'Janela maxima: 24 horas'],
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'checker_settings',
  }
);

// --- Indices ---
// Indice composto unico: uma configuracao por owner+bot
CheckerSettingSchema.index(
  { owner_id: 1, bot_id: 1 },
  {
    unique: true,
    name: 'idx_owner_bot_unique',
  }
);

// --- Metodos estaticos ---
// Busca ou cria configuracao padrao para um bot
CheckerSettingSchema.statics.getOrCreate = async function (ownerId, botId) {
  let settings = await this.findOne({ owner_id: ownerId, bot_id: botId });
  if (!settings) {
    settings = await this.create({
      owner_id: ownerId,
      bot_id: botId,
      api_url: 'https://checker.example.com/api/check',
    });
  }
  return settings;
};

module.exports = mongoose.model('CheckerSetting', CheckerSettingSchema);
