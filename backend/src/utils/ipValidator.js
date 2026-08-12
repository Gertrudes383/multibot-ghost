/**
 * ipValidator.js
 *
 * CORREÇÃO: VULN-002 — Proteção contra SSRF (Server-Side Request Forgery).
 *
 * Valida endereços IP e URLs para impedir que requisições do servidor sejam
 * direcionadas a redes internas, endereços de loopback ou endpoints de
 * metadados de provedores cloud (AWS, GCP, Azure).
 *
 * Uso principal: validar URLs fornecidas por usuários antes de que o servidor
 * faça requisições HTTP para elas (webhooks, callbacks, integrações).
 */

'use strict';

const { URL } = require('url');
const dns = require('dns');
const { promisify } = require('util');
const net = require('net');

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

/**
 * Faixas de IP privadas/reservadas em formato [prefixo, máscara].
 * Usadas para verificar se um IPv4 é interno.
 */
const PRIVATE_IPV4_RANGES = [
  // 10.0.0.0/8 — Rede privada classe A
  { network: [10, 0, 0, 0], mask: 8 },
  // 172.16.0.0/12 — Rede privada classe B
  { network: [172, 16, 0, 0], mask: 12 },
  // 192.168.0.0/16 — Rede privada classe C
  { network: [192, 168, 0, 0], mask: 16 },
  // 127.0.0.0/8 — Loopback
  { network: [127, 0, 0, 0], mask: 8 },
  // 169.254.0.0/16 — Link-local (APIPA / cloud metadata)
  { network: [169, 254, 0, 0], mask: 16 },
  // 0.0.0.0/8 — Endereço inválido / "this network"
  { network: [0, 0, 0, 0], mask: 8 },
  // 100.64.0.0/10 — Shared address space (CGNAT)
  { network: [100, 64, 0, 0], mask: 10 },
  // 198.18.0.0/15 — Benchmarking
  { network: [198, 18, 0, 0], mask: 15 },
  // 224.0.0.0/4 — Multicast
  { network: [224, 0, 0, 0], mask: 4 },
  // 240.0.0.0/4 — Reservado para uso futuro
  { network: [240, 0, 0, 0], mask: 4 },
];

/**
 * Prefixos de IPv6 privados/reservados.
 */
const PRIVATE_IPV6_PREFIXES = [
  '::1',          // Loopback
  'fe80:',        // Link-local (fe80::/10)
  'fc00:',        // Unique local (fc00::/7)
  'fd00:',        // Unique local (fd00::/8 — subcategoria de fc00::/7)
  'fd',           // Unique local (prefixo curto)
  'fc',           // Unique local (prefixo curto)
  'ff00:',        // Multicast
  '::ffff:',      // IPv4-mapped — precisa verificar a parte IPv4
  '::',           // Endereço não especificado
];

/**
 * Endereços conhecidos de serviços de metadados de provedores cloud.
 * Estes NUNCA devem ser acessíveis via requisições de usuários.
 */
const CLOUD_METADATA_IPS = [
  '169.254.169.254',     // AWS EC2, GCP, Azure, DigitalOcean, Oracle Cloud
  '169.254.170.2',       // AWS ECS task metadata
  'fd00:ec2::254',       // AWS EC2 IPv6 metadata
  '100.100.100.200',     // Alibaba Cloud metadata
  '100.115.92.0',        // Google Kubernetes Engine
];

/**
 * Hostnames conhecidos de serviços de metadados cloud.
 */
const CLOUD_METADATA_HOSTNAMES = [
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'metadata.azure.com',
  'instance-data',
  'instance-data.ec2.internal',
];

/**
 * Esquemas (protocolos) permitidos para URLs externas.
 * Apenas HTTPS e HTTP são aceitos. Qualquer outro é bloqueado.
 */
const ALLOWED_SCHEMES = ['https:', 'http:'];

/**
 * Converte um endereço IPv4 em string para um array de 4 octetos.
 *
 * @param {string} ip - Endereço IPv4 (ex.: '192.168.1.1')
 * @returns {number[]|null} - Array de 4 números [192, 168, 1, 1] ou null se inválido
 */
function parseIPv4(ip) {
  if (!ip || typeof ip !== 'string') return null;

  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  const octets = [];
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255 || String(num) !== part) {
      return null;
    }
    octets.push(num);
  }

  return octets;
}

/**
 * Converte um endereço IPv4 (array de octetos) para um inteiro de 32 bits.
 *
 * @param {number[]} octets - Array de 4 octetos
 * @returns {number} - Representação inteira do IP
 */
function ipToInt(octets) {
  return (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
}

/**
 * Verifica se um endereço IPv4 pertence a uma faixa CIDR.
 *
 * @param {number[]} ipOctets - Octetos do IP a verificar
 * @param {number[]} networkOctets - Octetos da rede
 * @param {number} maskBits - Tamanho da máscara em bits
 * @returns {boolean} - true se o IP pertence à faixa
 */
function isInRange(ipOctets, networkOctets, maskBits) {
  const ipInt = ipToInt(ipOctets) >>> 0;
  const netInt = ipToInt(networkOctets) >>> 0;
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

/**
 * Verifica se um endereço IP é privado/interno.
 *
 * Testa contra todas as faixas IPv4 privadas (RFC 1918, loopback, link-local, etc.)
 * e prefixos IPv6 reservados.
 *
 * @param {string} ip - Endereço IP a ser verificado
 * @returns {boolean} - true se o IP é privado/interno
 *
 * @example
 *   isPrivateIP('192.168.1.1')    → true
 *   isPrivateIP('10.0.0.5')       → true
 *   isPrivateIP('127.0.0.1')      → true
 *   isPrivateIP('8.8.8.8')        → false
 *   isPrivateIP('::1')            → true
 *   isPrivateIP('fe80::1')        → true
 */
function isPrivateIP(ip) {
  if (!ip || typeof ip !== 'string') return true; // Na dúvida, bloqueia

  const trimmed = ip.trim();

  // Verifica endereços especiais exatos
  if (trimmed === '0.0.0.0' || trimmed === '::' || trimmed === '::1') {
    return true;
  }

  // Verifica "localhost"
  if (trimmed.toLowerCase() === 'localhost') {
    return true;
  }

  // Verifica IPv4
  const octets = parseIPv4(trimmed);
  if (octets) {
    for (const range of PRIVATE_IPV4_RANGES) {
      if (isInRange(octets, range.network, range.mask)) {
        return true;
      }
    }
    return false;
  }

  // Verifica IPv6
  if (net.isIPv6(trimmed)) {
    const normalized = trimmed.toLowerCase();

    // Verifica prefixos IPv6 privados
    for (const prefix of PRIVATE_IPV6_PREFIXES) {
      if (normalized.startsWith(prefix) || normalized === prefix) {
        return true;
      }
    }

    // Verifica IPv4-mapped IPv6 (::ffff:x.x.x.x)
    const v4MappedMatch = normalized.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (v4MappedMatch) {
      return isPrivateIP(v4MappedMatch[1]);
    }

    return false;
  }

  // Formato desconhecido — bloqueia por precaução
  return true;
}

/**
 * Verifica se um endereço IP é um endpoint de metadados cloud conhecido.
 *
 * Endpoints de metadados permitem acesso a credenciais de instância, tokens,
 * e configurações sensíveis. São o alvo principal de ataques SSRF.
 *
 * @param {string} ip - Endereço IP a ser verificado
 * @returns {boolean} - true se é um endpoint de metadados cloud
 *
 * @example
 *   isCloudMetadataIP('169.254.169.254')  → true
 *   isCloudMetadataIP('fd00:ec2::254')    → true
 *   isCloudMetadataIP('8.8.8.8')          → false
 */
function isCloudMetadataIP(ip) {
  if (!ip || typeof ip !== 'string') return false;

  const trimmed = ip.trim().toLowerCase();

  // Verifica contra a lista de IPs de metadados conhecidos
  return CLOUD_METADATA_IPS.some(metaIp => trimmed === metaIp.toLowerCase());
}

/**
 * Verifica se um hostname é um hostname de metadados cloud.
 *
 * @param {string} hostname - Hostname a ser verificado
 * @returns {boolean} - true se é um hostname de metadados
 */
function isCloudMetadataHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;

  const normalized = hostname.trim().toLowerCase();

  return CLOUD_METADATA_HOSTNAMES.some(metaHost =>
    normalized === metaHost || normalized.endsWith('.' + metaHost)
  );
}

/**
 * Validação completa de URL externa para proteção contra SSRF.
 *
 * Realiza as seguintes verificações:
 *   1. Parseia a URL e valida o formato
 *   2. Verifica se o esquema é permitido (apenas http/https)
 *   3. Verifica se o hostname não é um endereço de metadados cloud
 *   4. Resolve o DNS do hostname
 *   5. Verifica cada IP resolvido contra faixas privadas e metadados
 *
 * @param {string} urlString - URL fornecida pelo usuário
 * @returns {Promise<{ valid: boolean, reason?: string }>} - Resultado da validação
 *
 * @example
 *   await validateExternalUrl('https://example.com/webhook')
 *   → { valid: true }
 *
 *   await validateExternalUrl('http://169.254.169.254/latest/meta-data/')
 *   → { valid: false, reason: 'IP é um endpoint de metadados cloud' }
 *
 *   await validateExternalUrl('http://localhost:3000')
 *   → { valid: false, reason: 'IP resolve para endereço privado/interno' }
 */
async function validateExternalUrl(urlString) {
  // 1. Validação básica do formato
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, reason: 'URL inválida ou vazia' };
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch (err) {
    return { valid: false, reason: `URL mal formada: ${err.message}` };
  }

  // 2. Verificação de esquema (protocolo)
  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return {
      valid: false,
      reason: `Esquema não permitido: "${parsed.protocol}". Apenas ${ALLOWED_SCHEMES.join(', ')} são aceitos`,
    };
  }

  const hostname = parsed.hostname;

  // 3. Hostname vazio
  if (!hostname) {
    return { valid: false, reason: 'URL sem hostname' };
  }

  // 4. Verifica se o hostname é um nome de metadados cloud
  if (isCloudMetadataHostname(hostname)) {
    return { valid: false, reason: 'Hostname é um endpoint de metadados cloud' };
  }

  // 5. Se o hostname já é um IP, verifica diretamente
  if (net.isIP(hostname)) {
    if (isCloudMetadataIP(hostname)) {
      return { valid: false, reason: 'IP é um endpoint de metadados cloud' };
    }
    if (isPrivateIP(hostname)) {
      return { valid: false, reason: 'IP é um endereço privado/interno' };
    }
    return { valid: true };
  }

  // 6. Verifica "localhost" e variações
  if (hostname.toLowerCase() === 'localhost' || hostname.toLowerCase().endsWith('.localhost')) {
    return { valid: false, reason: 'Hostname "localhost" não é permitido' };
  }

  // 7. Resolve DNS e verifica cada IP resultante
  let resolvedIPs = [];

  try {
    const ipv4Results = await dnsResolve4(hostname).catch(() => []);
    const ipv6Results = await dnsResolve6(hostname).catch(() => []);
    resolvedIPs = [...ipv4Results, ...ipv6Results];
  } catch (err) {
    return { valid: false, reason: `Falha na resolução DNS: ${err.message}` };
  }

  // Nenhum IP resolvido — hostname não existe
  if (resolvedIPs.length === 0) {
    return { valid: false, reason: 'Hostname não resolveu para nenhum endereço IP' };
  }

  // 8. Verifica cada IP resolvido
  for (const resolvedIP of resolvedIPs) {
    if (isCloudMetadataIP(resolvedIP)) {
      return {
        valid: false,
        reason: `IP resolvido (${resolvedIP}) é um endpoint de metadados cloud`,
      };
    }
    if (isPrivateIP(resolvedIP)) {
      return {
        valid: false,
        reason: `IP resolvido (${resolvedIP}) é um endereço privado/interno`,
      };
    }
  }

  // Todas as verificações passaram
  return { valid: true };
}

module.exports = {
  isPrivateIP,
  isCloudMetadataIP,
  isCloudMetadataHostname,
  validateExternalUrl,
  // Exportados para testes
  PRIVATE_IPV4_RANGES,
  CLOUD_METADATA_IPS,
  CLOUD_METADATA_HOSTNAMES,
};
