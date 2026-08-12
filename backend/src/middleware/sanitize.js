/**
 * Middleware de sanitizacao de entrada (CORRECAO — VULN-005)
 *
 * Problema original (VULN-005):
 *   A aplicacao aceitava payloads contendo operadores MongoDB diretamente
 *   em req.body, req.query e req.params. Um atacante podia enviar:
 *     { "username": {"$gt": ""}, "password": {"$gt": ""} }
 *   e obter bypass de autenticacao via NoSQL Injection.
 *
 * Correcao:
 *   Este middleware percorre recursivamente todos os objetos de entrada
 *   e aplica as seguintes regras:
 *     1. Remove chaves que iniciam com '$' (operadores MongoDB)
 *     2. Sanitiza strings que contenham padroes de operadores MongoDB
 *     3. Valida tipos — rejeita objetos onde strings sao esperadas
 *     4. Limita profundidade de aninhamento para prevenir DoS
 *
 * Uso:
 *   app.use(sanitizeInputs);  // Aplicar ANTES de qualquer rota
 */

'use strict';

// Operadores MongoDB conhecidos que devem ser bloqueados
const OPERADORES_MONGODB = [
  '$gt', '$gte', '$lt', '$lte', '$ne', '$eq',
  '$in', '$nin', '$or', '$and', '$not', '$nor',
  '$exists', '$type', '$regex', '$where',
  '$elemMatch', '$size', '$all',
  '$set', '$unset', '$inc', '$push', '$pull',
  '$addToSet', '$pop', '$rename', '$bit',
  '$expr', '$mod', '$text', '$search',
  '$slice', '$meta', '$comment',
  '$lookup', '$group', '$match', '$project',
];

// Regex para detectar operadores MongoDB em strings
// Captura padroes como: {$gt, "$ne", $or:, etc.
const REGEX_OPERADOR_STRING = /\{\s*\$[a-zA-Z]+/g;

// Profundidade maxima permitida para objetos aninhados (prevencao de DoS)
const MAX_PROFUNDIDADE = 20;

/**
 * Verifica se uma string contem padroes suspeitos de operadores MongoDB.
 *
 * @param {string} valor
 * @returns {boolean}
 */
function contemOperadorMongo(valor) {
  if (typeof valor !== 'string') return false;

  // Verifica presenca de operadores conhecidos na string
  for (const operador of OPERADORES_MONGODB) {
    if (valor.includes(operador)) {
      return true;
    }
  }

  // Verifica padrao generico {$...
  if (REGEX_OPERADOR_STRING.test(valor)) {
    REGEX_OPERADOR_STRING.lastIndex = 0; // Reset do regex stateful
    return true;
  }

  return false;
}

/**
 * Remove operadores MongoDB de uma string, preservando o conteudo legivel.
 * Ex: '{"$gt":""}' -> '{":""}'
 *
 * @param {string} valor
 * @returns {string}
 */
function sanitizarString(valor) {
  if (typeof valor !== 'string') return valor;

  let sanitizado = valor;

  // Remove todos os padroes de operadores $xxx
  for (const operador of OPERADORES_MONGODB) {
    // Substitui o operador por string vazia em todos os contextos
    while (sanitizado.includes(operador)) {
      sanitizado = sanitizado.replace(operador, '');
    }
  }

  return sanitizado;
}

/**
 * Percorre recursivamente um objeto e sanitiza todos os valores.
 *
 * Regras aplicadas:
 *   - Chaves iniciando com '$' sao removidas
 *   - Valores do tipo objeto onde string e esperada sao convertidos para string
 *   - Strings contendo operadores MongoDB sao sanitizadas
 *   - Arrays sao percorridos elemento a elemento
 *   - Profundidade limitada para prevenir stack overflow
 *
 * @param {*}      obj           — valor a sanitizar
 * @param {number} profundidade  — nivel atual de aninhamento
 * @returns {*}                  — valor sanitizado
 */
function sanitizarRecursivo(obj, profundidade = 0) {
  // Prevencao de DoS por aninhamento excessivo
  if (profundidade > MAX_PROFUNDIDADE) {
    return {};
  }

  // Valores primitivos nulos ou indefinidos — retorna como esta
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Strings — verificar e sanitizar conteudo
  if (typeof obj === 'string') {
    if (contemOperadorMongo(obj)) {
      return sanitizarString(obj);
    }
    return obj;
  }

  // Numeros e booleanos — retorna como esta (tipos seguros)
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  // Arrays — percorrer cada elemento
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizarRecursivo(item, profundidade + 1));
  }

  // Objetos — a parte critica da sanitizacao
  if (typeof obj === 'object') {
    const resultado = {};
    const chaves = Object.keys(obj);

    for (const chave of chaves) {
      // REGRA 1: Remover chaves que iniciam com '$' (operadores MongoDB)
      if (typeof chave === 'string' && chave.startsWith('$')) {
        // Log para auditoria — tentativa de injecao detectada
        console.warn(
          `[sanitize] Operador MongoDB bloqueado — chave removida: "${chave}"`
        );
        continue; // Pula esta chave — nao inclui no resultado
      }

      const valor = obj[chave];

      // REGRA 2: Se o valor e um objeto mas deveria ser string (type confusion)
      // Isso previne payloads como: { "username": {"$gt": ""} }
      if (typeof valor === 'object' && valor !== null && !Array.isArray(valor)) {
        // Verifica se o objeto contem chaves iniciando com '$'
        const chavesDoValor = Object.keys(valor);
        const temOperador = chavesDoValor.some(
          (k) => typeof k === 'string' && k.startsWith('$')
        );

        if (temOperador) {
          console.warn(
            `[sanitize] Objeto com operador MongoDB detectado no campo "${chave}" — convertido para string`
          );
          // Converte para representacao string segura em vez de passar o objeto
          resultado[chave] = String(valor);
          continue;
        }
      }

      // REGRA 3: Sanitizar recursivamente o valor
      resultado[chave] = sanitizarRecursivo(valor, profundidade + 1);
    }

    return resultado;
  }

  // Qualquer outro tipo — retorna como esta
  return obj;
}

/**
 * Middleware Express de sanitizacao de inputs.
 *
 * Aplica sanitizacao em req.body, req.query e req.params
 * antes que qualquer handler de rota os processe.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function sanitizeInputs(req, res, next) {
  try {
    // Sanitiza o corpo da requisicao (POST, PUT, PATCH)
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizarRecursivo(req.body);
    }

    // Sanitiza os parametros de query string
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizarRecursivo(req.query);
    }

    // Sanitiza os parametros de rota
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizarRecursivo(req.params);
    }

    return next();
  } catch (err) {
    console.error('[sanitize] Erro ao sanitizar entrada:', err);

    // Em caso de erro na sanitizacao, rejeita a requisicao (fail-closed)
    return res.status(400).json({
      success: false,
      error: 'ENTRADA_INVALIDA',
      message: 'A requisicao contem dados em formato invalido que nao puderam ser processados.',
    });
  }
}

module.exports = { sanitizeInputs };
