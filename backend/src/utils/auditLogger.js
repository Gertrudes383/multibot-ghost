/**
 * auditLogger.js
 *
 * Logger de auditoria para operações sensíveis.
 *
 * Registra ações administrativas, operações financeiras e eventos de segurança
 * em formato JSON estruturado. Em produção, os logs podem ser encaminhados
 * para uma coleção dedicada no banco de dados, Elasticsearch, Splunk ou
 * qualquer SIEM externo.
 *
 * Cada entrada de auditoria contém:
 *   - timestamp ISO 8601
 *   - ação realizada (constante do enum AuditActions)
 *   - ID do usuário que executou a ação
 *   - ID do alvo da ação (se aplicável)
 *   - detalhes adicionais
 *   - IP de origem
 *   - User-Agent do cliente
 */

'use strict';

/**
 * Enum de ações auditáveis.
 *
 * Cada constante representa uma categoria de operação que deve ser
 * registrada para fins de segurança, compliance e investigação forense.
 */
const AuditActions = Object.freeze({
  // Autenticação e sessão
  LOGIN:              'AUTH_LOGIN',
  LOGOUT:             'AUTH_LOGOUT',
  REGISTER:           'AUTH_REGISTER',
  PASSWORD_CHANGE:    'AUTH_PASSWORD_CHANGE',
  LOGIN_FAILED:       'AUTH_LOGIN_FAILED',
  TOKEN_REFRESH:      'AUTH_TOKEN_REFRESH',

  // Operações financeiras
  PURCHASE:           'FINANCIAL_PURCHASE',
  RECHARGE:           'FINANCIAL_RECHARGE',
  WITHDRAWAL:         'FINANCIAL_WITHDRAWAL',
  REFUND:             'FINANCIAL_REFUND',
  BALANCE_ADJUST:     'FINANCIAL_BALANCE_ADJUST',

  // Ações administrativas
  ADMIN_ACTION:       'ADMIN_ACTION',
  SETTINGS_CHANGE:    'ADMIN_SETTINGS_CHANGE',
  USER_MODIFY:        'ADMIN_USER_MODIFY',
  USER_BAN:           'ADMIN_USER_BAN',
  USER_DELETE:        'ADMIN_USER_DELETE',
  ROLE_CHANGE:        'ADMIN_ROLE_CHANGE',

  // Operações de dados
  CARD_UPLOAD:        'DATA_CARD_UPLOAD',
  CARD_DELETE:        'DATA_CARD_DELETE',
  DATA_EXPORT:        'DATA_EXPORT',
  BULK_OPERATION:     'DATA_BULK_OPERATION',

  // Integrações externas
  WEBHOOK_RECEIVED:   'INTEGRATION_WEBHOOK_RECEIVED',
  WEBHOOK_SENT:       'INTEGRATION_WEBHOOK_SENT',
  API_KEY_CREATED:    'INTEGRATION_API_KEY_CREATED',
  API_KEY_REVOKED:    'INTEGRATION_API_KEY_REVOKED',

  // Eventos de segurança
  SECURITY_EVENT:     'SECURITY_EVENT',
  RATE_LIMIT_HIT:     'SECURITY_RATE_LIMIT',
  SUSPICIOUS_ACTIVITY:'SECURITY_SUSPICIOUS',
  IP_BLOCKED:         'SECURITY_IP_BLOCKED',
  SSRF_ATTEMPT:       'SECURITY_SSRF_ATTEMPT',
  INJECTION_ATTEMPT:  'SECURITY_INJECTION_ATTEMPT',
  AUTH_BYPASS_ATTEMPT:'SECURITY_AUTH_BYPASS',
});

/**
 * Níveis de severidade para categorizar a importância do evento.
 */
const AuditSeverity = Object.freeze({
  INFO:     'INFO',
  WARNING:  'WARNING',
  CRITICAL: 'CRITICAL',
  ALERT:    'ALERT',
});

/**
 * Sanitiza dados sensíveis antes de registrar no log.
 * Remove ou mascara campos que não devem aparecer em texto claro.
 *
 * @param {object} details - Objeto com detalhes da ação
 * @returns {object} - Objeto sanitizado seguro para logging
 */
function sanitizeDetails(details) {
  if (!details || typeof details !== 'object') {
    return details;
  }

  const sensitiveKeys = [
    'password', 'senha', 'secret', 'token', 'api_key',
    'apiKey', 'private_key', 'privateKey', 'credit_card',
    'creditCard', 'cvv', 'card_number', 'cardNumber',
  ];

  const sanitized = { ...details };

  for (const key of Object.keys(sanitized)) {
    const keyLower = key.toLowerCase();
    if (sensitiveKeys.some(sk => keyLower.includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Determina automaticamente a severidade com base na ação.
 *
 * @param {string} action - Constante de AuditActions
 * @returns {string} - Nível de severidade
 */
function inferSeverity(action) {
  // Ações de segurança são sempre críticas ou alertas
  if (action.startsWith('SECURITY_')) {
    if (['SECURITY_SSRF_ATTEMPT', 'SECURITY_INJECTION_ATTEMPT', 'SECURITY_AUTH_BYPASS'].includes(action)) {
      return AuditSeverity.ALERT;
    }
    return AuditSeverity.CRITICAL;
  }

  // Operações financeiras são importantes
  if (action.startsWith('FINANCIAL_')) {
    return AuditSeverity.WARNING;
  }

  // Ações administrativas precisam de atenção
  if (action.startsWith('ADMIN_')) {
    return AuditSeverity.WARNING;
  }

  // Tudo o mais é informativo
  return AuditSeverity.INFO;
}

/**
 * Registra um evento de auditoria em formato JSON estruturado.
 *
 * @param {object} params - Parâmetros do evento de auditoria
 * @param {string} params.action - Ação realizada (use constantes de AuditActions)
 * @param {string} [params.userId] - ID do usuário que executou a ação
 * @param {string} [params.targetId] - ID do recurso/usuário alvo da ação
 * @param {object} [params.details] - Detalhes adicionais (sanitizados automaticamente)
 * @param {string} [params.ip] - Endereço IP de origem da requisição
 * @param {string} [params.userAgent] - User-Agent do cliente
 * @param {string} [params.severity] - Severidade (inferida automaticamente se omitida)
 * @param {string} [params.requestId] - ID da requisição para correlação
 *
 * @example
 *   logAudit({
 *     action: AuditActions.PURCHASE,
 *     userId: 'user_123',
 *     targetId: 'card_456',
 *     details: { amount: 15.00, bin: '411111' },
 *     ip: '203.0.113.42',
 *     userAgent: 'Mozilla/5.0...',
 *   });
 */
function logAudit({
  action,
  userId = null,
  targetId = null,
  details = null,
  ip = null,
  userAgent = null,
  severity = null,
  requestId = null,
} = {}) {
  // Validação mínima
  if (!action) {
    console.error('[AUDIT-ERROR] Tentativa de log sem ação definida');
    return;
  }

  // Monta o registro de auditoria
  const auditEntry = {
    timestamp: new Date().toISOString(),
    level: 'AUDIT',
    severity: severity || inferSeverity(action),
    action,
    userId: userId || 'anonymous',
    targetId: targetId || null,
    details: details ? sanitizeDetails(details) : null,
    ip: ip || 'unknown',
    userAgent: userAgent || null,
    requestId: requestId || null,
    environment: process.env.NODE_ENV || 'development',
    service: 'multibots-backend',
  };

  // Em produção, aqui seria o ponto de integração com:
  //   - MongoDB: coleção dedicada 'audit_logs'
  //   - Elasticsearch/OpenSearch
  //   - AWS CloudWatch Logs
  //   - Syslog / rsyslog
  //   - SIEM (Splunk, QRadar, etc.)
  //
  // Por ora, registra em stdout no formato JSON para fácil ingestão
  // por coletores de logs (Fluentd, Logstash, Vector, etc.)

  const output = JSON.stringify(auditEntry);

  // Usa stderr para eventos de segurança (para separação de streams)
  if (auditEntry.severity === AuditSeverity.ALERT || auditEntry.severity === AuditSeverity.CRITICAL) {
    console.error(`[AUDIT] ${output}`);
  } else {
    console.log(`[AUDIT] ${output}`);
  }

  return auditEntry;
}

module.exports = {
  logAudit,
  AuditActions,
  AuditSeverity,
};
