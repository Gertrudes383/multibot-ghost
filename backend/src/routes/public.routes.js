'use strict';

const router = require('express').Router();
const { generalLimiter } = require('../middleware/rateLimiter');
const { Bot, Batch, Order, PixSetting } = require('../../database/schemas');

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

// Default bonus tiers used when no bot-specific setting is found
const DEFAULT_BONUS_TIERS = [
  { min_amount: 50,  max_amount: 99,   bonus_percentage: 5,  label: '5% bônus' },
  { min_amount: 100, max_amount: 199,  bonus_percentage: 10, label: '10% bônus' },
  { min_amount: 200, max_amount: 499,  bonus_percentage: 15, label: '15% bônus' },
  { min_amount: 500, max_amount: null, bonus_percentage: 20, label: '20% bônus' },
];

router.get('/bonus-info', async (req, res) => {
  try {
    const { bot_id } = req.query;
    let tiers = DEFAULT_BONUS_TIERS;

    if (bot_id) {
      const pixSetting = await PixSetting.findOne({ bot_id }).lean();
      if (pixSetting && Array.isArray(pixSetting.bonus_tiers) && pixSetting.bonus_tiers.length) {
        tiers = pixSetting.bonus_tiers;
      }
    }

    res.json({ bonus_tiers: tiers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/recent-batches', async (req, res) => {
  try {
    const batches = await Batch.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name totalCards availableCards createdAt')
      .lean();

    res.json({
      batches: batches.map((b) => ({
        name: b.name,
        card_count: b.totalCards,
        available: b.availableCards,
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/recent-purchases', async (req, res) => {
  try {
    const orders = await Order.find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('card.bin card.brand card.country price createdAt')
      .lean();

    res.json({
      purchases: orders.map((o) => {
        // Mask BIN: show first 4 digits and mask the rest
        const bin = o.card?.bin || '';
        const maskedBin = bin.length >= 6
          ? bin.slice(0, 4) + '**'
          : bin.slice(0, 2) + '****';

        return {
          bin: maskedBin,
          brand: o.card?.brand || null,
          country: o.card?.country || null,
          price: o.price,
          createdAt: o.createdAt,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/rules-settings', async (req, res) => {
  try {
    const { bot_id } = req.query;
    let rules = 'Ao utilizar este serviço você concorda com os termos e condições estabelecidos pelo administrador.';

    if (bot_id) {
      const bot = await Bot.findById(bot_id).select('terms_message').lean();
      if (bot && bot.terms_message) {
        rules = bot.terms_message;
      }
    }

    res.json({ rules });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
