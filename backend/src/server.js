/**
 * Ponto de entrada da aplicação.
 *
 * Responsável por:
 * 1. Conectar ao banco de dados MongoDB
 * 2. Iniciar o servidor HTTP
 * 3. Inicializar o Socket.IO para comunicação em tempo real
 * 4. Tratamento de erros não capturados
 */

const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const jwt = require('jsonwebtoken');

const app = require('./app');
const config = require('./config');
const { connectDatabase } = require('./config/database');
const BotManager = require('./telegram/BotManager');
const telegramService = require('./services/telegram.service');
const broadcastService = require('./services/broadcast.service');

// Criar servidor HTTP a partir do Express
const server = http.createServer(app);

// ============================================================
// Socket.IO — Comunicação em tempo real
// ============================================================

const io = new SocketIOServer(server, {
  cors: {
    origin: config.corsAllowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Ping interval e timeout para detecção de desconexão
  pingInterval: 25000,
  pingTimeout: 20000,
});

// Disponibilizar io globalmente para uso nos serviços
app.set('io', io);

// Autenticacao JWT no handshake do Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
  if (!token) {
    return next(new Error('AUTENTICACAO_NECESSARIA'));
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256', 'HS384', 'HS512'] });
    if (!decoded || !decoded.id) {
      return next(new Error('TOKEN_INVALIDO'));
    }
    socket.user = decoded;
    next();
  } catch (err) {
    return next(new Error(err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO'));
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Cliente conectado: ${socket.id} (user: ${socket.user.id})`);

  // Entrar na sala do bot específico (multi-tenant)
  socket.on('join:bot', (botId) => {
    if (typeof botId === 'string' && botId.length < 50) {
      socket.join(`bot:${botId}`);
      console.log(`[Socket.IO] ${socket.id} entrou na sala bot:${botId}`);
    }
  });

  // Sair da sala do bot
  socket.on('leave:bot', (botId) => {
    if (typeof botId === 'string') {
      socket.leave(`bot:${botId}`);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Cliente desconectado: ${socket.id} (${reason})`);
  });
});

// ============================================================
// Inicialização
// ============================================================

async function startServer() {
  try {
    // 1. Conectar ao MongoDB
    await connectDatabase();

    // 2. Inicializar o Telegram Bot Manager
    const botManager = new BotManager();
    app.set('botManager', botManager);
    telegramService.setBotManager(botManager);
    broadcastService.setBotManager(botManager);

    await botManager.startAll();
    console.log(`[Server] BotManager: ${botManager.getRunningCount()} bots rodando`);

    // 3. Iniciar o servidor HTTP
    server.listen(config.port, () => {
      console.log('============================================================');
      console.log(`  MultiBots API v1.0.0`);
      console.log(`  Ambiente: ${config.nodeEnv}`);
      console.log(`  Porta: ${config.port}`);
      console.log(`  URL: ${config.apiUrl}`);
      console.log(`  Bots: ${botManager.getRunningCount()} ativos`);
      console.log('============================================================');
    });
  } catch (error) {
    console.error('[Server] Falha ao iniciar:', error.message);
    process.exit(1);
  }
}

// ============================================================
// Tratamento de erros globais
// ============================================================

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  // Encerrar graciosamente
  server.close(() => {
    process.exit(1);
  });
  // Forçar encerramento após 10s
  setTimeout(() => process.exit(1), 10000);
});

// Encerramento gracioso
const gracefulShutdown = async (signal) => {
  console.log(`[Server] ${signal} recebido. Encerrando graciosamente...`);
  const botManager = app.get('botManager');
  if (botManager) {
    await botManager.shutdown();
  }
  server.close(() => {
    console.log('[Server] Servidor encerrado.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Iniciar
startServer();

module.exports = { server, io };
