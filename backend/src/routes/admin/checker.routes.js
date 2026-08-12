'use strict';

const router = require('express').Router();
const { CheckerSetting } = require('../../../database/schemas');
const checkerService = require('../../services/checker.service');
const { validateCheckerUrl } = require('../../middleware/urlValidator');
const { sanitizeInputs } = require('../../middleware/sanitize');

router.get('/status', async (req, res) => {
  try {
    const status = await checkerService.getCheckerStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/gateways', async (req, res) => {
  try {
    const { botId } = req.query;
    const gateways = await checkerService.getAvailableGateways(req.user.id, botId);
    res.json({ gateways });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/gateways', sanitizeInputs, validateCheckerUrl, async (req, res) => {
  try {
    const { botId, url, method = 'GET', successKeyword = 'LIVE', failKeyword = 'DEAD' } = req.body;
    if (!botId) return res.status(400).json({ message: 'botId obrigatório' });

    const settings = await CheckerSetting.findOneAndUpdate(
      { owner_id: req.user.id, bot_id: botId },
      {
        owner_id: req.user.id, bot_id: botId,
        api_url: req.validatedUrl.original,
        method, success_keyword: successKeyword, fail_keyword: failKeyword,
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/gateways/:gatewayId', sanitizeInputs, validateCheckerUrl, async (req, res) => {
  try {
    const { botId, method, successKeyword, failKeyword, maxThreads, timeout } = req.body;
    const updates = {};
    if (req.validatedUrl) updates.api_url = req.validatedUrl.original;
    if (method) updates.method = method;
    if (successKeyword) updates.success_keyword = successKeyword;
    if (failKeyword) updates.fail_keyword = failKeyword;
    if (maxThreads) updates.max_threads_per_user = maxThreads;
    if (timeout) updates.timeout = timeout;

    const settings = await CheckerSetting.findOneAndUpdate(
      { owner_id: req.user.id, bot_id: botId },
      updates,
      { new: true }
    );

    if (!settings) return res.status(404).json({ message: 'Configuração não encontrada' });
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/gateways/:gatewayId', async (req, res) => {
  try {
    const { botId } = req.query;
    await CheckerSetting.findOneAndDelete({ owner_id: req.user.id, bot_id: botId });
    res.json({ message: 'Gateway removido' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/test', sanitizeInputs, async (req, res) => {
  try {
    const { card, botId } = req.body;
    if (!card || !card.number) return res.status(400).json({ message: 'Dados do card obrigatórios' });

    const result = await checkerService.checkCard(card, 'default', req.user.id, botId);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.get('/sessions', async (req, res) => {
  try {
    const { botId } = req.query;
    const { ValidationLog } = require('../../../database/schemas');
    const sessions = await ValidationLog.find({ bot_id: botId })
      .sort({ createdAt: -1 }).limit(50).lean();
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { ValidationLog } = require('../../../database/schemas');
    const session = await ValidationLog.findById(req.params.sessionId).lean();
    if (!session) return res.status(404).json({ message: 'Sessão não encontrada' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
