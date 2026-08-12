/**
 * Schema de Recharge (Recarga) - Registra depositos/recargas dos usuarios
 * Suporta metodos: PIX automatico, criptomoeda, e recarga manual (admin)
 * Inclui controle de expiracao e referencia de transacao
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const RechargeSchema = new Schema(
  {
    // --- Usuario que fez a recarga ---
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID do usuario e obrigatorio'],
      index: true,
    },

    // --- Valor ---
    amount: {
      type: Schema.Types.Decimal128,
      required: [true, 'Valor da recarga e obrigatorio'],
      get: (v) => (v ? parseFloat(v.toString()) : 0),
      validate: {
        validator: function (v) {
          return parseFloat(v.toString()) > 0;
        },
        message: 'Valor da recarga deve ser positivo',
      },
    },

    // --- Metodo de pagamento ---
    method: {
      type: String,
      enum: {
        values: ['pix_auto', 'crypto', 'manual'],
        message: 'Metodo invalido: {VALUE}. Use pix_auto, crypto ou manual',
      },
      required: [true, 'Metodo de pagamento e obrigatorio'],
    },

    // --- Status da recarga ---
    status: {
      type: String,
      enum: {
        values: ['pending', 'completed', 'failed', 'cancelled'],
        message: 'Status invalido: {VALUE}',
      },
      default: 'pending',
    },

    // --- Dados do PIX ---
    pix_key: {
      type: String,
      default: null,
    },
    qr_code: {
      type: String,
      default: null,
      maxlength: [5000, 'QR code muito longo'],
    },

    // --- Referencia da transacao ---
    txn_id: {
      type: String,
      default: null,
    },

    // --- Multi-tenancy ---
    bot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      required: [true, 'ID do bot e obrigatorio'],
      index: true,
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
        // Expira em 30 minutos por padrao
        return new Date(Date.now() + 30 * 60 * 1000);
      },
    },

    // --- Data de conclusao ---
    completed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
    collection: 'recharges',
  }
);

// --- Indices ---
// Indice para busca por status (processamento de recargas pendentes)
RechargeSchema.index({ status: 1 }, { name: 'idx_status' });

// Indice unico esparso para txn_id (evita duplicatas de transacao)
RechargeSchema.index(
  { txn_id: 1 },
  {
    unique: true,
    sparse: true,
    name: 'idx_txn_id_unique',
  }
);

// Indice para expiracao (TTL nao automatico — controlado pela aplicacao)
RechargeSchema.index({ expires_at: 1 }, { name: 'idx_expires' });

// Indice composto para relatorios por dono e periodo
RechargeSchema.index(
  { owner_id: 1, createdAt: -1 },
  { name: 'idx_owner_created' }
);

// --- Virtuals ---
// Indica se a recarga expirou
RechargeSchema.virtual('isExpired').get(function () {
  if (this.status !== 'pending') return false;
  return this.expires_at && new Date() > this.expires_at;
});

// Indica se a recarga foi concluida com sucesso
RechargeSchema.virtual('isCompleted').get(function () {
  return this.status === 'completed';
});

// Tempo restante ate expirar (em segundos)
RechargeSchema.virtual('remainingSeconds').get(function () {
  if (this.status !== 'pending' || !this.expires_at) return 0;
  const diff = this.expires_at.getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
});

// --- Metodos estaticos ---
// Marca recargas pendentes expiradas como canceladas
RechargeSchema.statics.cancelExpired = function () {
  return this.updateMany(
    {
      status: 'pending',
      expires_at: { $lte: new Date() },
    },
    {
      $set: { status: 'cancelled' },
    }
  );
};

// Completa uma recarga por txn_id (webhook callback)
RechargeSchema.statics.completeByTxnId = async function (txnId, amount) {
  const recharge = await this.findOneAndUpdate(
    {
      txn_id: txnId,
      status: 'pending',
    },
    {
      $set: {
        status: 'completed',
        amount: amount || undefined,
        completed_at: new Date(),
      },
    },
    { new: true }
  );
  return recharge;
};

// Relatorio de recargas por bot e periodo
RechargeSchema.statics.getRechargeReport = function (botId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        bot_id: new mongoose.Types.ObjectId(botId),
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$method',
        totalRecharges: { $sum: 1 },
        totalAmount: { $sum: { $toDouble: '$amount' } },
      },
    },
  ]);
};

module.exports = mongoose.model('Recharge', RechargeSchema);
