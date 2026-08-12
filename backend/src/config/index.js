/**
 * Configuração centralizada da aplicação.
 *
 * Carrega todas as variáveis de ambiente e exporta um objeto
 * tipado e validado para uso em toda a aplicação.
 * Valores sensíveis nunca devem ser logados diretamente.
 */

require('dotenv').config();

const config = {
  // --- Servidor ---
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 9999,
  apiUrl: process.env.API_URL || 'http://localhost:9999',

  // --- MongoDB ---
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/multibots',

  // --- JWT ---
  jwtSecret: process.env.JWT_SECRET || 'INSECURE_DEFAULT_CHANGE_ME',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'INSECURE_DEFAULT_CHANGE_ME_REFRESH',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // --- CORS (VULN-004) ---
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  // --- Rate Limiting ---
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 10,
  purchaseRateLimitMax: parseInt(process.env.PURCHASE_RATE_LIMIT_MAX, 10) || 30,

  // --- Upload (VULN-010) ---
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
  uploadDir: process.env.UPLOAD_DIR || './uploads',

  // --- PIX ---
  pixGatewayUrl: process.env.PIX_GATEWAY_URL || '',
  pixApiKey: process.env.PIX_API_KEY || '',
  pixSecret: process.env.PIX_SECRET || '',
  pixWebhookSecret: process.env.PIX_WEBHOOK_SECRET || '',

  // --- NOWPayments (Cripto) ---
  nowpaymentsApiKey: process.env.NOWPAYMENTS_API_KEY || '',
  nowpaymentsIpnSecret: process.env.NOWPAYMENTS_IPN_SECRET || '',
  nowpaymentsEndpoint: process.env.NOWPAYMENTS_ENDPOINT || 'https://api.nowpayments.io',
  nowpaymentsCallbackUrl: process.env.NOWPAYMENTS_CALLBACK_URL || '',

  // --- Telegram ---
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',

  // --- Checker (VULN-002) ---
  checkerApiUrl: process.env.CHECKER_API_URL || '',
  checkerApiKey: process.env.CHECKER_API_KEY || '',
  checkerTimeoutMs: parseInt(process.env.CHECKER_TIMEOUT_MS, 10) || 30000,

  // --- Fornecedor (Supplier) ---
  supplierApiUrl: process.env.SUPPLIER_API_URL || '',
  supplierApiKey: process.env.SUPPLIER_API_KEY || '',
  supplierWebhookSecret: process.env.SUPPLIER_WEBHOOK_SECRET || '',

  // --- Super Admin ---
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || 'admin@multibots.cc',
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || '',

  // --- Logs ---
  logLevel: process.env.LOG_LEVEL || 'info',
  logFile: process.env.LOG_FILE || './logs/app.log',

  // --- Socket.IO ---
  socketIoCorsOrigin: process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:5173',

  // --- Helpers ---
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};

// Validação mínima em produção
if (config.isProd) {
  const required = ['JWT_SECRET', 'MONGODB_URI', 'PIX_WEBHOOK_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[Config] Variáveis obrigatórias ausentes em produção: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (config.jwtSecret === 'INSECURE_DEFAULT_CHANGE_ME') {
    console.error('[Config] JWT_SECRET padrão inseguro detectado em produção!');
    process.exit(1);
  }
}

module.exports = config;
