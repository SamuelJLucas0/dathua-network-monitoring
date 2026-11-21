import cron from 'node-cron';
import pool from '../config/mysql.js';

// Borra el historial de notificaciones más viejo que la retención que cada
// usuario eligió en "Mi perfil" (7 días / 30 días / nunca — ver
// notification_preferences.retentionDays, migración 007). Antes el
// historial no se borraba nunca por sí solo: crecía para siempre y la
// única forma de limpiarlo era manualmente, notificación por notificación.
async function cleanupExpiredNotifications() {
  const [result] = await pool.query(
    `DELETE n FROM notifications n
     INNER JOIN notification_preferences p ON p.userId = n.userId
     WHERE p.retentionDays IS NOT NULL
       AND n.createdAt < DATE_SUB(NOW(), INTERVAL p.retentionDays DAY)`
  );
  if (result.affectedRows > 0) {
    console.log(`🧹 [Cron Job] ${result.affectedRows} notificación(es) vieja(s) eliminada(s) por retención.`);
  }
  return result.affectedRows;
}

export const startNotificationCleanupJob = () => {
  // Una vez al día basta — la retención se mide en días, no en minutos.
  cron.schedule('0 3 * * *', async () => {
    try {
      await cleanupExpiredNotifications();
    } catch (error) {
      console.error('⚠️ [Cron Job] Error limpiando notificaciones vencidas:', error.message);
    }
  });

  console.log('⏳ Limpieza de notificaciones por retención activa (frecuencia: diaria, 03:00)');
};

// Exportado aparte para poder probarlo/dispararlo a mano sin esperar al cron.
export { cleanupExpiredNotifications };
