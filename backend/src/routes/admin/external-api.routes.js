'use strict';

const router = require('express').Router();
const axios = require('axios');
const { ExternalSupplier } = require('../../../database/schemas');
const { maskObjectSecrets } = require('../../utils/secretMasker');
const { sanitizeInputs } = require('../../middleware/sanitize');
const supplierService = require('../../services/supplier.service');

router.get('/', async (req, res) => {
  try {
    const suppliers = await ExternalSupplier.find({ owner_id: req.user.id }).lean();
    res.json({ apis: suppliers.map((s) => maskObjectSecrets(s)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', sanitizeInputs, async (req, res) => {
  try {
    const { botId, base_url, credential_header, credential_scheme, credential_value, timeout_ms } = req.body;
    if (!botId || !base_url || !credential_value) {
      return res.status(400).json({ message: 'botId, base_url e credential_value obrigatórios' });
    }

    const supplier = await ExternalSupplier.create({
      bot_id: botId,
      owner_id: req.user.id,
      base_url,
      credential_header: credential_header || 'Authorization',
      credential_scheme: credential_scheme || 'Bearer',
      credential_value,
      timeout_ms: timeout_ms || 15000,
    });

    res.status(201).json({ api: maskObjectSecrets(supplier.toObject()) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Já existe fornecedor para este bot' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:apiId', sanitizeInputs, async (req, res) => {
  try {
    const supplier = await ExternalSupplier.findOne({ _id: req.params.apiId, owner_id: req.user.id })
      .select('+credential_value');
    if (!supplier) return res.status(404).json({ message: 'API não encontrada' });

    const allowed = ['base_url', 'credential_header', 'credential_scheme', 'credential_value',
      'timeout_ms', 'catalog_path', 'reserve_path', 'order_path', 'status_path', 'active'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) supplier[key] = req.body[key];
    }
    await supplier.save();
    res.json({ api: maskObjectSecrets(supplier.toObject()) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:apiId', async (req, res) => {
  try {
    const result = await ExternalSupplier.findOneAndDelete({ _id: req.params.apiId, owner_id: req.user.id });
    if (!result) return res.status(404).json({ message: 'API não encontrada' });
    res.json({ message: 'API removida' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:apiId/test', async (req, res) => {
  try {
    const supplier = await ExternalSupplier.findOne({ _id: req.params.apiId, owner_id: req.user.id })
      .select('+credential_value');
    if (!supplier) return res.status(404).json({ message: 'API não encontrada' });

    const headers = supplier.getAuthHeaders();
    const start = Date.now();

    try {
      const response = await axios.get(`${supplier.base_url}${supplier.status_path}`, {
        headers,
        timeout: supplier.timeout_ms,
      });
      res.json({
        success: true,
        status: response.status,
        responseTime: Date.now() - start,
        data: response.data,
      });
    } catch (err) {
      res.json({
        success: false,
        status: err.response?.status || 0,
        responseTime: Date.now() - start,
        error: err.message,
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:apiId/logs', async (req, res) => {
  try {
    res.json({ logs: [], message: 'Logs de API em desenvolvimento' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
