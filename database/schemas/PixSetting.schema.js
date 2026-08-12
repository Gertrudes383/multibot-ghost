/**
 * Schema de PixSetting - Configuracoes do gateway PIX por bot
 * Suporta multiplos provedores de pagamento (mercadopago, paggue, etc)
 * Inclui taxas, limites e cooldown entre recargas
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const PixSettingSchema = new Schema(
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

    // --- Ativacao ---
    enabled: {
      type: Boolean,
      default: false,
    },

    // --- Provedor de pagamento ---
    provider: {
      type: String,
      enum: {
        values: [
          'primepix',
          'easy-pix',
          'mercadopago',
          'paggue',
          'asaas',
          'pix_api',
          'picpay',
          'pagarme',
          'stripe',
          'custom',
        ],
        message: 'Provedor invalido: {VALUE}',
      },
      default: 'primepix',
    },

    endpoint: {
      type: String,
      default: null,
    },

    // --- Credenciais (criptografadas na camada de aplicacao) ---
    api_key: {
      type: String,
      default: null,
      select: false, // nao retorna por padrao
    },
    webhook_secret: {
      type: String,
      default: null,
      select: false,
    },

    // --- Taxas ---
    fee_type: {
      type: String,
      enum: {
        values: ['percentage', 'fixed', 'none'],
        message: 'Tipo de taxa invalido: {VALUE}',
      },
      default: 'none',
    },
    fee_value: {
      type: Number,
      default: 0,
      min: [0, 'Taxa nao pode ser negativa'],
    },

    // --- Limites de valor ---
    min_amount: {
      type: Number,
      default: 5,
      min: [1, 'Valor minimo deve ser pelo menos R$ 1'],
    },
    max_amount: {
      type: Number,
      default: 5000,
      max: [50000, 'Valor maximo nao pode exceder R$ 50.000'],
    },

    // --- Limites de frequencia ---
    daily_limit: {
      type: Number,
      default: 10,
      min: [1, 'Limite diario deve ser pelo menos 1'],
    },
    hourly_limit: {
      type: Number,
      default: 5,
      min: [1, 'Limite por hora deve ser pelo menos 1'],
    },
    cooldown_minutes: {
      type: Number,
      default: 5, // minutos entre recargas
      min: [0, 'Cooldown nao pode ser negativo'],
    },

    // --- Expiracao do QR code ---
    expiration_minutes: {
      type: Number,
      default: 30, // minutos ate o QR code expirar
      min: [5, 'Expiracao minima: 5 minutos'],
      max: [1440, 'Expiracao maxima: 24 horas'],
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'pix_settings',
  }
);

// --- Indices ---
// Indice composto para busca por owner+bot
PixSettingSchema.index(
  { owner_id: 1, bot_id: 1 },
  {
    unique: true,
    name: 'idx_owner_bot_unique',
  }
);

// --- Metodos de instancia ---
// Calcula taxa sobre um valor de recarga
PixSettingSchema.methods.calculateFee = function (amount) {
  if (this.fee_type === 'none') return 0;
  if (this.fee_type === 'fixed') return this.fee_value;
  if (this.fee_type === 'percentage') {
    return (amount * this.fee_value) / 100;
  }
  return 0;
};

// Valida se o valor esta dentro dos limites
PixSettingSchema.methods.isAmountValid = function (amount) {
  if (amount < this.min_amount) {
    return { valid: false, reason: `Valor minimo: R$ ${this.min_amount}` };
  }
  if (amount > this.max_amount) {
    return { valid: false, reason: `Valor maximo: R$ ${this.max_amount}` };
  }
  return { valid: true };
};

// --- Metodos estaticos ---
// Busca configuracao de PIX para um bot
PixSettingSchema.statics.getForBot = function (ownerId, botId) {
  return this.findOne({ owner_id: ownerId, bot_id: botId });
};

module.exports = mongoose.model('PixSetting', PixSettingSchema);
