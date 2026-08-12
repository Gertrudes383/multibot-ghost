/**
 * priceResolver.js
 *
 * CORREÇÃO: VULN-001 — Preço calculado no servidor com base no BIN.
 *
 * O problema original era que o preço vinha do lado do cliente, permitindo
 * que um atacante manipulasse o valor da compra. Agora o preço é resolvido
 * exclusivamente no servidor usando dados do BIN (primeiros 6 dígitos do cartão).
 *
 * Hierarquia de resolução de preço:
 *   1. Preço específico do BIN         (settings.binPrices[bin])
 *   2. Preço por bandeira              (settings.brandPrices[brand])
 *   3. Preço por país                  (settings.countryPrices[country])
 *   4. Preço por nível/tipo do cartão  (settings.levelPrices[level])
 *   5. Preço padrão                    (settings.defaultPrice)
 */

'use strict';

/**
 * Mapa simplificado de prefixos BIN → bandeira do cartão.
 * Em produção, esse mapeamento viria de uma base BIN completa (ex.: binlist.net).
 */
const BIN_BRAND_MAP = {
  '4': 'visa',
  '51': 'mastercard',
  '52': 'mastercard',
  '53': 'mastercard',
  '54': 'mastercard',
  '55': 'mastercard',
  '22': 'mastercard',  // Série 2 da Mastercard (2221-2720)
  '23': 'mastercard',
  '24': 'mastercard',
  '25': 'mastercard',
  '26': 'mastercard',
  '27': 'mastercard',
  '34': 'amex',
  '37': 'amex',
  '36': 'diners',
  '30': 'diners',
  '38': 'diners',
  '60': 'discover',
  '65': 'discover',
  '35': 'jcb',
  '50': 'elo',
  '63': 'elo',
  '636': 'elo',
};

/**
 * Identifica a bandeira do cartão a partir do BIN.
 *
 * @param {string} bin - Primeiros 6 dígitos do cartão
 * @returns {string|null} - Nome da bandeira em minúsculas ou null
 */
function detectBrand(bin) {
  if (!bin || typeof bin !== 'string') return null;

  const cleaned = bin.replace(/\D/g, '');
  if (cleaned.length < 1) return null;

  // Tenta match do mais específico (3 dígitos) ao mais genérico (1 dígito)
  for (let len = 3; len >= 1; len--) {
    const prefix = cleaned.substring(0, len);
    if (BIN_BRAND_MAP[prefix]) {
      return BIN_BRAND_MAP[prefix];
    }
  }

  return null;
}

/**
 * Resolve o preço correto do cartão com base no BIN e configurações do bot.
 *
 * @param {string} bin - BIN de 6 dígitos do cartão
 * @param {object} settings - Objeto de configuração de preços do bot
 * @param {object} [settings.binPrices] - Preços específicos por BIN (ex.: { '411111': 25.00 })
 * @param {object} [settings.brandPrices] - Preços por bandeira (ex.: { 'visa': 15.00 })
 * @param {object} [settings.countryPrices] - Preços por país (ex.: { 'BR': 10.00 })
 * @param {object} [settings.levelPrices] - Preços por nível (ex.: { 'platinum': 30.00 })
 * @param {number} [settings.defaultPrice] - Preço padrão
 * @param {object} [binData] - Dados adicionais do BIN (país, nível) se disponíveis
 * @param {string} [binData.country] - Código ISO do país (ex.: 'BR', 'US')
 * @param {string} [binData.level] - Nível do cartão (ex.: 'classic', 'gold', 'platinum', 'black')
 * @returns {{ price: number, source: string }} - Preço resolvido e sua origem
 * @throws {Error} - Se o BIN for inválido ou nenhum preço for encontrado
 */
function resolveBinPrice(bin, settings, binData = {}) {
  // Validação do BIN
  if (!bin || typeof bin !== 'string') {
    throw new Error('BIN inválido: deve ser uma string não vazia');
  }

  const cleanBin = bin.replace(/\D/g, '');
  if (cleanBin.length < 6) {
    throw new Error('BIN inválido: deve conter pelo menos 6 dígitos');
  }

  const sixDigitBin = cleanBin.substring(0, 6);

  // Validação do objeto de configurações
  if (!settings || typeof settings !== 'object') {
    throw new Error('Configurações de preço inválidas');
  }

  // 1. Preço específico do BIN (prioridade máxima)
  if (settings.binPrices && typeof settings.binPrices === 'object') {
    const binPrice = settings.binPrices[sixDigitBin];
    if (typeof binPrice === 'number' && binPrice > 0) {
      return { price: binPrice, source: 'bin' };
    }
  }

  // 2. Preço por bandeira
  const brand = detectBrand(sixDigitBin);
  if (brand && settings.brandPrices && typeof settings.brandPrices === 'object') {
    // Normaliza para minúsculas para comparação
    const brandLower = brand.toLowerCase();
    const brandPrice = settings.brandPrices[brandLower]
      || settings.brandPrices[brand];
    if (typeof brandPrice === 'number' && brandPrice > 0) {
      return { price: brandPrice, source: 'brand' };
    }
  }

  // 3. Preço por país
  const country = binData.country || null;
  if (country && settings.countryPrices && typeof settings.countryPrices === 'object') {
    const countryUpper = country.toUpperCase();
    const countryPrice = settings.countryPrices[countryUpper]
      || settings.countryPrices[country];
    if (typeof countryPrice === 'number' && countryPrice > 0) {
      return { price: countryPrice, source: 'country' };
    }
  }

  // 4. Preço por nível do cartão
  const level = binData.level || null;
  if (level && settings.levelPrices && typeof settings.levelPrices === 'object') {
    const levelLower = level.toLowerCase();
    const levelPrice = settings.levelPrices[levelLower]
      || settings.levelPrices[level];
    if (typeof levelPrice === 'number' && levelPrice > 0) {
      return { price: levelPrice, source: 'level' };
    }
  }

  // 5. Preço padrão (fallback)
  if (typeof settings.defaultPrice === 'number' && settings.defaultPrice > 0) {
    return { price: settings.defaultPrice, source: 'default' };
  }

  // Nenhum preço encontrado — situação que não deve ocorrer em configuração válida
  throw new Error(
    `Nenhum preço encontrado para BIN ${sixDigitBin}. Verifique as configurações do bot.`
  );
}

/**
 * Valida se o preço enviado pelo cliente corresponde ao preço calculado no servidor.
 *
 * NUNCA confie no preço vindo do cliente. Esta função garante que o preço
 * solicitado é idêntico ao preço resolvido pelo servidor.
 *
 * @param {number} requestedPrice - Preço enviado pelo cliente na requisição
 * @param {number} serverPrice - Preço calculado pelo servidor via resolveBinPrice
 * @returns {boolean} - true somente se os preços forem idênticos
 */
function validatePurchasePrice(requestedPrice, serverPrice) {
  // Validação de tipos — ambos devem ser números válidos
  if (typeof requestedPrice !== 'number' || isNaN(requestedPrice)) {
    return false;
  }
  if (typeof serverPrice !== 'number' || isNaN(serverPrice)) {
    return false;
  }

  // Preços negativos ou zero são sempre inválidos
  if (requestedPrice <= 0 || serverPrice <= 0) {
    return false;
  }

  // Comparação com precisão de 2 casas decimais para evitar erros de ponto flutuante
  const roundedRequested = Math.round(requestedPrice * 100);
  const roundedServer = Math.round(serverPrice * 100);

  return roundedRequested === roundedServer;
}

module.exports = {
  resolveBinPrice,
  validatePurchasePrice,
  detectBrand, // Exportado para uso interno (ex.: enriquecimento de dados do cartão)
};
