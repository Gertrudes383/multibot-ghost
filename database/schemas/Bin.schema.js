/**
 * Schema de Bin - Tabela de precos por BIN
 * Permite precificacao customizada por tenant (owner_id)
 * BINs globais servem como fallback quando nao ha preco customizado
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const BinSchema = new Schema(
  {
    // --- Identificacao do BIN ---
    bin: {
      type: String,
      required: [true, 'BIN e obrigatorio'],
      minlength: [6, 'BIN deve ter 6 digitos'],
      maxlength: [6, 'BIN deve ter 6 digitos'],
      match: [/^\d{6}$/, 'BIN deve conter apenas numeros'],
    },

    // --- Informacoes do cartao ---
    brand: {
      type: String,
      enum: [
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
      default: 'OTHER',
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      default: 'CREDIT',
    },
    level: {
      type: String,
      enum: [
        'STANDARD',
        'GOLD',
        'PLATINUM',
        'BLACK',
        'INFINITE',
        'PREPAID',
        'BUSINESS',
      ],
      default: 'STANDARD',
    },
    country: {
      type: String,
      maxlength: 2,
      uppercase: true,
      default: 'BR',
    },
    bank: {
      type: String,
      default: null,
      trim: true,
    },

    // --- Precos por base ---
    price: {
      type: Schema.Types.Decimal128,
      required: [true, 'Preco base (full) e obrigatorio'],
      get: (v) => (v ? parseFloat(v.toString()) : 0),
      validate: {
        validator: (v) => parseFloat(v.toString()) >= 0,
        message: 'Preco nao pode ser negativo',
      },
    },
    price_sem: {
      type: Schema.Types.Decimal128,
      default: null,
      get: (v) => (v ? parseFloat(v.toString()) : null),
    },
    price_consultaveis: {
      type: Schema.Types.Decimal128,
      default: null,
      get: (v) => (v ? parseFloat(v.toString()) : null),
    },
    price_tracks: {
      type: Schema.Types.Decimal128,
      default: null,
      get: (v) => (v ? parseFloat(v.toString()) : null),
    },

    // --- Multi-tenancy ---
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = global (usado como fallback)
    },

    // --- Origem ---
    source: {
      type: String,
      enum: {
        values: ['global', 'custom'],
        message: 'Origem invalida: {VALUE}',
      },
      default: 'global',
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'bins',
  }
);

// --- Indices ---
// Indice composto unico: um registro por BIN por tenant
BinSchema.index(
  { bin: 1, owner_id: 1 },
  {
    unique: true,
    name: 'idx_bin_owner_unique',
  }
);

// Indice para busca por bandeira e nivel (filtros comuns)
BinSchema.index(
  { brand: 1, level: 1 },
  { name: 'idx_brand_level' }
);

// --- Metodos estaticos ---
// Busca preco do BIN considerando customizacao do tenant
// Primeiro tenta customizado, depois fallback para global
BinSchema.statics.getPriceForBin = async function (binNumber, ownerId, base = 'full') {
  // Tenta preco customizado do tenant
  let binInfo = await this.findOne({ bin: binNumber, owner_id: ownerId });

  // Fallback para preco global
  if (!binInfo) {
    binInfo = await this.findOne({ bin: binNumber, owner_id: null, source: 'global' });
  }

  if (!binInfo) return null;

  // Retorna preco conforme a base solicitada
  const priceMap = {
    full: binInfo.price,
    sem: binInfo.price_sem || binInfo.price,
    consultaveis: binInfo.price_consultaveis || binInfo.price,
    tracks: binInfo.price_tracks || binInfo.price,
  };

  return {
    price: priceMap[base] || binInfo.price,
    binInfo,
  };
};

// Lista todos os BINs disponiveis para um tenant (customizados + globais sem override)
BinSchema.statics.getEffectiveBins = async function (ownerId) {
  // Busca BINs customizados do tenant
  const customBins = await this.find({ owner_id: ownerId });
  const customBinNumbers = customBins.map((b) => b.bin);

  // Busca BINs globais que nao tem override customizado
  const globalBins = await this.find({
    source: 'global',
    owner_id: null,
    bin: { $nin: customBinNumbers },
  });

  return [...customBins, ...globalBins];
};

module.exports = mongoose.model('Bin', BinSchema);
