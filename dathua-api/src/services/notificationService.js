import pool from '../config/mysql.js';
import { emitNotification } from '../config/socket.js';

// A qué columna de notification_preferences corresponde cada severidad de
// incidente. INFO (solo posible en creación manual) cae en el mismo balde
// que LOW — no amerita una quinta casilla de configuración.
const PREF_COLUMN = {
  CRITICAL: 'notifyCritical',
  HIGH: 'notifyHigh',
  MEDIUM: 'notifyMedium',
  LOW: 'notifyLow',
  INFO: 'notifyLow',
};

// Los mismos defaults que la migración le pone a una fila nueva — se usan
// aquí cuando un usuario todavía no tiene fila en notification_preferences
// (nunca visitó "Mi perfil" a configurar nada).
const DEFAULTS = { notifyCritical: true, notifyHigh: true, notifyMedium: false, notifyLow: false };

class NotificationService {
  // Solo los incidentes generan notificación (manual o generado por IA) —
  // ver migración 005 para el porqué. Se llama después de insertar el
  // incidente en MySQL; si algo aquí falla, no debe tumbar la creación del
  // incidente en sí (por eso el caller la envuelve o esta función atrapa
  // sus propios errores).
  static async notifyIncident({ incidentId, orgId, siteId, nodeId, severity, title, message }) {
    try {
      const prefKey = PREF_COLUMN[String(severity).toUpperCase()] || 'notifyLow';

      const [users] = await pool.query(
        `SELECT u.userId, np.notifyCritical, np.notifyHigh, np.notifyMedium, np.notifyLow
         FROM users u
         LEFT JOIN notification_preferences np ON np.userId = u.userId
         WHERE u.orgId = ?`,
        [orgId]
      );

      const link = nodeId ? `/dashboard/nodes/${nodeId}` : '/dashboard/incidents';

      const targets = users.filter((u) => {
        const raw = u[prefKey];
        return raw === null || raw === undefined ? DEFAULTS[prefKey] : Boolean(raw);
      });

      for (const u of targets) {
        const [result] = await pool.query(
          `INSERT INTO notifications (userId, orgId, incidentId, nodeId, siteId, severity, title, message, link)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [u.userId, orgId, incidentId, nodeId || null, siteId || null, severity, title, message, link]
        );

        emitNotification(u.userId, {
          notificationId: result.insertId,
          incidentId,
          nodeId: nodeId || null,
          siteId: siteId || null,
          severity,
          title,
          message,
          link,
          isRead: false,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('⚠️ Error generando notificaciones:', error.message);
    }
  }
}

export default NotificationService;
