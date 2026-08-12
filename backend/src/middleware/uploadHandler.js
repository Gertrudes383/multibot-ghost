/**
 * Middleware de upload seguro de arquivos (FIX para VULN-010).
 *
 * Utiliza multer com armazenamento em memoria (memoryStorage) para
 * que nenhum arquivo toque o disco antes de ser validado. Apos a
 * validacao, imagens sao re-processadas com sharp para:
 *   - Remover metadados EXIF (previne vazamento de dados)
 *   - Re-codificar na mesma extensao (elimina payloads embutidos)
 *   - Redimensionar se exceder 2000x2000 pixels
 *
 * Exporta:
 *   - createUploadMiddleware(fieldName, maxCount) — factory de middleware multer
 *   - processImage — middleware de pos-processamento com sharp
 */

'use strict';

const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const config = require('../config');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

// Tamanho maximo do arquivo em bytes (config ou 5 MB padrao)
const MAX_FILE_SIZE = (config.maxFileSizeMb || 5) * 1024 * 1024;

// Dimensao maxima permitida para imagens (px)
const MAX_DIMENSION = 2000;

// MIME types permitidos — apenas imagens e CSV
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel', // CSV pode vir com este MIME
]);

// Extensoes permitidas (validacao dupla: MIME + extensao)
const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.csv',
  '.txt',
]);

// Mapeamento MIME -> extensao para salvar o arquivo reprocessado
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',  // sharp converte GIF animado para primeiro frame
  'image/webp': '.webp',
};

// Mapeamento MIME -> formato sharp
const MIME_TO_SHARP_FORMAT = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

// ---------------------------------------------------------------------------
// Configuracao do multer — armazenamento em memoria
// ---------------------------------------------------------------------------
const storage = multer.memoryStorage();

/**
 * Filtro de arquivo: valida MIME type e extensao antes de aceitar.
 * Rejeita qualquer tipo nao listado explicitamente.
 */
function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const erro = new Error('TIPO_ARQUIVO_NAO_PERMITIDO');
    erro.status = 400;
    erro.message = `Tipo de arquivo "${file.mimetype}" nao e permitido. Permitidos: JPEG, PNG, GIF, WebP, CSV.`;
    return cb(erro, false);
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const erro = new Error('EXTENSAO_NAO_PERMITIDA');
    erro.status = 400;
    erro.message = `Extensao "${ext}" nao e permitida. Permitidas: ${[...ALLOWED_EXTENSIONS].join(', ')}.`;
    return cb(erro, false);
  }

  return cb(null, true);
}

// ---------------------------------------------------------------------------
// createUploadMiddleware — factory que retorna middleware multer configurado
// ---------------------------------------------------------------------------

/**
 * Cria middleware multer para upload de arquivos com validacao.
 *
 * @param {string} fieldName — nome do campo no form-data (ex.: 'avatar')
 * @param {number} [maxCount=1] — numero maximo de arquivos aceitos
 * @returns {Function} middleware Express (multer)
 */
function createUploadMiddleware(fieldName, maxCount = 1) {
  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: maxCount,
    },
    fileFilter,
  });

  // Retorna middleware que trata erros do multer de forma amigavel
  return (req, res, next) => {
    const handler = maxCount === 1
      ? upload.single(fieldName)
      : upload.array(fieldName, maxCount);

    handler(req, res, (err) => {
      if (err) {
        // Erro de tamanho de arquivo
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'ARQUIVO_MUITO_GRANDE',
            message: `O arquivo excede o limite de ${config.maxFileSizeMb || 5} MB.`,
          });
        }

        // Erro de quantidade de arquivos
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            error: 'MUITOS_ARQUIVOS',
            message: `No maximo ${maxCount} arquivo(s) permitido(s) por envio.`,
          });
        }

        // Erros customizados do fileFilter
        if (err.message === 'TIPO_ARQUIVO_NAO_PERMITIDO' || err.message === 'EXTENSAO_NAO_PERMITIDA') {
          return res.status(400).json({
            success: false,
            error: err.message,
            message: err.message,
          });
        }

        // Erro generico do multer
        console.error('[uploadHandler] Erro no upload:', err);
        return res.status(500).json({
          success: false,
          error: 'UPLOAD_ERRO',
          message: 'Erro ao processar o upload do arquivo.',
        });
      }

      return next();
    });
  };
}

// ---------------------------------------------------------------------------
// processImage — middleware de pos-processamento com sharp
// ---------------------------------------------------------------------------

/**
 * Processa a imagem apos o upload:
 *   1. Verifica se e uma imagem (CSV passa direto)
 *   2. Remove metadados EXIF
 *   3. Re-codifica no formato original (elimina payloads embutidos)
 *   4. Redimensiona se exceder MAX_DIMENSION
 *   5. Salva no diretorio de upload com nome UUID
 *   6. Anexa caminho final em req.processedFile
 *
 * Para arquivos CSV, apenas salva com nome UUID sem processamento de imagem.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function processImage(req, res, next) {
  try {
    // Suporta tanto single (req.file) quanto array (req.files[0])
    const file = req.file || (req.files && req.files[0]);

    if (!file) {
      // Nenhum arquivo enviado — prosseguir sem processar
      return next();
    }

    const uploadDir = config.uploadDir || './uploads';

    // Garantir que o diretorio de upload exista
    await fs.promises.mkdir(uploadDir, { recursive: true });

    const uuid = randomUUID();

    // --- CSV: salvar diretamente sem processamento de imagem ---
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      const csvFilename = `${uuid}.csv`;
      const csvPath = path.join(uploadDir, csvFilename);
      await fs.promises.writeFile(csvPath, file.buffer);

      req.processedFile = {
        filename: csvFilename,
        path: csvPath,
        mimetype: 'text/csv',
        size: file.buffer.length,
      };

      return next();
    }

    // --- Imagem: processar com sharp ---
    const sharpFormat = MIME_TO_SHARP_FORMAT[file.mimetype];
    const fileExt = MIME_TO_EXT[file.mimetype] || '.jpg';

    if (!sharpFormat) {
      return res.status(400).json({
        success: false,
        error: 'FORMATO_IMAGEM_DESCONHECIDO',
        message: 'Formato de imagem nao suportado para processamento.',
      });
    }

    // Ler metadados para verificar dimensoes
    const metadata = await sharp(file.buffer).metadata();

    // Pipeline sharp: strip EXIF, re-codificar, redimensionar se necessario
    let pipeline = sharp(file.buffer)
      .rotate()                    // Auto-rotacionar baseado em EXIF antes de remover
      .withMetadata({ exif: {} }); // Remove todos os metadados EXIF

    // Redimensionar se exceder dimensoes maximas
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',            // Manter proporcao, caber dentro do limite
        withoutEnlargement: true, // Nao ampliar imagens menores
      });
    }

    // Re-codificar no formato original (elimina payloads embutidos em chunks)
    const outputOptions = {};
    if (sharpFormat === 'jpeg') {
      outputOptions.quality = 90;
      outputOptions.mozjpeg = true;
    } else if (sharpFormat === 'png') {
      outputOptions.compressionLevel = 8;
    } else if (sharpFormat === 'webp') {
      outputOptions.quality = 90;
    }

    pipeline = pipeline.toFormat(sharpFormat, outputOptions);

    const processedBuffer = await pipeline.toBuffer();

    // Salvar arquivo processado no disco
    const filename = `${uuid}${fileExt}`;
    const filePath = path.join(uploadDir, filename);
    await fs.promises.writeFile(filePath, processedBuffer);

    // Anexar informacoes do arquivo processado na requisicao
    req.processedFile = {
      filename,
      path: filePath,
      mimetype: file.mimetype,
      width: Math.min(metadata.width || 0, MAX_DIMENSION),
      height: Math.min(metadata.height || 0, MAX_DIMENSION),
      size: processedBuffer.length,
    };

    return next();
  } catch (err) {
    // Sharp lanca erro se o buffer nao for uma imagem valida
    if (err.message && err.message.includes('Input buffer contains unsupported image format')) {
      return res.status(400).json({
        success: false,
        error: 'IMAGEM_INVALIDA',
        message: 'O arquivo enviado nao e uma imagem valida ou esta corrompido.',
      });
    }

    console.error('[uploadHandler] Erro ao processar imagem:', err);
    return res.status(500).json({
      success: false,
      error: 'PROCESSAMENTO_IMAGEM_ERRO',
      message: 'Erro interno ao processar a imagem enviada.',
    });
  }
}

module.exports = {
  createUploadMiddleware,
  processImage,
};
