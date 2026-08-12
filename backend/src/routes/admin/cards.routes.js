'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { Card, Activity } = require('../../../database/schemas');
const cardService = require('../../services/card.service');
const { sanitizeInputs } = require('../../middleware/sanitize');
const { createUploadMiddleware } = require('../../middleware/uploadHandler');

const upload = createUploadMiddleware('file');

router.get('/', async (req, res) => {
  try {
    const result = await cardService.listCards(req.query.botId, { ...req.query, ownerId: req.user.id });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.post('/', sanitizeInputs, async (req, res) => {
  try {
    const { cards, botId } = req.body;
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ message: 'Lista de cards obrigatória' });
    }
    const result = await cardService.uploadCards(req.user.id, botId, cards);

    Activity.log({
      userId: req.user.id, username: 'admin', type: 'card_import',
      details: { count: result.uploaded, duplicates: result.duplicates },
      ownerId: req.user.id, botId,
    }).catch(() => {});

    res.status(201).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.put('/:cardId', sanitizeInputs, async (req, res) => {
  try {
    const card = await Card.findOne({ _id: req.params.cardId, owner_id: new mongoose.Types.ObjectId(req.user.id) });
    if (!card) return res.status(404).json({ message: 'Card não encontrado' });

    const allowed = ['status', 'price', 'bin', 'brand', 'type', 'level', 'country'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) card[key] = req.body[key];
    }
    await card.save();
    res.json({ card });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:cardId', async (req, res) => {
  try {
    const result = await Card.findOneAndDelete({
      _id: req.params.cardId,
      owner_id: new mongoose.Types.ObjectId(req.user.id),
    });
    if (!result) return res.status(404).json({ message: 'Card não encontrado' });

    Activity.log({
      userId: req.user.id, username: 'admin', type: 'card_delete',
      details: { cardId: result._id, bin: result.bin },
      ownerId: req.user.id,
    }).catch(() => {});

    res.json({ message: 'Card removido' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/upload', upload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Arquivo CSV obrigatório' });

    const content = req.file.buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    const cards = [];

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 4) continue;
      const [number, expMonth, expYear, cvv] = parts;
      if (!number || number.length < 13) continue;
      cards.push({
        number: number.trim(),
        bin: number.trim().substring(0, 6),
        exp_month: expMonth?.trim(),
        exp_year: expYear?.trim(),
        cvv: cvv?.trim(),
        brand: parts[4]?.trim() || 'OTHER',
        country: parts[5]?.trim() || 'BR',
      });
    }

    if (cards.length === 0) return res.status(400).json({ message: 'Nenhum card válido no arquivo' });

    const result = await cardService.uploadCards(req.user.id, req.body.botId || req.query.botId, cards, {
      name: req.file.originalname, source: 'csv_upload',
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const result = await cardService.exportCards(req.user.id, req.body.botId, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.get('/duplicates', async (req, res) => {
  try {
    const result = await cardService.findDuplicates(req.user.id, req.query.botId);
    res.json({ duplicates: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/reactivate', sanitizeInputs, async (req, res) => {
  try {
    const { cardIds, botId } = req.body;
    if (!cardIds || !Array.isArray(cardIds)) return res.status(400).json({ message: 'cardIds obrigatório' });
    const result = await cardService.reactivateCards(req.user.id, botId, cardIds);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const botMatch = req.query.botId ? { bot_id: new mongoose.Types.ObjectId(req.query.botId) } : {};

    const [byStatus, byCountry, byBrand] = await Promise.all([
      Card.aggregate([
        { $match: { owner_id: ownerId, ...botMatch } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Card.aggregate([
        { $match: { owner_id: ownerId, status: 'available', ...botMatch } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 20 },
      ]),
      Card.aggregate([
        { $match: { owner_id: ownerId, status: 'available', ...botMatch } },
        { $group: { _id: '$brand', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({ byStatus, byCountry, byBrand });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/batch-delete', sanitizeInputs, async (req, res) => {
  try {
    const { cardIds, botId } = req.body;
    if (!cardIds || !Array.isArray(cardIds)) return res.status(400).json({ message: 'cardIds obrigatório' });

    const result = await Card.deleteMany({
      _id: { $in: cardIds.map((id) => new mongoose.Types.ObjectId(id)) },
      owner_id: new mongoose.Types.ObjectId(req.user.id),
      ...(botId ? { bot_id: new mongoose.Types.ObjectId(botId) } : {}),
    });

    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
