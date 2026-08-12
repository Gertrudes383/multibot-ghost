'use strict';

const axios = require('axios');
const mongoose = require('mongoose');
const { ExternalSupplier, Card, Batch } = require('../../database/schemas');
const cardService = require('./card.service');

const DEFAULT_API_URL = process.env.SUPPLIER_API_URL || 'http://ghost-multibot-api:3003';

class SupplierService {
  async fetchCards(filters = {}) {
    const { botId, bin, country, brand, level, maxPrice, limit = 100 } = filters;

    let supplier = null;
    if (botId) {
      supplier = await ExternalSupplier.getActiveForBot(botId);
    }

    const baseUrl = supplier ? supplier.base_url : DEFAULT_API_URL;
    const catalogPath = supplier ? supplier.catalog_path : '/catalog';
    const headers = supplier ? supplier.getAuthHeaders() : {};
    const timeout = supplier ? supplier.timeout_ms : 15000;

    const params = { view: 'summary', limit };
    if (bin) params.bin = bin;
    if (country) params.country = country;
    if (brand) params.brand = brand;
    if (level) params.level = level;
    if (maxPrice) params.maxPrice = maxPrice;

    try {
      const response = await axios.get(`${baseUrl}${catalogPath}`, {
        headers,
        params,
        timeout,
      });

      const cards = response.data?.cards || response.data || [];
      return {
        cards: Array.isArray(cards) ? cards.slice(0, limit) : [],
        total: response.data?.total || cards.length,
        supplier: supplier ? 'custom' : 'default',
      };
    } catch (err) {
      const error = new Error(`Falha ao buscar cards do fornecedor: ${err.message}`);
      error.statusCode = 502;
      throw error;
    }
  }

  async syncInventory(botId) {
    const supplier = await ExternalSupplier.getActiveForBot(botId);
    const baseUrl = supplier ? supplier.base_url : DEFAULT_API_URL;
    const catalogPath = supplier ? supplier.catalog_path : '/catalog';
    const headers = supplier ? supplier.getAuthHeaders() : {};
    const timeout = supplier ? supplier.timeout_ms : 30000;

    let response;
    try {
      response = await axios.get(`${baseUrl}${catalogPath}`, {
        headers,
        params: { view: 'units' },
        timeout,
      });
    } catch (err) {
      const error = new Error(`Falha ao sincronizar: ${err.message}`);
      error.statusCode = 502;
      throw error;
    }

    const remoteCards = response.data?.cards || response.data || [];
    if (!Array.isArray(remoteCards) || remoteCards.length === 0) {
      return { imported: 0, updated: 0, removed: 0, errors: 0, syncedAt: new Date() };
    }

    const ownerId = supplier ? supplier.owner_id : null;
    const cardsToImport = remoteCards.map((c) => ({
      number: c.number || c.cc,
      bin: (c.number || c.cc || '').substring(0, 6),
      brand: c.brand || 'OTHER',
      type: c.type || 'CREDIT',
      level: c.level || 'STANDARD',
      country: c.country || 'BR',
      exp_month: c.exp_month || c.mes,
      exp_year: c.exp_year || c.ano,
      cvv: c.cvv,
      price: c.price || 0,
    }));

    try {
      const result = await cardService.uploadCards(
        ownerId ? String(ownerId) : null,
        botId,
        cardsToImport,
        { name: `Sync ${new Date().toISOString().slice(0, 10)}`, source: 'supplier' }
      );

      return {
        imported: result.uploaded || cardsToImport.length,
        updated: 0,
        removed: 0,
        errors: result.duplicates || 0,
        syncedAt: new Date(),
      };
    } catch (err) {
      const error = new Error(`Falha ao importar cards: ${err.message}`);
      error.statusCode = 500;
      throw error;
    }
  }

  async processSupplierCallback(callbackData) {
    const { event, supplier: supplierName, data } = callbackData;

    if (!event || !data) {
      return { processed: false, event: null, action: 'invalid_payload' };
    }

    switch (event) {
      case 'new_cards': {
        if (!Array.isArray(data.cards) || data.cards.length === 0) {
          return { processed: false, event, action: 'no_cards' };
        }
        return { processed: true, event, action: 'cards_queued' };
      }

      case 'price_update': {
        return { processed: true, event, action: 'prices_updated' };
      }

      case 'stock_out': {
        return { processed: true, event, action: 'stock_alert' };
      }

      default:
        return { processed: false, event, action: 'unknown_event' };
    }
  }

  async getSupplierStatus(botId) {
    const results = [];

    const supplier = botId ? await ExternalSupplier.getActiveForBot(botId) : null;
    const baseUrl = supplier ? supplier.base_url : DEFAULT_API_URL;
    const statusPath = supplier ? supplier.status_path : '/status';
    const headers = supplier ? supplier.getAuthHeaders() : {};

    try {
      const response = await axios.get(`${baseUrl}${statusPath}`, {
        headers,
        timeout: 5000,
      });

      results.push({
        supplier: supplier ? 'custom' : 'Api-MultiBot-Ghost',
        status: 'online',
        cardsAvailable: response.data?.cardsAvailable || response.data?.total || 0,
        lastSync: response.data?.lastSync || null,
        avgPrice: response.data?.avgPrice || 0,
      });
    } catch {
      results.push({
        supplier: supplier ? 'custom' : 'Api-MultiBot-Ghost',
        status: 'offline',
        cardsAvailable: 0,
        lastSync: null,
        avgPrice: 0,
      });
    }

    return results;
  }
}

module.exports = new SupplierService();
