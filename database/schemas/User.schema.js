/**
 * Schema de Usuario - Modelo principal de usuarios da plataforma
 * Suporta multi-tenancy atraves do campo owner_id
 * Usuarios podem ser: superadmin da plataforma, admin de tenant, suporte ou usuario final (telegram)
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    // --- Credenciais de acesso ---
    username: {
      type: String,
      required: [true, 'Nome de usuario e obrigatorio'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Nome de usuario deve ter no minimo 3 caracteres'],
      maxlength: [64, 'Nome de usuario deve ter no maximo 64 caracteres'],
      match: [/^[a-z0-9_.-]+$/, 'Nome de usuario contem caracteres invalidos'],
    },
    password: {
      type: String,
      required: [true, 'Senha e obrigatoria'],
      minlength: [6, 'Senha deve ter no minimo 6 caracteres'],
      select: false, // nao retorna a senha por padrao nas queries
    },

    // --- Saldo e financeiro ---
    balance: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    total_recharged: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    totalSpent: {
      type: Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    purchaseCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // --- Permissoes e papeis ---
    isAdmin: {
      type: Boolean,
      default: false,
    },
    is_super_admin: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'support', 'user'],
        message: 'Papel invalido: {VALUE}',
      },
      default: 'user',
    },

    // --- Banimento ---
    banned: {
      type: Boolean,
      default: false,
    },
    ban_reason: {
      type: String,
      default: null,
      maxlength: [500, 'Motivo do banimento muito longo'],
    },

    // --- Multi-tenancy ---
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // --- Referral ---
    referral_code: {
      type: String,
      default: null,
      sparse: true,
      trim: true,
    },
    referral_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // --- Gamificacao ---
    diamonds: {
      type: Number,
      default: 0,
      min: 0,
    },

    // --- Preferencias ---
    notify: {
      type: Boolean,
      default: true,
    },

    // --- Dados do Telegram ---
    bot_id: {
      type: Number,
      default: null,
    },
    telegram_id: {
      type: String,
      default: null,
      sparse: true,
    },
    telegram_username: {
      type: String,
      default: null,
      trim: true,
    },
    telegram_last_seen: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt e updatedAt automaticos
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'users',
  }
);

// --- Indices ---
// Indice composto unico para telegram_id + bot_id (um usuario telegram por bot)
UserSchema.index(
  { telegram_id: 1, bot_id: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      telegram_id: { $type: 'string' },
      bot_id: { $type: 'number' },
    },
    name: 'idx_telegram_user_per_bot',
  }
);

// Indice para busca por papel do usuario
UserSchema.index({ role: 1 }, { name: 'idx_role' });

// --- Virtuals ---
// Campo virtual que indica se o usuario e um usuario de telegram
UserSchema.virtual('isTelegramUser').get(function () {
  return !!this.telegram_id;
});

// Campo virtual para nome de exibicao
UserSchema.virtual('displayName').get(function () {
  return this.telegram_username || this.username;
});

// --- Middleware pre-save ---
// Hash da senha antes de salvar
UserSchema.pre('save', async function (next) {
  // So faz hash se a senha foi modificada
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// --- Metodos de instancia ---
// Compara a senha fornecida com o hash armazenado
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Retorna objeto seguro sem campos sensiveis
UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// --- Metodos estaticos ---
// Busca usuario por telegram_id dentro de um bot especifico
UserSchema.statics.findByTelegram = function (telegramId, botId) {
  return this.findOne({ telegram_id: String(telegramId), bot_id: botId });
};

// Busca todos os usuarios de um tenant especifico
UserSchema.statics.findByOwner = function (ownerId, filters = {}) {
  return this.find({ owner_id: ownerId, ...filters });
};

module.exports = mongoose.model('User', UserSchema);
