'use strict';

/**
 * Schema de Setting (Configuracao) — Key-value store para config dinamica
 * Suporta configs globais (owner_id=null) e per-bot
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const SettingSchema = new Schema(
  {
    key: {
      type: String,
      required: [true, 'Chave e obrigatoria'],
      trim: true,
      maxlength: 128,
    },
    value: {
      type: Schema.Types.Mixed,
      default: null,
    },

    // Escopo
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    bot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      default: null,
    },

    // Tipo do valor (para validacao no frontend)
    value_type: {
      type: String,
      enum: ['string', 'number', 'boolean', 'json', 'text'],
      default: 'string',
    },

    // Descricao para o painel admin
    description: {
      type: String,
      default: null,
      maxlength: 256,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: 'settings',
  }
);

SettingSchema.index(
  { key: 1, owner_id: 1, bot_id: 1 },
  { unique: true, name: 'idx_key_scope' }
);

// Busca uma config com fallback: bot -> owner -> global
SettingSchema.statics.getValue = async function (key, ownerId = null, botId = null) {
  const query = [
    { key, bot_id: botId, owner_id: ownerId },
    { key, bot_id: null, owner_id: ownerId },
    { key, bot_id: null, owner_id: null },
  ];

  for (const q of query) {
    const setting = await this.findOne(q).lean();
    if (setting) return setting.value;
  }
  return null;
};

// Seta uma config
SettingSchema.statics.setValue = function (key, value, ownerId = null, botId = null) {
  return this.findOneAndUpdate(
    { key, owner_id: ownerId, bot_id: botId },
    { $set: { value, owner_id: ownerId, bot_id: botId } },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('Setting', SettingSchema);
