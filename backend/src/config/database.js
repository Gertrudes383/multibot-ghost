/**
 * Configuração de conexão com o MongoDB via Mongoose.
 *
 * Gerencia a conexão, reconexão automática, e eventos de ciclo de vida.
 * Utiliza a URI definida em MONGODB_URI no .env.
 */

const mongoose = require('mongoose');
const config = require('./index');

/**
 * Conecta ao MongoDB com as opções recomendadas para produção.
 * @returns {Promise<mongoose.Connection>}
 */
async function connectDatabase() {
  try {
    const options = {
      // Pool de conexões para multi-tenancy
      maxPoolSize: 10,
      minPoolSize: 2,
      // Timeout de conexão
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Índices automáticos apenas em dev
      autoIndex: config.nodeEnv !== 'production',
    };

    await mongoose.connect(config.mongodbUri, options);

    console.log(`[Database] Conectado ao MongoDB: ${_maskUri(config.mongodbUri)}`);

    // Eventos de ciclo de vida da conexão
    mongoose.connection.on('error', (err) => {
      console.error('[Database] Erro na conexão MongoDB:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[Database] Desconectado do MongoDB. Tentando reconectar...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[Database] Reconectado ao MongoDB com sucesso.');
    });

    // Encerramento gracioso
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('[Database] Conexão MongoDB encerrada (SIGINT).');
      process.exit(0);
    });

    return mongoose.connection;
  } catch (error) {
    console.error('[Database] Falha ao conectar ao MongoDB:', error.message);
    process.exit(1);
  }
}

/**
 * Mascara a URI do MongoDB para logs seguros.
 * @param {string} uri
 * @returns {string}
 */
function _maskUri(uri) {
  try {
    const url = new URL(uri);
    if (url.password) {
      url.password = '****';
    }
    return url.toString();
  } catch {
    return '***masked***';
  }
}

module.exports = { connectDatabase };
