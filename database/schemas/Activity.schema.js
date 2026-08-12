/**
 * Schema de Activity (Registro de Atividade) - Log de auditoria da plataforma
 * Registra todas as acoes relevantes: compras, recargas, reembolsos, logins, etc.
 * Essencial para compliance, investigacao de fraude e rastreamento de acoes
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ActivitySchema = new Schema(
  {
    // --- Usuario que realizou a acao ---
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID do usuario e obrigatorio'],
      index: true,
    },
    username: {
      type: String,
      required: [true, 'Username e obrigatorio'],
    },

    // --- Tipo de atividade ---
    type: {
      type: String,
      enum: {
        values: [
          'purchase',
          'recharge',
          'refund',
          'settings_change',
          'login',
          'gift_card_create',
          'gift_card_redeem',
          'card_import',
          'card_delete',
          'user_ban',
          'user_unban',
          'bot_create',
          'bot_update',
          'bot_delete',
          'promotion_create',
          'promotion_update',
          'withdrawal',
          'password_change',
          'api_access',
        ],
        message: 'Tipo de atividade invalido: {VALUE}',
      },
      required: [true, 'Tipo da atividade e obrigatorio'],
      index: true,
    },

    // --- Valor financeiro (se aplicavel) ---
    amount: {
      type: Schema.Types.Decimal128,
      default: null,
      get: (v) => (v ? parseFloat(v.toString()) : null),
    },

    // --- Detalhes adicionais (schema flexivel) ---
    details: {
      type: Schema.Types.Mixed,
      default: {},
      // Ex: { card_id: "...", bin: "123456", reason: "..." }
    },

    // --- Informacoes da requisicao ---
    ip_address: {
      type: String,
      default: null,
    },
    user_agent: {
      type: String,
      default: null,
      maxlength: [500, 'User-Agent muito longo'],
    },

    // --- Multi-tenancy ---
    bot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      default: null,
    },
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'activities',
  }
);

// --- Indices ---
// Indice por data de criacao (consultas de historico com paginacao)
ActivitySchema.index(
  { createdAt: -1 },
  { name: 'idx_created_desc' }
);

// Indice composto para filtrar atividades por dono e tipo
ActivitySchema.index(
  { owner_id: 1, type: 1, createdAt: -1 },
  { name: 'idx_owner_type_date' }
);

// TTL: remove logs de atividade com mais de 365 dias
ActivitySchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 365 * 24 * 60 * 60, // 1 ano
    name: 'idx_ttl_365days',
  }
);

// --- Metodos estaticos ---
// Registra uma nova atividade (metodo utilitario)
ActivitySchema.statics.log = function ({
  userId,
  username,
  type,
  amount = null,
  details = {},
  ipAddress = null,
  userAgent = null,
  botId = null,
  ownerId = null,
}) {
  return this.create({
    user_id: userId,
    username,
    type,
    amount,
    details,
    ip_address: ipAddress,
    user_agent: userAgent,
    bot_id: botId,
    owner_id: ownerId,
  });
};

// Busca atividades recentes de um usuario
ActivitySchema.statics.getRecentByUser = function (userId, limit = 50) {
  return this.find({ user_id: userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Busca atividades de um tenant por tipo
ActivitySchema.statics.getByOwnerAndType = function (ownerId, type, startDate, endDate) {
  const query = { owner_id: ownerId };
  if (type) query.type = type;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = startDate;
    if (endDate) query.createdAt.$lte = endDate;
  }
  return this.find(query).sort({ createdAt: -1 });
};

// Contagem de atividades por tipo (dashboard do admin)
ActivitySchema.statics.countByType = function (ownerId, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.aggregate([
    {
      $match: {
        owner_id: new mongoose.Types.ObjectId(ownerId),
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

module.exports = mongoose.model('Activity', ActivitySchema);
