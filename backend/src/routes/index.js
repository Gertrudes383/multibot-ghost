/**
 * Roteador raiz da API.
 *
 * Monta todos os módulos de rotas sob o prefixo /api (definido em app.js).
 * A organização segue a separação por domínio:
 *
 *   /api/auth/*         — Autenticação (login, registro, etc.)
 *   /api/cards/*        — Consulta e operações com cards (usuário)
 *   /api/purchases/*    — Compras de cards
 *   /api/recharges/*    — Recargas de saldo
 *   /api/giftcards/*    — Gift cards
 *   /api/admin/*        — Painel administrativo (requer role admin)
 *   /api/assistant/*    — Painel do assistente (requer role assistant+)
 *   /api/superadmin/*   — Operações de super admin
 *   /api/webhooks/*     — Callbacks de pagamento (PIX, crypto, supplier)
 *   /api/public/*       — Rotas públicas sem autenticação
 */

const router = require('express').Router();

// ============================================================
// Rotas públicas (sem autenticação)
// ============================================================

/** Rotas públicas — status, planos, FAQ */
router.use('/public', require('./public.routes'));

// ============================================================
// Autenticação
// ============================================================

/** Login, registro, troca de senha, perfil */
router.use('/auth', require('./auth.routes'));

// ============================================================
// Rotas de usuário autenticado
// ============================================================

/** Cards — listagem, filtros, países, gateways, check */
router.use('/cards', require('./cards.routes'));

/** Compras — purchase, async, auto-live, mix, histórico */
router.use('/purchases', require('./purchases.routes'));

/** Recargas — PIX, crypto, manual, histórico */
router.use('/recharges', require('./recharge.routes'));

/** Gift Cards — resgate, histórico */
router.use('/giftcards', require('./giftcards.routes'));

// ============================================================
// Rotas administrativas
// ============================================================

/** Painel Admin — todas as sub-rotas em /admin/* */
router.use('/admin', require('./admin'));

/** Painel Assistente — visão limitada do admin */
router.use('/assistant', require('./assistant.routes'));

/** Super Admin — gestão global de bots e owners */
router.use('/superadmin', require('./superadmin.routes'));

// ============================================================
// Webhooks (callbacks externos)
// ============================================================

/**
 * Webhooks de pagamento — VULN-003: Todos os webhooks agora
 * requerem verificação HMAC/secret antes de processar.
 */
router.use('/webhooks', require('./webhooks.routes'));

module.exports = router;
