'use strict';

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { sanitizeInputs } = require('../middleware/sanitize');
const authService = require('../services/auth.service');

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function login(req, res, next) {
  try {
    const { username, email, password } = req.body;
    const result = await authService.login(username || email, password);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const result = await authService.register({
      ...req.body,
      ip: req.ip,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getUserProfile(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

async function getUserStats(req, res, next) {
  try {
    const stats = await authService.getUserStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;
    const result = await authService.refreshToken(token);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Definicao das rotas
// ---------------------------------------------------------------------------

router.post('/login', authLimiter, sanitizeInputs, login);
router.post('/register', authLimiter, sanitizeInputs, register);

router.post('/change-password', authenticate, sanitizeInputs, changePassword);
router.put('/change-password', authenticate, sanitizeInputs, changePassword);
router.get('/me', authenticate, getMe);
router.get('/validate', authenticate, getMe);
router.get('/profile', authenticate, getMe);
router.get('/user-stats', authenticate, getUserStats);

router.post('/refresh-token', sanitizeInputs, refreshToken);
router.post('/refresh', sanitizeInputs, refreshToken);
router.post('/logout', (_req, res) => res.json({ success: true }));

module.exports = router;
