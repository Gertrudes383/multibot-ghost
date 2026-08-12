/**
 * Middleware de controle de acesso baseado em roles (RBAC)
 *
 * Hierarquia de roles (mais privilegiada para menos):
 *   super_admin > admin > assistant > user
 *
 * Tres funcoes exportadas:
 *   - requireAdmin       : permite 'admin' e 'super_admin'
 *   - requireSuperAdmin  : permite somente 'super_admin'
 *   - requireAssistant   : permite 'assistant', 'admin' e 'super_admin'
 *
 * Pre-requisito: o middleware authenticate() ja deve ter executado
 *                e preenchido req.user com o payload do JWT (incluindo .role).
 *
 * Uso nas rotas:
 *   router.get('/admin/dashboard', authenticate, requireAdmin, handler);
 *   router.delete('/admin/users/:id', authenticate, requireSuperAdmin, handler);
 *   router.get('/panel/bots', authenticate, requireAssistant, handler);
 */

'use strict';

// Roles reconhecidas pela aplicacao — usadas para validacao interna
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  ASSISTANT: 'assistant',
  USER: 'user',
};

/**
 * Fabrica generica de middleware de autorizacao por role.
 * Recebe um array de roles permitidas e retorna o middleware.
 *
 * @param {string[]} rolesPermitidas — lista de roles que podem prosseguir
 * @param {string}   nomeRegra      — identificador legivel para logs
 * @returns {import('express').RequestHandler}
 */
function criarMiddlewareRole(rolesPermitidas, nomeRegra) {
  return function (req, res, next) {
    // Garante que o middleware de autenticacao foi executado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'NAO_AUTENTICADO',
        message: 'Usuario nao autenticado. Execute o middleware de autenticacao antes do controle de role.',
      });
    }

    const roleUsuario = req.user.role;

    // Verifica se o usuario possui uma role definida
    if (!roleUsuario) {
      console.warn(
        `[roleAuth] Usuario ${req.user.id} sem role definida — acesso negado (regra: ${nomeRegra})`
      );
      return res.status(403).json({
        success: false,
        error: 'ROLE_INDEFINIDA',
        message: 'Sua conta nao possui um nivel de acesso definido. Contate o administrador.',
      });
    }

    // Verifica se a role do usuario esta na lista de roles permitidas
    if (!rolesPermitidas.includes(roleUsuario)) {
      console.warn(
        `[roleAuth] ACESSO NEGADO — Usuario ${req.user.id} (role: ${roleUsuario}) ` +
        `tentou acessar recurso restrito a [${rolesPermitidas.join(', ')}] (regra: ${nomeRegra})`
      );
      return res.status(403).json({
        success: false,
        error: 'ACESSO_NEGADO',
        message: `Permissao insuficiente. Este recurso requer uma das seguintes roles: ${rolesPermitidas.join(', ')}.`,
        requiredRoles: rolesPermitidas,
        currentRole: roleUsuario,
      });
    }

    // Role autorizada — prosseguir
    return next();
  };
}

// --- Middlewares exportados ---

/**
 * Permite acesso a administradores e super administradores.
 * Roles aceitas: admin, super_admin
 */
const requireAdmin = criarMiddlewareRole(
  [ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'requireAdmin'
);

/**
 * Permite acesso exclusivo a super administradores.
 * Roles aceitas: super_admin
 */
const requireSuperAdmin = criarMiddlewareRole(
  [ROLES.SUPER_ADMIN],
  'requireSuperAdmin'
);

/**
 * Permite acesso a assistentes, administradores e super administradores.
 * Roles aceitas: assistant, admin, super_admin
 */
const requireAssistant = criarMiddlewareRole(
  [ROLES.ASSISTANT, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'requireAssistant'
);

module.exports = {
  requireAdmin,
  requireSuperAdmin,
  requireAssistant,
  ROLES,
};
