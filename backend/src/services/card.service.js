'use strict';

const mongoose = require('mongoose');
const { Card, Batch, Bin, CheckerSetting } = require('../../database/schemas');

class CardService {
  async listCards(botId, filters = {}) {
    const { bin, country, brand, type, level, base, status, page = 1, limit = 50 } = filters;

    const query = { owner_id: new mongoose.Types.ObjectId(filters.ownerId) };
    if (botId) query.bot_id = new mongoose.Types.ObjectId(botId);
    if (status) query.status = status;
    else query.status = 'available';
    if (bin) query.bin = bin;
    if (country) query.country = country.toUpperCase();
    if (brand) query.brand = brand.toUpperCase();
    if (type) query.type = type.toUpperCase();
    if (level) query.level = level.toUpperCase();
    if (base) query.base = base;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [cards, total] = await Promise.all([
      Card.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Card.countDocuments(query),
    ]);

    return {
      cards,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / lim),
    };
  }

  async getCardCountries(ownerId, botId) {
    const match = { owner_id: new mongoose.Types.ObjectId(ownerId), status: 'available' };
    if (botId) match.bot_id = new mongoose.Types.ObjectId(botId);

    return Card.aggregate([
      { $match: match },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $project: { country: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } },
    ]);
  }

  async getCardGateways(ownerId, botId) {
    if (!botId) return [];
    const settings = await CheckerSetting.findOne({ bot_id: botId }).lean();
    if (!settings || !settings.gateways) return [];
    return settings.gateways.map((g) => ({
      id: g.id || g.name,
      name: g.name,
      status: g.active ? 'online' : 'offline',
      approvalRate: g.approval_rate || 0,
    }));
  }

  async massCheck(botId, cardIds, gateway) {
    if (!cardIds || cardIds.length === 0) {
      const err = new Error('Lista de cards nao pode ser vazia.');
      err.statusCode = 400;
      throw err;
    }

    if (cardIds.length > 100) {
      const err = new Error('Maximo de 100 cards por sessao de check.');
      err.statusCode = 400;
      throw err;
    }

    const sessionId = new mongoose.Types.ObjectId().toString();

    await Card.updateMany(
      { _id: { $in: cardIds.map((id) => new mongoose.Types.ObjectId(id)) }, bot_id: new mongoose.Types.ObjectId(botId) },
      { $set: { status: 'locked' } }
    );

    return { sessionId, totalCards: cardIds.length, status: 'pending' };
  }

  async getCheckSessions(botId) {
    // Check sessions podem ser armazenadas em ValidationLog
    const { ValidationLog } = require('../../database/schemas');
    return ValidationLog.find({ bot_id: new mongoose.Types.ObjectId(botId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  async uploadCards(ownerId, botId, cards, batchInfo = {}) {
    if (!cards || cards.length === 0) {
      const err = new Error('Lista de cards vazia.');
      err.statusCode = 400;
      throw err;
    }

    const batch = await Batch.create({
      name: batchInfo.name || `Lote ${new Date().toISOString().slice(0, 10)}`,
      source: batchInfo.source || 'manual',
      owner_id: new mongoose.Types.ObjectId(ownerId),
      bot_id: botId ? new mongoose.Types.ObjectId(botId) : null,
      total: cards.length,
    });

    let uploaded = 0;
    let duplicates = 0;
    let invalid = 0;

    const bulkOps = [];
    for (const card of cards) {
      if (!card.number || !card.bin || !card.brand) {
        invalid++;
        continue;
      }

      bulkOps.push({
        insertOne: {
          document: {
            number: card.number,
            holder_name: card.holder_name || null,
            cpf: card.cpf || null,
            track1: card.track1 || null,
            track2: card.track2 || null,
            bin: card.bin.substring(0, 6),
            bank: card.bank || null,
            type: card.type || 'CREDIT',
            level: card.level || 'STANDARD',
            brand: card.brand.toUpperCase(),
            country: card.country || 'BR',
            price: card.price || batchInfo.basePrice || 0,
            base: card.base || 'full',
            status: 'available',
            batch_id: batch._id,
            bot_id: botId ? new mongoose.Types.ObjectId(botId) : null,
            owner_id: new mongoose.Types.ObjectId(ownerId),
          },
        },
      });
    }

    if (bulkOps.length > 0) {
      try {
        const result = await Card.bulkWrite(bulkOps, { ordered: false });
        uploaded = result.insertedCount;
        duplicates = bulkOps.length - uploaded - invalid;
      } catch (bulkErr) {
        if (bulkErr.code === 11000) {
          uploaded = bulkErr.result?.nInserted || 0;
          duplicates = bulkOps.length - uploaded;
        } else {
          throw bulkErr;
        }
      }
    }

    await Batch.findByIdAndUpdate(batch._id, {
      total: uploaded,
      available: uploaded,
    });

    return { uploaded, duplicates, invalid, batchId: batch._id.toString() };
  }

  async exportCards(ownerId, botId, filters = {}) {
    const query = { owner_id: new mongoose.Types.ObjectId(ownerId) };
    if (botId) query.bot_id = new mongoose.Types.ObjectId(botId);
    if (filters.status) query.status = filters.status;
    if (filters.bin) query.bin = filters.bin;
    if (filters.base) query.base = filters.base;

    const cards = await Card.find(query)
      .select('+number +holder_name +cpf')
      .limit(10000)
      .lean();

    const lines = cards.map((c) => {
      if (c.base === 'tracks') return `${c.track1 || ''}|${c.track2 || ''}`;
      const parts = [c.number, c.exp_month, c.exp_year, c.cvv];
      if (c.base === 'full' && c.cpf) parts.push(c.cpf);
      if (c.holder_name) parts.push(c.holder_name);
      return parts.join('|');
    });

    return { data: lines.join('\n'), format: 'txt', count: cards.length };
  }

  async findDuplicates(ownerId, botId) {
    const match = { owner_id: new mongoose.Types.ObjectId(ownerId) };
    if (botId) match.bot_id = new mongoose.Types.ObjectId(botId);

    const duplicates = await Card.aggregate([
      { $match: match },
      { $group: { _id: '$bin', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return {
      duplicates,
      totalDuplicates: duplicates.reduce((sum, d) => sum + d.count - 1, 0),
    };
  }

  async reactivateCards(ownerId, botId, cardIds) {
    if (!cardIds || cardIds.length === 0) {
      const err = new Error('Lista de cards vazia.');
      err.statusCode = 400;
      throw err;
    }

    const filter = {
      _id: { $in: cardIds.map((id) => new mongoose.Types.ObjectId(id)) },
      owner_id: new mongoose.Types.ObjectId(ownerId),
      status: { $in: ['dead', 'locked'] },
    };
    if (botId) filter.bot_id = new mongoose.Types.ObjectId(botId);

    const result = await Card.updateMany(filter, { $set: { status: 'available' } });

    return {
      reactivated: result.modifiedCount,
      failed: cardIds.length - result.modifiedCount,
    };
  }
}

module.exports = new CardService();
