/**
 * Configuração principal do Express.
 *
 * Monta todos os middlewares globais na ordem correta:
 * 1. Helmet (headers de segurança)
 * 2. CORS (VULN-004: allowlist explícita)
 * 3. Morgan (logs de requisição)
 * 4. Rate Limiter global
 * 5. Body parsers (JSON, URL-encoded)
 * 6. Mongo Sanitize (VULN-005: remoção de operadores $)
 * 7. Sanitização customizada (VULN-005)
 * 8. Rotas da aplicação
 * 9. Handler de erros global
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

const { getCorsOptions } = require('./config/cors');
const { generalLimiter } = require('./middleware/rateLimiter');
const { sanitizeInputs } = require('./middleware/sanitize');
const routes = require('./routes');
const config = require('./config');

const app = express();

// ============================================================
// Middlewares de segurança e parsing
// ============================================================

// Headers de segurança (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: config.isProd ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// CORS — VULN-004: Apenas origens permitidas
app.use(cors(getCorsOptions()));

// Logs de requisição
if (!config.isTest) {
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
}

// Rate limiter global
app.use(generalLimiter);

// Body parsers com limite de tamanho
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Sanitização contra NoSQL Injection — VULN-005
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[Sanitize] Operador MongoDB removido em ${req.path} (campo: ${key})`);
  },
}));

// Sanitização customizada adicional — VULN-005
app.use(sanitizeInputs);

// Servir uploads estáticos (se necessário)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ============================================================
// Rotas
// ============================================================

app.use('/api', routes);

// Health check (fora do /api)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// ============================================================
// Handler de erro global
// ============================================================

// 404 — Rota não encontrada
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada.',
  });
});

// Handler de erros genérico
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[App] Erro não tratado:', err.message);

  // Erro de CORS
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      error: 'Acesso bloqueado pela política de CORS.',
    });
  }

  // Erro de payload grande demais
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Payload excede o tamanho máximo permitido.',
    });
  }

  // Erro de JSON malformado
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'JSON malformado no corpo da requisição.',
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: config.isProd ? 'Erro interno do servidor.' : err.message,
    ...(config.isDev && { stack: err.stack }),
  });
});

module.exports = app;
