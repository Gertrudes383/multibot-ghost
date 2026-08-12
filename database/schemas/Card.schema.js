/**
 * Schema de Card - Modelo de cartoes no estoque
 * Dados sensiveis (number, holder_name, cpf) sao armazenados criptografados
 * Suporta bases: full, sem (sem cvv), consultaveis, tracks
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const CardSchema = new Schema(
  {
    // --- Dados do cartao (criptografados na camada de aplicacao) ---
    number: {
      type: String,
      required: [true, 'Numero do cartao e obrigatorio'],
      select: false, // nao retorna por padrao por seguranca
    },
    holder_name: {
      type: String,
      default: null,
      select: false,
    },
    cpf: {
      type: String,
      default: null,
      select: false,
    },

    // --- Dados de tracks (para base tracks) ---
    track1: {
      type: String,
      default: null,
      select: false,
    },
    track2: {
      type: String,
      default: null,
      select: false,
    },

    // --- Informacoes do BIN ---
    bin: {
      type: String,
      required: [true, 'BIN e obrigatorio'],
      minlength: [6, 'BIN deve ter 6 digitos'],
      maxlength: [6, 'BIN deve ter 6 digitos'],
      match: [/^\d{6}$/, 'BIN deve conter apenas numeros'],
      index: true,
    },
    bank: {
      type: String,
      default: null,
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: ['CREDIT', 'DEBIT'],
        message: 'Tipo invalido: {VALUE}. Use CREDIT ou DEBIT',
      },
      required: [true, 'Tipo do cartao e obrigatorio'],
    },
    level: {
      type: String,
      enum: {
        values: [
          'STANDARD',
          'GOLD',
          'PLATINUM',
          'BLACK',
          'INFINITE',
          'PREPAID',
          'BUSINESS',
        ],
        message: 'Nivel invalido: {VALUE}',
      },
      default: 'STANDARD',
    },
    brand: {
      type: String,
      enum: {
        values: [
          'VISA',
          'MASTERCARD',
          'AMEX',
          'ELO',
          'HIPERCARD',
          'DINERS',
          'DISCOVER',
          'JCB',
          'AURA',
          'CABAL',
          'UNIONPAY',
          'OTHER',
        ],
        message: 'Bandeira invalida: {VALUE}',
      },
      required: [true, 'Bandeira e obrigatoria'],
    },
    country: {
      type: String,
      maxlength: [2, 'Codigo do pais deve ter 2 caracteres (ISO 3166-1 alpha-2)'],
      uppercase: true,
      default: 'BR',
    },

    // --- Preco e base ---
    price: {
      type: Schema.Types.Decimal128,
      required: [true, 'Preco e obrigatorio'],
      get: (v) => (v ? parseFloat(v.toString()) : 0),
      validate: {
        validator: function (v) {
          return parseFloat(v.toString()) >= 0;
        },
        message: 'Preco nao pode ser negativo',
      },
    },
    base: {
      type: String,
      enum: {
        values: ['full', 'sem', 'consultaveis', 'tracks'],
        message: 'Base invalida: {VALUE}. Use full, sem, consultaveis ou tracks',
      },
      required: [true, 'Base e obrigatoria'],
      default: 'full',
    },

    // --- Status do cartao ---
    status: {
      type: String,
      enum: {
        values: ['available', 'sold', 'dead', 'locked'],
        message: 'Status invalido: {VALUE}',
      },
      default: 'available',
    },

    // --- Referencias (multi-tenancy e rastreabilidade) ---
    batch_id: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
      index: true,
    },
    bot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      default: null,
    },
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner e obrigatorio'],
    },

    // --- Dados de venda ---
    sold_to: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sold_at: {
      type: Date,
      default: null,
    },
    sold_price: {
      type: Schema.Types.Decimal128,
      default: null,
      get: (v) => (v ? parseFloat(v.toString()) : null),
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'cards',
  }
);

// --- Indices compostos ---
// Busca rapida por base + status (consulta mais frequente na loja)
CardSchema.index(
  { base: 1, status: 1 },
  { name: 'idx_base_status' }
);

// Busca por bot e status (estoque por bot)
CardSchema.index(
  { bot_id: 1, status: 1 },
  { name: 'idx_bot_status' }
);

// Busca por dono (listagem de estoque do tenant)
CardSchema.index(
  { owner_id: 1, status: 1 },
  { name: 'idx_owner_status' }
);

// Busca por pais e status (filtro geografico)
CardSchema.index(
  { country: 1, status: 1, base: 1 },
  { name: 'idx_country_status_base' }
);

// --- Virtuals ---
// BIN mascarado para exibicao segura
CardSchema.virtual('maskedNumber').get(function () {
  if (!this.number) return null;
  // Mostra apenas os primeiros 6 e ultimos 4 digitos
  const num = this.number;
  if (num.length >= 10) {
    return `${num.substring(0, 6)}******${num.substring(num.length - 4)}`;
  }
  return `${this.bin}******`;
});

// Indica se o cartao esta disponivel para venda
CardSchema.virtual('isAvailable').get(function () {
  return this.status === 'available';
});

// --- Metodos estaticos ---
// Conta estoque disponivel agrupado por bin, level, base
CardSchema.statics.getStockSummary = function (ownerId, botId) {
  const match = { owner_id: ownerId, status: 'available' };
  if (botId) match.bot_id = botId;

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: { bin: '$bin', level: '$level', base: '$base', brand: '$brand' },
        count: { $sum: 1 },
        avgPrice: { $avg: { $toDouble: '$price' } },
      },
    },
    { $sort: { '_id.bin': 1 } },
  ]);
};

// Reserva um cartao para venda (operacao atomica)
CardSchema.statics.reserveCard = function (filters) {
  return this.findOneAndUpdate(
    { ...filters, status: 'available' },
    { $set: { status: 'locked' } },
    { new: true }
  );
};

module.exports = mongoose.model('Card', CardSchema);
