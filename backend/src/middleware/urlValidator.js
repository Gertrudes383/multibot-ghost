/**
 * Middleware de validacao de URL — prevencao de SSRF (FIX para VULN-002).
 *
 * Valida URLs fornecidas pelo usuario antes de permitir que o
 * servidor faca requisicoes externas (ex.: checker de cartoes).
 *
 * Bloqueia:
 *   - Esquemas inseguros (file://, gopher://, dict://, ftp://, etc.)
 *   - IPs privados/reservados (10.x, 172.16-31.x, 192.168.x, 127.x, ::1)
 *   - IPs de metadata cloud (169.254.169.254, metadata.google.internal)
 *   - IPs link-local e fd00::/8 (unique-local IPv6)
 *   - Hostnames que resolvem para IPs bloqueados (DNS rebinding defense)
 *
 * Permite apenas HTTPS para prevenir interceptacao de dados em transito.
 *
 * Exporta: validateCheckerUrl (middleware Express)
 */

'use strict';

const { URL } = require('url');
const dns = require('dns');
const { isPrivateIP, isCloudMetadataHostname } = require('../utils/ipValidator');

// Esquemas permitidos — apenas HTTPS
const ALLOWED_PROTOCOLS = ['https:'];

// Esquemas explicitamente bloqueados (alem de tudo que nao esta em ALLOWED)
const BLOCKED_PROTOCOLS = ['file:', 'gopher:', 'dict:', 'ftp:', 'data:', 'ldap:'];

// ---------------------------------------------------------------------------
// validateCheckerUrl
//
// Middleware que valida o campo req.body.url (ou req.query.url) antes de
// prosseguir. Se a URL for invalida ou apontar para recurso interno,
// retorna 400/403 e interrompe a cadeia.
// ---------------------------------------------------------------------------
async function validateCheckerUrl(req, res, next) {
  try {
    // Extrair URL do body ou query string
    const targetUrl = req.body?.url || req.query?.url;

    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL_AUSENTE',
        message: 'O campo "url" e obrigatorio e deve ser uma string valida.',
      });
    }

    // --- Parse da URL ---
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (_parseErr) {
      return res.status(400).json({
        success: false,
        error: 'URL_INVALIDA',
        message: 'A URL fornecida nao e valida.',
      });
    }

    // --- Verificar protocolo ---
    if (BLOCKED_PROTOCOLS.includes(parsed.protocol)) {
      return res.status(403).json({
        success: false,
        error: 'PROTOCOLO_BLOQUEADO',
        message: `O protocolo "${parsed.protocol}" nao e permitido.`,
      });
    }

    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return res.status(403).json({
        success: false,
        error: 'PROTOCOLO_NAO_PERMITIDO',
        message: 'Apenas HTTPS e permitido para URLs externas.',
      });
    }

    // --- Verificar hostname contra metadata cloud ---
    const hostname = parsed.hostname.toLowerCase();

    if (isCloudMetadataHostname(hostname)) {
      return res.status(403).json({
        success: false,
        error: 'HOSTNAME_BLOQUEADO',
        message: 'Acesso a endpoints de metadata cloud nao e permitido.',
      });
    }

    // --- Verificar se o hostname e um IP literal ---
    if (isPrivateIP(hostname)) {
      return res.status(403).json({
        success: false,
        error: 'IP_PRIVADO_BLOQUEADO',
        message: 'Acesso a enderecos IP privados ou reservados nao e permitido.',
      });
    }

    // --- Resolver DNS e verificar IPs resolvidos (defesa contra DNS rebinding) ---
    let resolvedIPs = [];
    try {
      // Tenta resolver IPv4 primeiro
      const ipv4Results = await dns.promises.resolve4(hostname);
      resolvedIPs = resolvedIPs.concat(ipv4Results);
    } catch (_dnsErr) {
      // Se nao resolver IPv4, tentar IPv6
      // (pode ser host somente IPv6)
    }

    try {
      const ipv6Results = await dns.promises.resolve6(hostname);
      resolvedIPs = resolvedIPs.concat(ipv6Results);
    } catch (_dnsErr) {
      // Sem registros IPv6 — nao e erro
    }

    // Se nenhum IP foi resolvido, bloquear
    if (resolvedIPs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'DNS_SEM_RESULTADO',
        message: 'Nao foi possivel resolver o hostname fornecido.',
      });
    }

    // Verificar cada IP resolvido contra ranges privados
    for (const ip of resolvedIPs) {
      if (isPrivateIP(ip)) {
        return res.status(403).json({
          success: false,
          error: 'IP_RESOLVIDO_PRIVADO',
          message: 'O hostname resolve para um endereco IP privado ou reservado. Acesso bloqueado.',
        });
      }
    }

    // --- URL validada com sucesso ---
    // Anexar a URL parseada e IPs resolvidos no request para uso posterior
    req.validatedUrl = {
      original: targetUrl,
      parsed,
      resolvedIPs,
    };

    return next();
  } catch (err) {
    console.error('[urlValidator] Erro inesperado na validacao de URL:', err);
    return res.status(500).json({
      success: false,
      error: 'VALIDACAO_URL_ERRO',
      message: 'Erro interno ao validar a URL fornecida.',
    });
  }
}

module.exports = { validateCheckerUrl };
