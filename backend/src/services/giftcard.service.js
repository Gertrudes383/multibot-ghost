'use strict';

const mongoose = require('mongoose');
const { GiftCard, User, Activity } = require('../../database/schemas');

class GiftcardService {
  async redeemGiftcard(userId, botId, code) {
    if (!code || typeof code !== 'string' || code.trim().length < 6) {
      const err = new Error('Código inválido');
      err.statusCode = 400;
      throw err;
    }

    const giftCard = await GiftCard.redeemByCode(code, userId);

    if (!giftCard) {
      const err = new Error('Gift card inválido, já utilizado ou expirado');
      err.statusCode = 400;
      throw err;
    }

    if (String(giftCard.created_by) === String(userId)) {
      await GiftCard.findByIdAndUpdate(giftCard._id, {
        status: 'active',
        redeemed_by: null,
        redeemed_at: null,
      });
      const err = new Error('Você não pode resgatar um gift card criado por você mesmo');
      err.statusCode = 403;
      throw err;
    }

    if (String(giftCard.bot_id) !== String(botId)) {
      await GiftCard.findByIdAndUpdate(giftCard._id, {
        status: 'active',
        redeemed_by: null,
        redeemed_at: null,
      });
      const err = new Error('Gift card pertence a outro bot');
      err.statusCode = 403;
      throw err;
    }

    const amount = parseFloat(giftCard.value?.toString() || '0');
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { balance: mongoose.Types.Decimal128.fromString(amount.toFixed(2)) } },
      { new: true }
    );

    Activity.log({
      userId,
      username: user.username,
      type: 'gift_card_redeem',
      amount,
      details: { code: giftCard.code, giftCardId: giftCard._id },
      botId,
      ownerId: giftCard.owner_id,
    }).catch(() => {});

    return {
      success: true,
      amount,
      balanceAfter: parseFloat(user.balance?.toString() || '0'),
      giftcard: {
        code: giftCard.code,
        value: amount,
        redeemedAt: giftCard.redeemed_at,
      },
    };
  }

  async getGiftcardHistory(userId, botId) {
    const giftcards = await GiftCard.find({
      redeemed_by: userId,
      bot_id: botId,
    })
      .sort({ redeemed_at: -1 })
      .limit(50)
      .lean();

    return giftcards.map((gc) => ({
      code: gc.code.slice(0, 4) + '****' + gc.code.slice(-4),
      amount: parseFloat(gc.value?.toString() || '0'),
      redeemedAt: gc.redeemed_at,
      status: gc.status,
    }));
  }

  async createGiftcard(botId, amount, quantity, creatorId) {
    const amountNum = parseFloat(amount);
    const qty = Math.min(Math.max(1, parseInt(quantity, 10) || 1), 100);

    if (!amountNum || amountNum <= 0) {
      const err = new Error('Valor deve ser positivo');
      err.statusCode = 400;
      throw err;
    }

    const cards = [];
    for (let i = 0; i < qty; i++) {
      cards.push({
        code: GiftCard.generateCode(),
        value: mongoose.Types.Decimal128.fromString(amountNum.toFixed(2)),
        bot_id: botId,
        owner_id: creatorId,
        created_by: creatorId,
        status: 'active',
      });
    }

    const created = await GiftCard.insertMany(cards);

    Activity.log({
      userId: creatorId,
      username: 'admin',
      type: 'gift_card_create',
      amount: amountNum * qty,
      details: { quantity: qty, unitValue: amountNum },
      botId,
      ownerId: creatorId,
    }).catch(() => {});

    return {
      created: created.length,
      codes: created.map((c) => c.code),
      totalValue: amountNum * qty,
    };
  }

  async validateGiftcardCode(code) {
    if (!code || typeof code !== 'string') {
      return { valid: false, amount: null, expiresAt: null, status: 'invalid' };
    }

    const gc = await GiftCard.findOne({ code: code.toUpperCase().trim() }).lean();
    if (!gc) {
      return { valid: false, amount: null, expiresAt: null, status: 'not_found' };
    }

    if (gc.status !== 'active') {
      return { valid: false, amount: parseFloat(gc.value?.toString() || '0'), expiresAt: gc.expires_at, status: gc.status };
    }

    if (gc.expires_at && new Date() > new Date(gc.expires_at)) {
      return { valid: false, amount: parseFloat(gc.value?.toString() || '0'), expiresAt: gc.expires_at, status: 'expired' };
    }

    return {
      valid: true,
      amount: parseFloat(gc.value?.toString() || '0'),
      expiresAt: gc.expires_at,
      status: 'active',
    };
  }
}

module.exports = new GiftcardService();
