'use strict';

const router = require('express').Router();
const { generalLimiter } = require('../middleware/rateLimiter');
const { Bot } = require('../../database/schemas');

router.use(generalLimiter);

router.get('/status', async (req, res) => {
  try {
    const botManager = req.app.get('botManager');
    res.json({
      status: 'online',
      version: '1.0.0',
      activeBots: botManager ? botManager.getRunningCount() : 0,
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/plans', async (req, res) => {
  res.json({
    plans: [
      {
        id: 'basic',
        name: 'Básico',
        price: 300,
        features: [
          '1 Bot Telegram',
          'Até 500 usuários',
          'PIX Automático',
          'Suporte via Telegram',
        ],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 400,
        features: [
          '3 Bots Telegram',
          'Usuários ilimitados',
          'PIX + Crypto',
          'API de fornecedor',
          'Suporte prioritário',
        ],
      },
    ],
  });
});

router.get('/faq', async (req, res) => {
  res.json({
    faq: [
      {
        question: 'Como criar meu primeiro bot?',
        answer: 'Acesse o painel admin, vá em Telegram > Bots e clique em "Novo Bot". Cole o token do BotFather.',
      },
      {
        question: 'Quais métodos de pagamento são aceitos?',
        answer: 'PIX automático (PrimePix/EasyPIX), criptomoedas (Bitcoin, Ethereum, USDT, etc.) e transferência manual.',
      },
      {
        question: 'Como funciona o sistema multi-tenant?',
        answer: 'Cada bot opera de forma independente com seus próprios usuários, estoque e configurações.',
      },
    ],
  });
});

module.exports = router;
