-- ============================================================
-- Migración 007: Retención configurable del historial de notificaciones
-- ============================================================
-- El historial de notificaciones (tabla `notifications`) se quedaba
-- acumulando para siempre, sin forma de limpiarlo salvo borrando una por
-- una. Se agrega `retentionDays` en `notification_preferences` (7 / 30 /
-- NULL = nunca) y un cron diario (ver notificationCleanupJob.js) que
-- borra las notificaciones de cada usuario más viejas que su preferencia.
-- Ejecutar contra la base de datos ya existente ("dathua").
-- ============================================================

USE dathua;

ALTER TABLE notification_preferences
    ADD COLUMN retentionDays INT NULL DEFAULT 30;
