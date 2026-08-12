/**
 * Schema de ExternalSupplier (Fornecedor Externo) - Integracao com APIs de fornecedores
 * Permite que bots busquem estoque de fornecedores terceiros via API
 * Credenciais sao armazenadas criptografadas na camada de aplicacao
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ExternalSupplierSchema = new Schema(
  {
    // --- Multi-tenancy ---
    bot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      required: [true, 'ID do bot e obrigatorio'],
      unique: true, // um fornecedor por bot
    },
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID do dono e obrigatorio'],
      index: true,
    },

    // --- URL base da API do fornecedor ---
    base_url: {
      type: String,
      required: [true, 'URL base e obrigatoria'],
      validate: {
        validator: function (v) {
          return /^https?:\/\/.+/i.test(v);
        },
        message: 'URL base invalida',
      },
    },

    // --- Autenticacao ---
    credential_header: {
      type: String,
      default: 'Authorization',
      // Nome do header de autenticacao
    },
    credential_scheme: {
      type: String,
      default: 'Bearer',
      // Esquema: Bearer, Basic, Token, etc.
    },
    credential_value: {
      type: String,
      required: [true, 'Credencial e obrigatoria'],
      select: false, // criptografado, nao retorna por padrao
    },

    // --- Timeout da requisicao ---
    timeout_ms: {
      type: Number,
      default: 15000, // 15 segundos
      min: [3000, 'Timeout minimo: 3 segundos'],
      max: [60000, 'Timeout maximo: 60 segundos'],
    },

    // --- Endpoints da API (caminhos relativos a base_url) ---
    catalog_path: {
      type: String,
      default: '/catalog',
      // Endpoint para listar catalogo/estoque disponivel
    },
    reserve_path: {
      type: String,
      default: '/reserve',
      // Endpoint para reservar item
    },
    order_path: {
      type: String,
      default: '/order',
      // Endpoint para confirmar pedido
    },
    status_path: {
      type: String,
      default: '/status',
      // Endpoint para consultar status de pedido
    },

    // --- Ativacao ---
    active: {
      type: Boolean,
      default: true,
    },

    // --- Webhook (notificacoes do fornecedor) ---
    webhook_key: {
      type: String,
      default: null,
      select: false,
      // Chave de validacao do webhook
    },
    webhook_url: {
      type: String,
      default: null,
      // URL que o fornecedor chama para notificar
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'external_suppliers',
  }
);

// --- Indices ---
// Indice por dono (listagem de fornecedores do tenant)
ExternalSupplierSchema.index(
  { owner_id: 1, active: 1 },
  { name: 'idx_owner_active' }
);

// --- Virtuals ---
// URL completa do catalogo
ExternalSupplierSchema.virtual('catalogUrl').get(function () {
  return `${this.base_url}${this.catalog_path}`;
});

// URL completa do endpoint de pedido
ExternalSupplierSchema.virtual('orderUrl').get(function () {
  return `${this.base_url}${this.order_path}`;
});

// --- Metodos de instancia ---
// Monta headers de autenticacao
ExternalSupplierSchema.methods.getAuthHeaders = function () {
  const headers = {};
  if (this.credential_scheme) {
    headers[this.credential_header] = `${this.credential_scheme} ${this.credential_value}`;
  } else {
    headers[this.credential_header] = this.credential_value;
  }
  return headers;
};

// --- Metodos estaticos ---
// Busca fornecedor ativo de um bot
ExternalSupplierSchema.statics.getActiveForBot = function (botId) {
  return this.findOne({ bot_id: botId, active: true }).select('+credential_value +webhook_key');
};

module.exports = mongoose.model('ExternalSupplier', ExternalSupplierSchema);
