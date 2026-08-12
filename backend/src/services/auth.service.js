'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { User, Order, Activity } = require('../../database/schemas');

class AuthService {
  _generateToken(user) {
    return jwt.sign(
      { id: user._id, role: user.role, owner_id: user.owner_id, is_super_admin: user.is_super_admin },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: config.jwtExpiresIn }
    );
  }

  _generateRefreshToken(user) {
    return jwt.sign(
      { id: user._id, type: 'refresh' },
      config.jwtRefreshSecret,
      { algorithm: 'HS256', expiresIn: config.jwtRefreshExpiresIn }
    );
  }

  async register(userData) {
    const { username, email, password, name, telegramId, owner_id, bot_id } = userData;

    if (!username || !password) {
      const err = new Error('Username e senha sao obrigatorios.');
      err.statusCode = 400;
      throw err;
    }

    if (password.length < 6) {
      const err = new Error('Senha deve ter no minimo 6 caracteres.');
      err.statusCode = 400;
      throw err;
    }

    const existing = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        ...(email ? [{ email: email.toLowerCase() }] : []),
      ],
    });

    if (existing) {
      const err = new Error('Username ou email ja esta em uso.');
      err.statusCode = 409;
      throw err;
    }

    const user = await User.create({
      username: username.toLowerCase(),
      password,
      owner_id: owner_id || null,
      bot_id: bot_id || null,
      telegram_id: telegramId || null,
      role: 'user',
    });

    const token = this._generateToken(user);
    const refreshToken = this._generateRefreshToken(user);

    Activity.log?.({
      type: 'auth_register',
      userId: user._id,
      ip: userData.ip,
      details: { username: user.username },
    }).catch(() => {});

    return {
      user: user.toSafeObject(),
      token,
      refreshToken,
    };
  }

  async login(identifier, password) {
    if (!identifier || !password) {
      const err = new Error('Credenciais sao obrigatorias.');
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findOne({
      $or: [
        { username: identifier.toLowerCase() },
        { email: identifier.toLowerCase() },
      ],
    }).select('+password');

    // Prevencao de timing attack: sempre faz bcrypt.compare
    if (!user) {
      await bcrypt.compare(password, '$2a$12$invalidhashpaddingtopreventsideeffects');
      const err = new Error('Credenciais invalidas.');
      err.statusCode = 401;
      throw err;
    }

    if (user.banned) {
      const err = new Error('Conta banida.');
      err.statusCode = 403;
      err.code = 'CONTA_BANIDA';
      err.reason = user.ban_reason;
      throw err;
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      const err = new Error('Credenciais invalidas.');
      err.statusCode = 401;
      throw err;
    }

    const token = this._generateToken(user);
    const refreshToken = this._generateRefreshToken(user);

    Activity.log?.({
      type: 'auth_login',
      userId: user._id,
      details: { username: user.username },
    }).catch(() => {});

    return {
      user: user.toSafeObject(),
      token,
      refreshToken,
    };
  }

  async changePassword(userId, oldPass, newPass) {
    if (!oldPass || !newPass) {
      const err = new Error('Senha atual e nova senha sao obrigatorias.');
      err.statusCode = 400;
      throw err;
    }

    if (newPass.length < 6) {
      const err = new Error('Nova senha deve ter no minimo 6 caracteres.');
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      const err = new Error('Usuario nao encontrado.');
      err.statusCode = 404;
      throw err;
    }

    const isValid = await user.comparePassword(oldPass);
    if (!isValid) {
      const err = new Error('Senha atual incorreta.');
      err.statusCode = 401;
      throw err;
    }

    user.password = newPass;
    await user.save();

    Activity.log?.({
      type: 'auth_password_change',
      userId: user._id,
    }).catch(() => {});

    return { success: true, message: 'Senha alterada com sucesso.' };
  }

  async getUserProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('Usuario nao encontrado.');
      err.statusCode = 404;
      throw err;
    }
    return user.toSafeObject();
  }

  async getUserStats(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('Usuario nao encontrado.');
      err.statusCode = 404;
      throw err;
    }

    const [orderStats] = await Order.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          totalSpent: { $sum: { $toDouble: '$price' } },
          lastPurchase: { $max: '$createdAt' },
        },
      },
    ]);

    return {
      balance: user.balance,
      totalRecharged: user.total_recharged,
      totalSpent: user.totalSpent,
      purchaseCount: user.purchaseCount,
      orderStats: orderStats || { totalPurchases: 0, totalSpent: 0, lastPurchase: null },
      memberSince: user.createdAt,
    };
  }

  async refreshToken(token) {
    if (!token) {
      const err = new Error('Refresh token e obrigatorio.');
      err.statusCode = 400;
      throw err;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtRefreshSecret, {
        algorithms: ['HS256', 'HS384', 'HS512'],
      });
    } catch (jwtErr) {
      const err = new Error(jwtErr.name === 'TokenExpiredError' ? 'Refresh token expirado.' : 'Refresh token invalido.');
      err.statusCode = 401;
      throw err;
    }

    if (!decoded || !decoded.id || decoded.type !== 'refresh') {
      const err = new Error('Refresh token invalido.');
      err.statusCode = 401;
      throw err;
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      const err = new Error('Usuario nao encontrado.');
      err.statusCode = 404;
      throw err;
    }

    if (user.banned) {
      const err = new Error('Conta banida.');
      err.statusCode = 403;
      throw err;
    }

    return {
      token: this._generateToken(user),
      refreshToken: this._generateRefreshToken(user),
    };
  }

  async validateToken(token) {
    if (!token) {
      return { valid: false, payload: null };
    }
    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256', 'HS384', 'HS512'],
      });
      return { valid: true, payload: decoded };
    } catch {
      return { valid: false, payload: null };
    }
  }
}

module.exports = new AuthService();
