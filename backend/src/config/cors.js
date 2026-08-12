/**
 * Configuração de CORS (Cross-Origin Resource Sharing).
 *
 * CORREÇÃO VULN-004: CORS com allowlist explícita de origens.
 * Anteriormente o CORS estava aberto (origin: *), permitindo que qualquer
 * domínio fizesse requisições autenticadas à API. Agora apenas origens
 * explicitamente listadas em CORS_ALLOWED_ORIGINS são permitidas.
 */

const config = require('./index');

/**
 * Gera as opções de CORS baseadas nas origens permitidas.
 * @returns {object} Opções para o middleware cors()
 */
function getCorsOptions() {
  const allowedOrigins = config.corsAllowedOrigins;

  return {
    /**
     * Função de validação de origem.
     * Permite apenas origens da allowlist + requisições sem origin (ex: mobile, curl).
     */
    origin: function (origin, callback) {
      // Permitir requisições sem origin (ex: apps mobile, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // VULN-004: Bloquear origens não autorizadas
      console.warn(`[CORS] Origem bloqueada: ${origin}`);
      return callback(new Error(`Origem não permitida pelo CORS: ${origin}`), false);
    },

    // Métodos HTTP permitidos
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Headers permitidos nas requisições
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Bot-Id',
      'X-Webhook-Secret',
    ],

    // Headers expostos nas respostas
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],

    // Permitir envio de cookies/credentials
    credentials: true,

    // Cache de preflight em segundos (10 minutos)
    maxAge: 600,

    // Responder com 204 em preflight (compatibilidade com browsers antigos)
    optionsSuccessStatus: 204,
  };
}

module.exports = { getCorsOptions };
