/**
 * Roteador principal do módulo Admin.
 *
 * Monta todas as sub-rotas administrativas sob o prefixo /admin.
 * Todas as rotas admin requerem autenticação + role admin no mínimo.
 * O middleware de autenticação e role é aplicado globalmente aqui
 * para evitar repetição em cada sub-roteador.
 */

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/roleAuth');
const { adminLimiter } = require('../../middleware/rateLimiter');

// Middlewares globais para todas as rotas admin
router.use(authenticate);
router.use(requireAdmin);
router.use(adminLimiter);

// ============================================================
// Sub-rotas administrativas
// ============================================================

/** Dashboard — visão geral e estatísticas */
router.use('/dashboard', require('./dashboard.routes'));

/** Gestão de Usuários */
router.use('/users', require('./users.routes'));

/** Gestão de Cards */
router.use('/cards', require('./cards.routes'));

/** Gestão de Lotes (Batches) */
router.use('/batches', require('./batches.routes'));

/** Configuração de BINs */
router.use('/bins', require('./bins.routes'));

/** Configuração do Checker */
router.use('/checker', require('./checker.routes'));

/** Gestão do Telegram (bots, usuários, pedidos, recargas, etc.) */
router.use('/telegram', require('./telegram.routes'));

/** Configuração de Pagamentos (PIX, crypto, manual, gateways) */
router.use('/payments', require('./payments.routes'));

/** Configurações Gerais (site, registro, regras, segurança, etc.) */
router.use('/settings', require('./settings.routes'));

/** Promoções */
router.use('/promotions', require('./promotions.routes'));

/** Programa de Referência / Afiliados */
router.use('/referral', require('./referral.routes'));

/** APIs Externas */
router.use('/external-api', require('./external-api.routes'));

/** Sistema — status, uptime, uploads, logs de validação */
router.use('/system', require('./system.routes'));

module.exports = router;
