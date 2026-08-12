'use strict';

const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { SubscriptionPlan, User, Subscription } = require('../../database/schemas');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { sanitizeInputs } = require('../middleware/sanitize');
const config = require('../config');

// ─── GET /plans — list available plans (public) ───────────────────────────────

router.get('/plans', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ active: true })
      .sort({ display_order: 1 })
      .lean();

    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /create — register new owner + create subscription ─────────────────

router.post('/create', authLimiter, sanitizeInputs, async (req, res) => {
  try {
    const { planId, planType, username, password, telegram_username } = req.body;

    // Validate required inputs
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'username e password sao obrigatorios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Senha deve ter no minimo 6 caracteres' });
    }

    if (!planId && !planType) {
      return res.status(400).json({ success: false, message: 'planId ou planType e obrigatorio' });
    }

    // Resolve plan
    let plan;
    if (planId) {
      plan = await SubscriptionPlan.findById(planId);
    } else {
      plan = await SubscriptionPlan.findOne({ slug: planType.toLowerCase(), active: true });
    }

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plano nao encontrado ou inativo' });
    }

    // Check if username already exists
    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username ja esta em uso' });
    }

    // Create user with admin role
    const user = await User.create({
      username: username.toLowerCase(),
      password,
      role: 'admin',
      isAdmin: true,
      telegram_username: telegram_username || null,
    });

    // Calculate expiration based on plan duration
    const durationDays = plan.duration_days || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // Create subscription
    const subscription = await Subscription.create({
      tenant_id: user._id,
      plan: plan.slug,
      price: plan.price,
      maxBots: plan.maxBots,
      status: 'active',
      started_at: new Date(),
      expires_at: expiresAt,
      payment_method: 'manual',
    });

    // Issue a JWT so the new owner can log in immediately
    const token = jwt.sign(
      { id: user._id, role: user.role, owner_id: null, is_super_admin: false },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: config.jwtExpiresIn }
    );

    res.status(201).json({
      success: true,
      message: 'Assinatura criada',
      userId: user._id,
      token,
      subscription: {
        id: subscription._id,
        plan: subscription.plan,
        expires_at: subscription.expires_at,
        maxBots: subscription.maxBots,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Username ja esta em uso' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /my-subscription — current user's subscription (authenticated) ──────

router.get('/my-subscription', authenticate, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      tenant_id: req.user.id,
      status: 'active',
    }).lean();

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Nenhuma assinatura ativa encontrada' });
    }

    // Attach plan details if available
    let planDetails = null;
    try {
      planDetails = await SubscriptionPlan.findOne({ slug: subscription.plan }).lean();
    } catch (_) { /* plan catalog is optional */ }

    res.json({
      success: true,
      subscription: {
        ...subscription,
        plan_details: planDetails,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
