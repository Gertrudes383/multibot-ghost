'use strict';

/**
 * Schema de Notification — Feed de notificacoes para admins
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bot',
      default: null,
    },

    type: {
      type: String,
      enum: [
        'sale', 'recharge', 'exchange', 'refund',
        'new_user', 'stock_low', 'payment_received',
        'broadcast_complete', 'system', 'alert',
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    // Dados extras (link, userId, orderId, etc)
    data: {
      type: Schema.Types.Mixed,
      default: null,
    },

    // Status
    read: {
      type: Boolean,
      default: false,
    },
    read_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: 'notifications',
  }
);

NotificationSchema.index({ owner_id: 1, read: 1, createdAt: -1 }, { name: 'idx_owner_unread' });

// TTL: notificacoes lidas expiram em 30 dias
NotificationSchema.index(
  { read_at: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { read: true }, name: 'idx_ttl_read' }
);

module.exports = mongoose.model('Notification', NotificationSchema);
