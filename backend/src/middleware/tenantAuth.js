/**
 * Middleware de autorizacao por tenant (CORRECAO CRITICA — VULN-006)
 *
 * Problema original (VULN-006):
 *   Qualquer usuario autenticado podia manipular bots de outros usuarios
 *   enviando um bot_id arbitrario nos parametros, query, body ou header.
 *   Nao havia verificacao de propriedade — apenas autenticacao.
 *
 * Correcao:
 *   Apos o middleware de autenticacao (auth.js) preencher req.user,
 *   este middleware:
 *     1. Extrai o bot_id da requisicao (params, query, body, header)
 *     2. Consulta o model Bot no banco para obter o owner_id
 *     3. Compara owner_id com req.user.id
 *     4. Super admins (role === 'super_admin') ignoram a verificacao
 *     5. Rejeita com 403 caso o bot nao pertenca ao usuario
 *
 * Uso nas rotas:
 *   router.put('/bots/:bot_id', authenticate, tenantAuth, handler);
 */

'use strict';

const { Bot } = require('../../../database/schemas');

/**
 * Lista de campos (em ordem de prioridade) onde o bot_id pode estar.
 * O primeiro valor nao-nulo encontrado e utilizado.
 */
const CAMPOS_BOT_ID = ['bot_id', 'botId'];

/**
 * Extrai o bot_id da requisicao percorrendo todas as fontes possiveis.
 *
 * Ordem de precedencia:
 *   1. req.params  (rota: /bots/:bot_id)
 *   2. req.query   (?bot_id=xxx ou ?botId=xxx)
 *   3. req.body    ({ bot_id: "xxx" } ou { botId: "xxx" })
 *   4. Header      X-Bot-Id
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extrairBotId(req) {
  // 1. Parametros de rota
  for (const campo of CAMPOS_BOT_ID) {
    if (req.params && req.params[campo]) {
      return String(req.params[campo]);
    }
  }

  // 2. Query string
  for (const campo of CAMPOS_BOT_ID) {
    if (req.query && req.query[campo]) {
      return String(req.query[campo]);
    }
  }

  // 3. Corpo da requisicao
  for (const campo of CAMPOS_BOT_ID) {
    if (req.body && req.body[campo]) {
      return String(req.body[campo]);
    }
  }

  // 4. Header customizado
  const headerBotId = req.headers['x-bot-id'];
  if (headerBotId) {
    return String(headerBotId);
  }

  return null;
}

/**
 * Middleware de autorizacao por tenant.
 *
 * Pré-requisito: authenticate() ja deve ter executado e preenchido req.user.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function tenantAuth(req, res, next) {
  try {
    // Garante que o middleware de autenticacao foi executado antes
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'NAO_AUTENTICADO',
        message: 'Usuario nao autenticado. O middleware de autenticacao deve executar antes do tenantAuth.',
      });
    }

    // Super admins podem acessar qualquer recurso — bypass total
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Extrai o bot_id da requisicao
    const botId = extrairBotId(req);

    // Se nao ha bot_id na requisicao, nada a verificar — delega ao handler
    if (!botId) {
      return next();
    }

    // Validacao basica do formato do ID (previne injection no query)
    if (typeof botId !== 'string' || botId.length === 0 || botId.length > 128) {
      return res.status(400).json({
        success: false,
        error: 'BOT_ID_INVALIDO',
        message: 'O identificador do bot fornecido possui formato invalido.',
      });
    }

    // Consulta o bot no banco de dados
    let bot;
    try {
      bot = await Bot.findById(botId).lean();
    } catch (dbError) {
      // Se o model ainda nao existe ou o banco esta indisponivel,
      // logar e negar acesso por seguranca (fail-closed)
      console.error('[tenantAuth] Erro ao consultar Bot no banco:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'ERRO_VERIFICACAO_TENANT',
        message: 'Erro interno ao verificar a propriedade do recurso.',
      });
    }

    // Bot nao encontrado
    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'BOT_NAO_ENCONTRADO',
        message: 'O bot especificado nao foi encontrado.',
      });
    }

    // --- Verificacao central de propriedade (CORRECAO VULN-006) ---
    // Compara o owner_id do bot com o id do usuario autenticado.
    // Usa String() para garantir comparacao consistente (ObjectId vs string).
    const ownerIdBot = String(bot.owner_id);
    const userIdReq  = String(req.user.id);

    if (ownerIdBot !== userIdReq) {
      // Log de tentativa de acesso nao autorizado para auditoria
      console.warn(
        `[tenantAuth] ACESSO NEGADO — Usuario ${userIdReq} tentou acessar bot ${botId} pertencente ao usuario ${ownerIdBot}`
      );

      return res.status(403).json({
        success: false,
        error: 'ACESSO_NEGADO',
        message: 'Voce nao tem permissao para acessar este recurso. O bot nao pertence a sua conta.',
      });
    }

    // Proprietario confirmado — anexa o bot na requisicao para evitar consulta duplicada
    req.bot = bot;

    return next();
  } catch (err) {
    console.error('[tenantAuth] Erro inesperado:', err);
    return res.status(500).json({
      success: false,
      error: 'ERRO_VERIFICACAO_TENANT',
      message: 'Erro interno ao verificar autorizacao de tenant.',
    });
  }
}

module.exports = { tenantAuth };
