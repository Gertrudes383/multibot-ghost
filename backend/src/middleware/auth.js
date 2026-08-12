/**
 * Middleware de autenticacao JWT
 *
 * Extrai o token do header Authorization (esquema Bearer),
 * verifica a assinatura com jsonwebtoken e anexa o payload
 * decodificado em req.user para uso nos middlewares seguintes.
 *
 * Tratamento de erros:
 *   - Token ausente      -> 401 (NAO_AUTENTICADO)
 *   - Token expirado     -> 401 (TOKEN_EXPIRADO)
 *   - Token invalido     -> 401 (TOKEN_INVALIDO)
 *   - Erro interno       -> 500 (ERRO_AUTENTICACAO)
 */

'use strict';

const jwt = require('jsonwebtoken');

// Segredo utilizado para assinar/verificar tokens.
// Em producao deve vir de variavel de ambiente; nunca hardcode.
const JWT_SECRET = process.env.JWT_SECRET || 'TROCAR_ESTE_SEGREDO_EM_PRODUCAO';

/**
 * Extrai o token Bearer do header Authorization.
 * Retorna null caso o header esteja ausente ou mal-formado.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extrairToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Formato esperado: "Bearer <token>"
  const partes = authHeader.split(' ');

  if (partes.length !== 2 || partes[0] !== 'Bearer') {
    return null;
  }

  return partes[1];
}

/**
 * Middleware principal de autenticacao.
 *
 * Fluxo:
 *   1. Extrai token do header Authorization
 *   2. Verifica assinatura e validade temporal
 *   3. Anexa payload decodificado em req.user
 *   4. Chama next() em caso de sucesso
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authenticate(req, res, next) {
  try {
    const token = extrairToken(req);

    // --- Token ausente ---
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'NAO_AUTENTICADO',
        message: 'Token de autenticacao nao fornecido. Envie o header Authorization: Bearer <token>.',
      });
    }

    // --- Verificacao e decodificacao ---
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256', 'HS384', 'HS512'], // Algoritmos permitidos — previne alg:none
      });
    } catch (jwtError) {
      // Token expirado
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'TOKEN_EXPIRADO',
          message: 'O token de autenticacao expirou. Faca login novamente para obter um novo token.',
          expiredAt: jwtError.expiredAt,
        });
      }

      // Token com assinatura invalida, formato corrompido, etc.
      if (
        jwtError.name === 'JsonWebTokenError' ||
        jwtError.name === 'NotBeforeError'
      ) {
        return res.status(401).json({
          success: false,
          error: 'TOKEN_INVALIDO',
          message: 'O token fornecido e invalido ou foi adulterado.',
        });
      }

      // Qualquer outro erro do jwt nao previsto
      throw jwtError;
    }

    // --- Validacao basica do payload ---
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_INVALIDO',
        message: 'O payload do token nao contem as informacoes necessarias (id do usuario).',
      });
    }

    // Anexa o usuario decodificado na requisicao para uso posterior
    req.user = decoded;

    return next();
  } catch (err) {
    // Erro inesperado — nao vazar detalhes internos ao cliente
    console.error('[auth.js] Erro inesperado na autenticacao:', err);
    return res.status(500).json({
      success: false,
      error: 'ERRO_AUTENTICACAO',
      message: 'Erro interno ao processar a autenticacao. Tente novamente mais tarde.',
    });
  }
}

module.exports = { authenticate };
