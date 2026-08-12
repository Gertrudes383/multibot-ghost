'use strict';

const mongoose = require('mongoose');
const { resolveBinPrice } = require('../utils/priceResolver');
const { User, Card, Order, Bin, Promotion, Activity } = require('../../database/schemas');

class PurchaseService {
  async _resolvePriceForCard(card, botId) {
    const binDoc = await Bin.findOne({ bin: card.bin, $or: [{ bot_id: botId }, { bot_id: null }] })
      .sort({ bot_id: -1 })
      .lean();

    const settings = {
      binPrices: {},
      brandPrices: {},
      countryPrices: {},
      levelPrices: {},
      defaultPrice: binDoc?.default_price || null,
    };

    if (binDoc) {
      if (binDoc.price) settings.binPrices[card.bin] = parseFloat(binDoc.price.toString());
      if (binDoc.brand_price) settings.brandPrices[card.brand?.toLowerCase()] = parseFloat(binDoc.brand_price.toString());
      if (binDoc.country_price) settings.countryPrices[card.country] = parseFloat(binDoc.country_price.toString());
      if (binDoc.level_price) settings.levelPrices[card.level?.toLowerCase()] = parseFloat(binDoc.level_price.toString());
      if (binDoc.default_price) settings.defaultPrice = parseFloat(binDoc.default_price.toString());
    }

    if (!settings.defaultPrice && !Object.keys(settings.binPrices).length) {
      const cardPrice = parseFloat(card.price?.toString() || '0');
      if (cardPrice > 0) settings.defaultPrice = cardPrice;
    }

    const resolved = resolveBinPrice(card.bin, settings, {
      country: card.country,
      level: card.level,
    });

    if (resolved.price <= 0) {
      const err = new Error(`Preco invalido para BIN ${card.bin}. Configure os precos no painel.`);
      err.statusCode = 400;
      throw err;
    }

    return resolved.price;
  }

  async purchaseCard(userId, botId, { bin, country, base, level, brand }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const cardFilter = { status: 'available', owner_id: new mongoose.Types.ObjectId(botId ? undefined : userId) };
      if (botId) {
        cardFilter.bot_id = new mongoose.Types.ObjectId(botId);
        delete cardFilter.owner_id;
      }
      if (bin) cardFilter.bin = bin;
      if (country) cardFilter.country = country.toUpperCase();
      if (base) cardFilter.base = base;
      if (level) cardFilter.level = level.toUpperCase();
      if (brand) cardFilter.brand = brand.toUpperCase();

      const card = await Card.findOneAndUpdate(
        { ...cardFilter, status: 'available' },
        { $set: { status: 'locked' } },
        { new: true, session }
      );

      if (!card) {
        await session.abortTransaction();
        const err = new Error('Nenhum card disponivel com os criterios informados.');
        err.statusCode = 404;
        throw err;
      }

      const price = await this._resolvePriceForCard(card, botId);

      const user = await User.findById(userId).session(session);
      if (!user) {
        await Card.findByIdAndUpdate(card._id, { status: 'available' }, { session });
        await session.abortTransaction();
        const err = new Error('Usuario nao encontrado.');
        err.statusCode = 404;
        throw err;
      }

      const userBalance = parseFloat(user.balance?.toString() || '0');
      if (userBalance < price) {
        await Card.findByIdAndUpdate(card._id, { status: 'available' }, { session });
        await session.abortTransaction();
        const err = new Error(`Saldo insuficiente. Necessario: R$${price.toFixed(2)}, Disponivel: R$${userBalance.toFixed(2)}`);
        err.statusCode = 400;
        err.code = 'SALDO_INSUFICIENTE';
        throw err;
      }

      await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            balance: mongoose.Types.Decimal128.fromString((-price).toFixed(2)),
            totalSpent: mongoose.Types.Decimal128.fromString(price.toFixed(2)),
            purchaseCount: 1,
          },
        },
        { session }
      );

      await Card.findByIdAndUpdate(
        card._id,
        {
          $set: {
            status: 'sold',
            sold_to: userId,
            sold_at: new Date(),
            sold_price: mongoose.Types.Decimal128.fromString(price.toFixed(2)),
          },
        },
        { session }
      );

      const cardWithSensitive = await Card.findById(card._id)
        .select('+number +holder_name +cpf +track1 +track2')
        .session(session)
        .lean();

      const order = await Order.create(
        [
          {
            userId: new mongoose.Types.ObjectId(userId),
            bot_id: botId ? new mongoose.Types.ObjectId(botId) : null,
            owner_id: card.owner_id,
            card_id: card._id,
            card: {
              bin: card.bin,
              brand: card.brand,
              type: card.type,
              level: card.level,
              country: card.country,
              bank: card.bank,
              base: card.base,
              maskedNumber: `${card.bin}******`,
            },
            price: mongoose.Types.Decimal128.fromString(price.toFixed(2)),
            status: 'completed',
            purchase_type: 'unitaria',
          },
        ],
        { session }
      );

      await session.commitTransaction();

      Activity.log?.({
        type: 'purchase',
        userId,
        details: { orderId: order[0]._id, bin: card.bin, price },
      }).catch(() => {});

      return {
        purchase: order[0].toObject(),
        card: {
          number: cardWithSensitive.number,
          holder_name: cardWithSensitive.holder_name,
          cpf: cardWithSensitive.cpf,
          track1: cardWithSensitive.track1,
          track2: cardWithSensitive.track2,
          bin: card.bin,
          brand: card.brand,
          type: card.type,
          level: card.level,
          country: card.country,
          bank: card.bank,
          base: card.base,
        },
        balanceAfter: userBalance - price,
      };
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  async purchaseAsync(userId, botId, { bin, country, quantity = 1, gateway }) {
    if (quantity < 1 || quantity > 50) {
      const err = new Error('Quantidade deve ser entre 1 e 50.');
      err.statusCode = 400;
      throw err;
    }

    const filter = { status: 'available' };
    if (botId) filter.bot_id = new mongoose.Types.ObjectId(botId);
    if (bin) filter.bin = bin;
    if (country) filter.country = country.toUpperCase();

    const available = await Card.countDocuments(filter);
    if (available < quantity) {
      const err = new Error(`Apenas ${available} cards disponiveis. Solicitado: ${quantity}.`);
      err.statusCode = 400;
      throw err;
    }

    const requestId = new mongoose.Types.ObjectId().toString();

    return {
      requestId,
      status: 'processing',
      quantity,
      estimatedTime: quantity * 2,
    };
  }

  async purchaseAutoLive(userId, botId, { bin, country, gateway, maxAttempts = 5 }) {
    if (!gateway) {
      const err = new Error('Gateway e obrigatorio para compra auto-live.');
      err.statusCode = 400;
      throw err;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.purchaseCard(userId, botId, { bin, country });
      return { ...result, attempts: attempt, checkResult: { status: 'live' } };
    }

    const err = new Error('Nenhum card live encontrado apos maximo de tentativas.');
    err.statusCode = 404;
    throw err;
  }

  async purchaseMixPackage(userId, botId, { items }) {
    if (!items || items.length === 0) {
      const err = new Error('Pacote vazio.');
      err.statusCode = 400;
      throw err;
    }

    if (items.length > 20) {
      const err = new Error('Maximo de 20 itens por pacote.');
      err.statusCode = 400;
      throw err;
    }

    const purchases = [];
    let totalPrice = 0;

    for (const item of items) {
      const qty = item.quantity || 1;
      for (let i = 0; i < qty; i++) {
        const result = await this.purchaseCard(userId, botId, {
          bin: item.bin,
          country: item.country,
          base: item.base,
        });
        purchases.push(result);
        totalPrice += parseFloat(result.purchase.price?.toString() || '0');
      }
    }

    const user = await User.findById(userId).lean();

    return {
      purchases,
      totalPrice,
      discount: 0,
      balanceAfter: parseFloat(user.balance?.toString() || '0'),
    };
  }

  async getPurchaseHistory(userId, botId, filters = {}) {
    const { startDate, endDate, status, page = 1, limit = 20 } = filters;

    const query = { userId: new mongoose.Types.ObjectId(userId) };
    if (botId) query.bot_id = new mongoose.Types.ObjectId(botId);
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [purchases, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Order.countDocuments(query),
    ]);

    return {
      purchases,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / lim),
    };
  }
}

module.exports = new PurchaseService();
