import pool from '../config/mysql.js';

// GET /api/notifications?unread=true&limit=20&offset=0
export const getNotifications = async (req, res) => {
  try {
    const { userId } = req.user;
    const { unread, limit = 20, offset = 0 } = req.query;

    let query = 'SELECT * FROM notifications WHERE userId = ?';
    const params = [userId];

    if (unread === 'true') {
      query += ' AND isRead = FALSE';
    }

    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo notificaciones', error: error.message });
  }
};

// GET /api/notifications/unread-count
export const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.user;
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE userId = ? AND isRead = FALSE',
      [userId]
    );
    res.json({ count: rows[0].count });
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo el conteo de notificaciones', error: error.message });
  }
};

// PATCH /api/notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const [result] = await pool.query(
      'UPDATE notifications SET isRead = TRUE WHERE notificationId = ? AND userId = ?',
      [id, userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notificación no encontrada' });
    }
    res.json({ message: 'Notificación marcada como leída' });
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando notificación', error: error.message });
  }
};

// PATCH /api/notifications/read-all
export const markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.user;
    await pool.query('UPDATE notifications SET isRead = TRUE WHERE userId = ? AND isRead = FALSE', [userId]);
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando notificaciones', error: error.message });
  }
};

// DELETE /api/notifications/:id — una sola notificación. Antes solo se
// podían marcar como leídas, nunca borrar (ni desde la campanita ni desde
// ningún otro lado) — pedido explícitamente para que el historial no se
// quede acumulando para siempre sin que el usuario pueda limpiarlo a mano.
export const deleteNotification = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const [result] = await pool.query(
      'DELETE FROM notifications WHERE notificationId = ? AND userId = ?',
      [id, userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notificación no encontrada' });
    }
    res.json({ message: 'Notificación eliminada' });
  } catch (error) {
    res.status(500).json({ message: 'Error eliminando notificación', error: error.message });
  }
};

// DELETE /api/notifications — borra TODO el historial del usuario (botón
// "Eliminar todas" en el historial completo). Acepta ?onlyRead=true para
// borrar solo las ya leídas (usado desde la campanita, más conservador).
export const deleteAllNotifications = async (req, res) => {
  try {
    const { userId } = req.user;
    const { onlyRead } = req.query;
    let query = 'DELETE FROM notifications WHERE userId = ?';
    const params = [userId];
    if (onlyRead === 'true') {
      query += ' AND isRead = TRUE';
    }
    const [result] = await pool.query(query, params);
    res.json({ message: 'Notificaciones eliminadas', deleted: result.affectedRows });
  } catch (error) {
    res.status(500).json({ message: 'Error eliminando notificaciones', error: error.message });
  }
};

const DEFAULT_PREFERENCES = {
  notifyCritical: true,
  notifyHigh: true,
  notifyMedium: false,
  notifyLow: false,
  // Retención del historial de notificaciones: cuántos días se conservan
  // antes de que el borrado automático las limpie solo (ver
  // notificationCleanupJob.js). `null` = nunca se borran solas.
  retentionDays: 30,
};

// GET /api/notifications/preferences
export const getPreferences = async (req, res) => {
  try {
    const { userId } = req.user;
    const [rows] = await pool.query('SELECT * FROM notification_preferences WHERE userId = ?', [userId]);
    if (rows.length === 0) {
      return res.json({ userId, ...DEFAULT_PREFERENCES });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo preferencias', error: error.message });
  }
};

// Valores válidos de retención — cualquier otra cosa que llegue del
// cliente se ignora y se cae al default (30 días), nunca a un número
// arbitrario que el cron de limpieza no espera.
const VALID_RETENTION_DAYS = new Set([7, 30, null]);

function normalizeRetention(value) {
  if (value === null || value === 'null' || value === undefined) {
    return value === undefined ? DEFAULT_PREFERENCES.retentionDays : null;
  }
  const n = Number(value);
  return VALID_RETENTION_DAYS.has(n) ? n : DEFAULT_PREFERENCES.retentionDays;
}

// PUT /api/notifications/preferences
export const updatePreferences = async (req, res) => {
  try {
    const { userId } = req.user;
    const prefs = { ...DEFAULT_PREFERENCES, ...req.body };
    const retentionDays = normalizeRetention(req.body.retentionDays);

    await pool.query(
      `INSERT INTO notification_preferences (userId, notifyCritical, notifyHigh, notifyMedium, notifyLow, retentionDays)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         notifyCritical = VALUES(notifyCritical),
         notifyHigh = VALUES(notifyHigh),
         notifyMedium = VALUES(notifyMedium),
         notifyLow = VALUES(notifyLow),
         retentionDays = VALUES(retentionDays)`,
      [userId, Boolean(prefs.notifyCritical), Boolean(prefs.notifyHigh), Boolean(prefs.notifyMedium), Boolean(prefs.notifyLow), retentionDays]
    );

    res.json({ message: 'Preferencias actualizadas', preferences: { userId, ...prefs, retentionDays } });
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando preferencias', error: error.message });
  }
};
