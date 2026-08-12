/**
 * Schema de Bot - Modelo do bot Telegram gerenciado pelo tenant
 * Cada tenant pode ter multiplos bots, cada bot representa uma loja independente
 * Suporta configuracoes de loja, estoque, referencia, canal obrigatorio, etc.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// --- Contadores auto-incremento ---
const CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

const BotSchema = new Schema(
  {
    // --- Identificacao ---
    id: {
      type: Number,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Nome do bot e obrigatorio'],
      trim: true,
      maxlength: [100, 'Nome do bot muito longo'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Descricao muito longa'],
    },
    username: {
      type: String,
      required: [true, 'Username do bot Telegram e obrigatorio'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_]{5,32}$/i, 'Username do bot Telegram invalido'],
    },

    // --- Multi-tenancy ---
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Dono do bot e obrigatorio'],
      index: true,
    },
    tenant_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Tenant e obrigatorio'],
      index: true,
    },

    // --- Status e controle ---
    active: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'maintenance'],
        message: 'Status invalido: {VALUE}',
      },
      default: 'active',
    },
    last_heartbeat: {
      type: Date,
      default: null,
    },
    maintenance_mode: {
      type: Boolean,
      default: false,
    },

    // --- Tokens do bot (criptografados no nivel da aplicacao) ---
    bot_token: {
      type: String,
      required: [true, 'Token do bot e obrigatorio'],
      select: false, // nao retorna por padrao
    },
    backup_bot_token: {
      type: String,
      default: null,
      select: false,
    },

    // --- Mensagens personalizaveis ---
    welcome_message: {
      type: String,
      default: 'Bem-vindo a nossa loja! Use /menu para ver as opcoes.',
      maxlength: [2000, 'Mensagem de boas-vindas muito longa'],
    },
    help_message: {
      type: String,
      default: 'Use /menu para navegar. /saldo para ver seu saldo. /suporte para ajuda.',
      maxlength: [2000, 'Mensagem de ajuda muito longa'],
    },
    terms_message: {
      type: String,
      default: '',
      maxlength: [5000, 'Termos muito longos'],
    },

    // --- Configuracoes da loja ---
    store_name: {
      type: String,
      default: 'Minha Loja',
      maxlength: [100, 'Nome da loja muito longo'],
    },
    store_logo_url: {
      type: String,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^https?:\/\/.+/i.test(v);
        },
        message: 'URL do logo invalida',
      },
    },
    store_color: {
      type: String,
      default: '#2563eb',
      match: [/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Cor hexadecimal invalida'],
    },
    start_image_url: {
      type: String,
      default: null,
    },
    store_web_url: {
      type: String,
      default: null,
    },

    // --- Limites de compra ---
    min_purchase_amount: {
      type: Number,
      default: 1,
      min: [0, 'Valor minimo nao pode ser negativo'],
    },
    max_purchase_amount: {
      type: Number,
      default: 1000,
      min: [1, 'Valor maximo deve ser pelo menos 1'],
    },

    // --- Controles de funcionalidades ---
    disable_purchases: {
      type: Boolean,
      default: false,
    },
    disable_pix: {
      type: Boolean,
      default: false,
    },
    mix_packages_enabled: {
      type: Boolean,
      default: false,
    },

    // --- Origem do estoque ---
    stock_origin: {
      type: String,
      enum: {
        values: ['local', 'fornecedor_externo'],
        message: 'Origem de estoque invalida: {VALUE}',
      },
      default: 'local',
    },

    // --- Suporte e canais ---
    support_username: {
      type: String,
      default: null,
      trim: true,
    },
    required_channel: {
      type: String,
      default: null,
      trim: true,
    },
    require_subscription: {
      type: Boolean,
      default: false,
    },
    exchange_channel: {
      type: String,
      default: null,
    },
    client_group_channel: {
      type: String,
      default: null,
    },

    // --- Sistema de indicacao ---
    referral_enabled: {
      type: Boolean,
      default: false,
    },
    referral_bonus_percentage: {
      type: Number,
      default: 5,
      min: [0, 'Porcentagem nao pode ser negativa'],
      max: [100, 'Porcentagem nao pode exceder 100'],
    },

    // --- Funcionalidades extras ---
    backup_enabled: {
      type: Boolean,
      default: false,
    },
    exchanges_enabled: {
      type: Boolean,
      default: true,
    },
    references_enabled: {
      type: Boolean,
      default: true,
    },

    // --- Estatisticas (atualizadas via aggregation ou hooks) ---
    total_users: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_purchases: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_revenue: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    total_recharges: {
      type: Number,
      default: 0,
      min: 0,
    },

    // --- Metadados flexiveis (menu, emojis, tema do miniapp) ---
    metadata: {
      type: Schema.Types.Mixed,
      default: {
        menu_flow: 'default',
        custom_emojis: {},
        miniapp_theme: {
          primary_color: '#2563eb',
          background: '#0f172a',
          card_style: 'rounded',
        },
      },
    },

    // --- Status de execucao ---
    runtime_status: {
      type: String,
      default: 'stopped',
      enum: ['running', 'stopped', 'error', 'restarting'],
    },
    uptime: {
      type: Number,
      default: 0, // em segundos
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'bots',
  }
);

// --- Indices ---
// Indice composto para busca de bots por tenant
BotSchema.index({ tenant_id: 1, status: 1 }, { name: 'idx_tenant_status' });

// --- Auto-incremento do campo id ---
BotSchema.pre('save', async function (next) {
  if (this.isNew && !this.id) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        'bot_id',
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
      );
      this.id = counter.seq;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

// --- Virtuals ---
// Indica se o bot esta online (heartbeat nos ultimos 2 minutos)
BotSchema.virtual('isOnline').get(function () {
  if (!this.last_heartbeat) return false;
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  return this.last_heartbeat > twoMinutesAgo;
});

// URL completa do bot no Telegram
BotSchema.virtual('telegramUrl').get(function () {
  return `https://t.me/${this.username}`;
});

// --- Metodos estaticos ---
// Busca todos os bots de um dono especifico
BotSchema.statics.findByOwner = function (ownerId) {
  return this.find({ owner_id: ownerId });
};

// Busca bot ativo por username do telegram
BotSchema.statics.findActiveByUsername = function (username) {
  return this.findOne({ username, active: true, status: 'active' });
};

module.exports = mongoose.model('Bot', BotSchema);
