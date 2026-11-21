import http from 'http';
import app from './app.js';
import { testMySQLConnection } from './config/mysql.js';
import { connectMongoDB } from './config/mongo.js';
import { startAIScheduler } from './jobs/aiScheduler.js';
import { startNotificationCleanupJob } from './jobs/notificationCleanupJob.js';
import { initSocket } from './config/socket.js';
import 'dotenv/config';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await testMySQLConnection();
  await connectMongoDB();

  // 1. Crear servidor HTTP nativo
  const httpServer = http.createServer(app);

  // 2. Inicializar WebSockets
  initSocket(httpServer);
  console.log('⚡ Capa de WebSockets (Socket.IO) inicializada');

  // 3. Iniciar tareas en segundo plano
  startAIScheduler();
  startNotificationCleanupJob();

  // 4. Escuchar sobre httpServer (no sobre app.listen)
  httpServer.listen(PORT, () => {
    console.log(`🚀 Servidor Dathua API escuchando en http://localhost:${PORT}`);
  });
};

startServer();