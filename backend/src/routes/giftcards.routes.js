'use strict';

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { tenantAuth } = require('../middleware/tenantAuth');
const { generalLimiter } = require('../middleware/rateLimiter');
const { sanitizeInputs } = require('../middleware/sanitize');
const giftcardService = require('../services/giftcard.service');

router.use(authenticate);

router.post('/redeem', generalLimiter, sanitizeInputs, async (req, res) => {
  try {
    const { code, botId } = req.body;
    if (!code || !botId) return res.status(400).json({ message: 'code e botId obrigatórios' });

    const result = await giftcardService.redeemGiftcard(req.user.id, botId, code);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.get('/history', generalLimiter, async (req, res) => {
  try {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const history = await giftcardService.getGiftcardHistory(req.user.id, botId);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
