'use strict';

const os = require('os');
const router = require('express').Router();
const mongoose = require('mongoose');
const { ValidationLog, Setting } = require('../../../database/schemas');
const { createUploadMiddleware, processImage } = require('../../middleware/uploadHandler');
const { sanitizeInputs } = require('../../middleware/sanitize');

// ─── STATUS ───

router.get('/status', async (req, res) => {
  try {
    const botManager = req.app.get('botManager');
    const dbState = mongoose.connection.readyState;
    const dbStateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

    let bots = [];
    if (botManager && typeof botManager.getAllStatuses === 'function') {
      bots = botManager.getAllStatuses();
    } else if (botManager && typeof botManager.getBotStatus === 'function') {
      // Fallback: no summary method available
      bots = [];
    }

    res.json({
      db: {
        status: dbStateMap[dbState] || 'unknown',
        readyState: dbState,
      },
      bots,
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── UPTIME ───

router.get('/uptime', (_req, res) => {
  res.json({
    processUptime: process.uptime(),
    osUptime: os.uptime(),
    loadAvg: os.loadavg(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    platform: os.platform(),
    hostname: os.hostname(),
  });
});

// ─── UPLOAD LOGO ───

router.post(
  '/upload-logo',
  createUploadMiddleware('logo', 1),
  processImage,
  async (req, res) => {
    try {
      if (!req.processedFile) return res.status(400).json({ message: 'Nenhum arquivo enviado' });

      const ownerId = req.user.id;
      const botId = req.body.botId || null;
      const fileUrl = `/uploads/${req.processedFile.filename}`;

      await Setting.setValue('logo_url', fileUrl, ownerId, botId);

      res.json({ message: 'Logo enviado com sucesso', url: fileUrl, file: req.processedFile });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// ─── UPLOAD HEADER LOGO ───

router.post(
  '/upload-header-logo',
  createUploadMiddleware('header_logo', 1),
  processImage,
  async (req, res) => {
    try {
      if (!req.processedFile) return res.status(400).json({ message: 'Nenhum arquivo enviado' });

      const ownerId = req.user.id;
      const botId = req.body.botId || null;
      const fileUrl = `/uploads/${req.processedFile.filename}`;

      await Setting.setValue('header_logo_url', fileUrl, ownerId, botId);

      res.json({ message: 'Header logo enviado com sucesso', url: fileUrl, file: req.processedFile });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// ─── PURCHASE VALIDATION LOGS ───

router.get('/purchase-validation-logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, botId, userId, status, startDate, endDate } = req.query;
    const lim = Math.min(100, parseInt(limit, 10));
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * lim;

    // ValidationLog uses botId/userId (camelCase) per schema
    const query = {};
    if (botId) query.botId = botId;
    if (userId) query.userId = userId;
    if (status) query.validationStatus = status;
    if (startDate || endDate) {
      query.attemptedAt = {};
      if (startDate) query.attemptedAt.$gte = new Date(startDate);
      if (endDate) query.attemptedAt.$lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      ValidationLog.find(query)
        .sort({ attemptedAt: -1 })
        .skip(skip)
        .limit(lim)
        .select('-cardNumber')
        .lean(),
      ValidationLog.countDocuments(query),
    ]);

    res.json({ logs, total, page: parseInt(page, 10), totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PURCHASE VALIDATION LOGS EXPORT ───

router.get('/purchase-validation-logs/export', async (req, res) => {
  try {
    const { botId, userId, status, startDate, endDate } = req.query;

    const query = {};
    if (botId) query.botId = botId;
    if (userId) query.userId = userId;
    if (status) query.validationStatus = status;
    if (startDate || endDate) {
      query.attemptedAt = {};
      if (startDate) query.attemptedAt.$gte = new Date(startDate);
      if (endDate) query.attemptedAt.$lte = new Date(endDate);
    }

    const logs = await ValidationLog.find(query)
      .sort({ attemptedAt: -1 })
      .limit(10000)
      .select('-cardNumber')
      .lean();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="validation-logs.json"');
    res.json({ exported: logs.length, logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── BONUS VISIBILITY ───

router.post('/bonus-visibility', sanitizeInputs, async (req, res) => {
  try {
    const { visible, botId } = req.body;
    if (visible === undefined) return res.status(400).json({ message: 'visible é obrigatório' });

    const ownerId = req.user.id;
    await Setting.setValue('bonus_visible', Boolean(visible), ownerId, botId || null);

    res.json({ message: 'Visibilidade do bônus atualizada', bonusVisible: Boolean(visible) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
