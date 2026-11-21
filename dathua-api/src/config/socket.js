import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from './mysql.js';

let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // En producción puedes restringir al dominio de tu frontend Vue
      methods: ['GET', 'POST']
    }
  });

  // Sin esto, cualquiera (ni siquiera necesita cuenta) podía abrir una
  // conexión de Socket.IO, unirse a la sala de CUALQUIER sucursal con solo
  // adivinar un siteId, y recibir en vivo la telemetría/incidentes de una
  // organización ajena — el mismo tipo de fuga multi-tenant que ya mordió
  // este proyecto en los controladores REST (ver CLAUDE.md sección 6).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No autenticado'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.orgId = payload.orgId;
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Token inválido o expirado'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado vía WebSocket: ${socket.id} (org ${socket.orgId})`);

    // Sala personal para notificaciones — no hace falta un evento
    // explícito de "join" porque ya sabemos de quién es el socket por el
    // JWT del handshake, y nadie más puede unirse a ella (no depende de
    // un id adivinable como las salas de sucursal).
    socket.join(`user_${socket.userId}`);

    // Unirse a la sala de una sucursal exige que esa sucursal sea de la
    // MISMA organización del token — igual aislamiento que cualquier
    // endpoint REST de sites/nodes/incidents.
    socket.on('join:site', async (siteId) => {
      try {
        const [rows] = await pool.query(
          'SELECT siteId FROM sites WHERE siteId = ? AND orgId = ?',
          [siteId, socket.orgId]
        );
        if (rows.length === 0) return;
        const room = `site_${siteId}`;
        socket.join(room);
        console.log(`📍 Socket ${socket.id} se unió a la sala: ${room}`);
      } catch (error) {
        console.error('⚠️ Error validando join:site:', error.message);
      }
    });

    // Desuscribirse de una sucursal
    socket.on('leave:site', (siteId) => {
      const room = `site_${siteId}`;
      socket.leave(room);
      console.log(`🚪 Socket ${socket.id} salió de la sala: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io no ha sido inicializado aún.');
  }
  return io;
};

/**
 * Emite métricas en tiempo real a la sala de la sucursal dueña de esos
 * datos. Ya no hay un `io.emit(...)` global paralelo — ese "broadcast" le
 * mandaba la telemetría de TODAS las organizaciones a TODOS los clientes
 * conectados, sin importar de qué organización fueran.
 */
export const emitTelemetryUpdate = (siteId, metrics) => {
  if (!io) return;
  io.to(`site_${siteId}`).emit('telemetry:new', metrics);
};

/**
 * Emite un nuevo incidente en tiempo real, solo a la sala de su sucursal.
 */
export const emitNewIncident = (siteId, incidentData) => {
  if (!io) return;
  io.to(`site_${siteId}`).emit('incident:new', incidentData);
};

/**
 * Emite una nueva anomalía de IA en tiempo real, solo a la sala de su
 * sucursal — para que IA Sentinel se refresque solo sin que el usuario
 * tenga que recargar la página.
 */
export const emitNewAnomaly = (siteId, anomalyData) => {
  if (!io) return;
  io.to(`site_${siteId}`).emit('anomaly:new', anomalyData);
};

/**
 * Notificación personal — solo le llega al usuario dueño de la sala
 * `user_${userId}`, sin importar qué sucursal esté viendo en ese momento.
 */
export const emitNotification = (userId, notification) => {
  if (!io) return;
  io.to(`user_${userId}`).emit('notification:new', notification);
};

/**
 * Aviso de que el agente terminó un ciclo de descubrimiento en esta
 * sucursal — el dashboard escucha esto para refrescar "Equipos
 * descubiertos" solo, sin recargar la página a mano. `pendingCount` es
 * cuántos candidatos quedan pendientes de revisar justo después de este
 * envío — el botón "Re-escanear" lo usa para saber si el escaneo
 * encontró algo nuevo o no, y así terminar su animación de carga con el
 * mensaje correcto.
 */
export const emitDiscoveryUpdate = (siteId, pendingCount = null) => {
  if (!io) return;
  io.to(`site_${siteId}`).emit('discovery:new', { siteId, pendingCount });
};
