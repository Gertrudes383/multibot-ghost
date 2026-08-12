'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { Batch, Card } = require('../../../database/schemas');
const { sanitizeInputs } = require('../../middleware/sanitize');

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, botId } = req.query;
    const query = { owner_id: new mongoose.Types.ObjectId(req.user.id) };
    if (botId) query.bot_id = new mongoose.Types.ObjectId(botId);

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const [batches, total] = await Promise.all([
      Batch.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Batch.countDocuments(query),
    ]);

    res.json({ batches, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:batchId', async (req, res) => {
  try {
    const batch = await Batch.findOne({
      _id: req.params.batchId,
      owner_id: new mongoose.Types.ObjectId(req.user.id),
    }).lean();
    if (!batch) return res.status(404).json({ message: 'Lote não encontrado' });
    res.json({ batch });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', sanitizeInputs, async (req, res) => {
  try {
    const { name, botId } = req.body;
    const batch = await Batch.create({
      name: name || `Lote ${new Date().toISOString().slice(0, 10)}`,
      owner_id: req.user.id,
      bot_id: botId || null,
      total: 0,
      source: 'manual',
    });
    res.status(201).json({ batch });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:batchId', sanitizeInputs, async (req, res) => {
  try {
    const batch = await Batch.findOne({
      _id: req.params.batchId,
      owner_id: new mongoose.Types.ObjectId(req.user.id),
    });
    if (!batch) return res.status(404).json({ message: 'Lote não encontrado' });

    if (req.body.name !== undefined) batch.name = req.body.name;
    await batch.save();
    res.json({ batch });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:batchId', async (req, res) => {
  try {
    const result = await Batch.findOneAndDelete({
      _id: req.params.batchId,
      owner_id: new mongoose.Types.ObjectId(req.user.id),
    });
    if (!result) return res.status(404).json({ message: 'Lote não encontrado' });
    res.json({ message: 'Lote removido' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:batchId/cards', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const lim = Math.min(100, parseInt(limit, 10));

    const query = { batch_id: new mongoose.Types.ObjectId(req.params.batchId) };
    const [cards, total] = await Promise.all([
      Card.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Card.countDocuments(query),
    ]);

    res.json({ cards, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:batchId/activate', async (req, res) => {
  try {
    const result = await Card.updateMany(
      { batch_id: new mongoose.Types.ObjectId(req.params.batchId), status: 'pending' },
      { $set: { status: 'available' } }
    );
    res.json({ activated: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:batchId/deactivate', async (req, res) => {
  try {
    const result = await Card.updateMany(
      { batch_id: new mongoose.Types.ObjectId(req.params.batchId), status: 'available' },
      { $set: { status: 'pending' } }
    );
    res.json({ deactivated: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
