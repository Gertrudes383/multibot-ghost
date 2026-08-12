'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');
const { Promotion, Order } = require('../../../database/schemas');
const { sanitizeInputs } = require('../../middleware/sanitize');

router.get('/', async (req, res) => {
  try {
    const { botId, active } = req.query;
    const query = { owner_id: req.user.id };
    if (botId) query.bot_id = botId;
    if (active !== undefined) query.active = active === 'true';

    const promotions = await Promotion.find(query).sort({ createdAt: -1 }).lean();
    res.json({ promotions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', sanitizeInputs, async (req, res) => {
  try {
    const { botId, name, type, value, target_bins, target_levels, start_date, end_date } = req.body;
    if (!botId || !name || !type || value === undefined) {
      return res.status(400).json({ message: 'botId, name, type e value obrigatórios' });
    }

    const promo = await Promotion.create({
      bot_id: botId, owner_id: req.user.id,
      name, type, value,
      target_bins: target_bins || [],
      target_levels: target_levels || [],
      start_date: start_date || new Date(),
      end_date: end_date || null,
    });

    res.status(201).json({ promotion: promo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:promoId', sanitizeInputs, async (req, res) => {
  try {
    const promo = await Promotion.findOne({ _id: req.params.promoId, owner_id: req.user.id });
    if (!promo) return res.status(404).json({ message: 'Promoção não encontrada' });

    const allowed = ['name', 'type', 'value', 'target_bins', 'target_levels', 'start_date', 'end_date', 'active'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) promo[key] = req.body[key];
    }
    await promo.save();
    res.json({ promotion: promo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:promoId', async (req, res) => {
  try {
    const result = await Promotion.findOneAndDelete({ _id: req.params.promoId, owner_id: req.user.id });
    if (!result) return res.status(404).json({ message: 'Promoção não encontrada' });
    res.json({ message: 'Promoção removida' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:promoId/activate', async (req, res) => {
  try {
    const promo = await Promotion.findOneAndUpdate(
      { _id: req.params.promoId, owner_id: req.user.id },
      { active: true }, { new: true }
    );
    if (!promo) return res.status(404).json({ message: 'Promoção não encontrada' });
    res.json({ promotion: promo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:promoId/deactivate', async (req, res) => {
  try {
    const promo = await Promotion.findOneAndUpdate(
      { _id: req.params.promoId, owner_id: req.user.id },
      { active: false }, { new: true }
    );
    if (!promo) return res.status(404).json({ message: 'Promoção não encontrada' });
    res.json({ promotion: promo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:promoId/stats', async (req, res) => {
  try {
    const promo = await Promotion.findOne({ _id: req.params.promoId, owner_id: req.user.id }).lean();
    if (!promo) return res.status(404).json({ message: 'Promoção não encontrada' });

    res.json({
      promotion: promo,
      usageCount: 0,
      totalDiscount: 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
