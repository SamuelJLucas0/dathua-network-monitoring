-- ============================================================
-- Migración 005: Sistema de notificaciones
-- ============================================================
-- Notificaciones persistidas (no solo un evento de socket que se pierde
-- si nadie estaba conectado) para que:
--   1. Un usuario vea su historial aunque no haya estado viendo el
--      dashboard cuando pasó.
--   2. La futura app móvil pueda pedir "notificaciones no leídas" por API
--      igual que el dashboard web, sin depender de que el socket llegue
--      en el momento exacto (push real se conecta sobre esto después).
-- Solo incidentes generan notificación (manual o generado por IA) — una
-- anomalía de IA que de verdad importa ya se convierte en incidente, así
-- que no hace falta una segunda fuente de eventos para no duplicar ruido.
-- Ejecutar contra la base de datos ya existente ("dathua").
-- ============================================================

USE dathua;

CREATE TABLE notification_preferences (
    userId          INT PRIMARY KEY,
    notifyCritical  BOOLEAN NOT NULL DEFAULT TRUE,
    notifyHigh      BOOLEAN NOT NULL DEFAULT TRUE,
    notifyMedium    BOOLEAN NOT NULL DEFAULT FALSE,
    notifyLow       BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);

CREATE TABLE notifications (
    notificationId  BIGINT AUTO_INCREMENT PRIMARY KEY,
    userId          INT NOT NULL,
    orgId           INT NOT NULL,
    incidentId      BIGINT DEFAULT NULL,
    nodeId          INT DEFAULT NULL,
    siteId          INT DEFAULT NULL,
    severity        VARCHAR(30) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,
    link            VARCHAR(255) DEFAULT NULL, -- ruta del frontend a la que lleva el click (p.ej. /dashboard/nodes/15)
    isRead          BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
    FOREIGN KEY (incidentId) REFERENCES incidents(incidentId) ON DELETE SET NULL,
    FOREIGN KEY (nodeId) REFERENCES nodes(nodeId) ON DELETE SET NULL
);

CREATE INDEX idx_notifications_user ON notifications (userId, isRead, createdAt);
