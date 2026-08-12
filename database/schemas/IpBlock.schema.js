/**
 * Schema de IpBlock (Bloqueio de IP) - Controle de acesso por IP
 * Permite que tenants bloqueiem IPs suspeitos ou abusivos
 * Suporta bloqueio temporario (por horas) com TTL automatico
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const IpBlockSchema = new Schema(
  {
    // --- IP bloqueado ---
    ip: {
      type: String,
      required: [true, 'IP e obrigatorio'],
      validate: {
        validator: function (v) {
          // Valida IPv4 e IPv6 basicos
          const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
          const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
          const cidr = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
          return ipv4.test(v) || ipv6.test(v) || cidr.test(v);
        },
        message: 'Formato de IP invalido',
      },
    },

    // --- Duracao do bloqueio ---
    hours: {
      type: Number,
      default: 24, // 24 horas por padrao
      min: [1, 'Bloqueio minimo: 1 hora'],
      max: [8760, 'Bloqueio maximo: 1 ano (8760 horas)'],
    },

    // --- Motivo ---
    reason: {
      type: String,
      default: 'Bloqueio manual',
      maxlength: [500, 'Motivo muito longo'],
    },

    // --- Quem bloqueou ---
    blocked_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID do usuario que bloqueou e obrigatorio'],
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
      required: [true, 'ID do dono e obrigatorio'],
    },

    // --- Expiracao ---
    expires_at: {
      type: Date,
      default: function () {
        return new Date(Date.now() + this.hours * 60 * 60 * 1000);
      },
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'ip_blocks',
  }
);

// --- Indices ---
// Indice composto para busca rapida de IP por tenant
IpBlockSchema.index(
  { ip: 1, owner_id: 1 },
  { name: 'idx_ip_owner' }
);

// TTL: remove bloqueios expirados automaticamente
IpBlockSchema.index(
  { expires_at: 1 },
  {
    expireAfterSeconds: 0, // remove imediatamente apos expires_at
    name: 'idx_ttl_auto_remove',
  }
);

// --- Pre-save: calcula expires_at baseado em hours ---
IpBlockSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('hours')) {
    this.expires_at = new Date(this.createdAt || Date.now() + this.hours * 60 * 60 * 1000);
  }
  next();
});

// --- Virtuals ---
// Indica se o bloqueio ainda esta ativo
IpBlockSchema.virtual('isActive').get(function () {
  return new Date() < this.expires_at;
});

// Horas restantes do bloqueio
IpBlockSchema.virtual('remainingHours').get(function () {
  const diff = this.expires_at.getTime() - Date.now();
  return Math.max(0, (diff / (1000 * 60 * 60)).toFixed(1));
});

// --- Metodos estaticos ---
// Verifica se um IP esta bloqueado para um tenant
IpBlockSchema.statics.isBlocked = async function (ip, ownerId) {
  const block = await this.findOne({
    ip,
    owner_id: ownerId,
    expires_at: { $gt: new Date() },
  });
  return block || null;
};

// Bloqueia um IP
IpBlockSchema.statics.blockIp = function ({ ip, hours, reason, blockedBy, botId, ownerId }) {
  return this.create({
    ip,
    hours: hours || 24,
    reason: reason || 'Bloqueio manual',
    blocked_by: blockedBy,
    bot_id: botId || null,
    owner_id: ownerId,
  });
};

// Remove bloqueio de um IP
IpBlockSchema.statics.unblockIp = function (ip, ownerId) {
  return this.deleteMany({ ip, owner_id: ownerId });
};

module.exports = mongoose.model('IpBlock', IpBlockSchema);
