'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { Bin } = require('../../../database/schemas');
const { sanitizeInputs } = require('../../middleware/sanitize');

router.get('/', async (req, res) => {
  try {
    const bins = await Bin.getEffectiveBins(req.user.id);
    res.json({ bins });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', sanitizeInputs, async (req, res) => {
  try {
    const { bin, brand, type, level, country, price, price_sem, price_consultaveis, price_tracks } = req.body;
    if (!bin || !price) return res.status(400).json({ message: 'bin e price obrigatórios' });

    const binDoc = await Bin.create({
      bin, brand, type, level, country,
      price: mongoose.Types.Decimal128.fromString(String(price)),
      price_sem: price_sem ? mongoose.Types.Decimal128.fromString(String(price_sem)) : null,
      price_consultaveis: price_consultaveis ? mongoose.Types.Decimal128.fromString(String(price_consultaveis)) : null,
      price_tracks: price_tracks ? mongoose.Types.Decimal128.fromString(String(price_tracks)) : null,
      owner_id: req.user.id,
      source: 'custom',
    });

    res.status(201).json({ bin: binDoc });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'BIN já cadastrada para este tenant' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:binId', sanitizeInputs, async (req, res) => {
  try {
    const binDoc = await Bin.findOne({ _id: req.params.binId, owner_id: req.user.id });
    if (!binDoc) return res.status(404).json({ message: 'BIN não encontrada' });

    const allowed = ['brand', 'type', 'level', 'country', 'price', 'price_sem', 'price_consultaveis', 'price_tracks'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key.startsWith('price')) {
          binDoc[key] = req.body[key] ? mongoose.Types.Decimal128.fromString(String(req.body[key])) : null;
        } else {
          binDoc[key] = req.body[key];
        }
      }
    }
    await binDoc.save();
    res.json({ bin: binDoc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:binId', async (req, res) => {
  try {
    const result = await Bin.findOneAndDelete({ _id: req.params.binId, owner_id: req.user.id });
    if (!result) return res.status(404).json({ message: 'BIN não encontrada' });
    res.json({ message: 'BIN removida' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/import', sanitizeInputs, async (req, res) => {
  try {
    const { bins } = req.body;
    if (!Array.isArray(bins) || bins.length === 0) return res.status(400).json({ message: 'Lista de bins obrigatória' });

    let created = 0;
    let skipped = 0;
    for (const b of bins.slice(0, 500)) {
      try {
        await Bin.create({
          bin: b.bin, brand: b.brand || 'OTHER', price: mongoose.Types.Decimal128.fromString(String(b.price || 0)),
          country: b.country || 'BR', owner_id: req.user.id, source: 'custom',
        });
        created++;
      } catch { skipped++; }
    }

    res.status(201).json({ created, skipped });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/lookup/:bin', async (req, res) => {
  try {
    const result = await Bin.getPriceForBin(req.params.bin, req.user.id);
    if (!result) return res.status(404).json({ message: 'BIN não encontrada' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
