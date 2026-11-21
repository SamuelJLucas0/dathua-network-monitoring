-- ============================================================
-- DatHua — Script de creación de base de datos (versión final)
-- ============================================================
-- Diseñado para correrse de una sola pasada en una base de datos
-- nueva/vacía. Ya integra:
--   - apiKey de sites incluido desde la creación (antes era un
--     ALTER TABLE aparte, lo que rompía si se corría el script
--     de un jalón en una BD nueva).
--   - Columnas de plan de suscripción y prueba gratuita en
--     organizations (plan, subscriptionStatus, trialEndsAt).
--   - incidents.nodeId como NULL con ON DELETE SET NULL, para
--     conservar el historial de incidentes aunque se borre el
--     nodo (decisión de negocio ya tomada).
-- ============================================================

CREATE DATABASE IF NOT EXISTS dathua;
USE dathua;

-- ------------------------------------------------------------
-- organizations
-- ------------------------------------------------------------
CREATE TABLE organizations (
    orgId               INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    maxFreeZones        INT DEFAULT 3,
    plan                ENUM('BASICO', 'PRO') NOT NULL DEFAULT 'BASICO',
    subscriptionStatus  ENUM('trialing', 'active', 'expired', 'cancelled') NOT NULL DEFAULT 'trialing',
    trialEndsAt         DATETIME NULL,
    status              ENUM('Active', 'Inactive') DEFAULT 'Active',
    createdAt           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE users (
    userId          INT AUTO_INCREMENT PRIMARY KEY,
    orgId           INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    password        VARCHAR(255) NOT NULL,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (orgId) REFERENCES organizations(orgId) ON DELETE CASCADE,
    UNIQUE KEY uq_org_email (orgId, email)
);

-- ------------------------------------------------------------
-- sites  (apiKey ya incluido desde la creación, no como ALTER)
-- ------------------------------------------------------------
CREATE TABLE sites (
    siteId          INT AUTO_INCREMENT PRIMARY KEY,
    orgId           INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    address         VARCHAR(255),
    timezone        VARCHAR(50) DEFAULT 'America/Mexico_City',
    status          ENUM('Normal', 'Warning', 'Critical', 'Offline') DEFAULT 'Normal',
    description     TEXT,
    apiKey          VARCHAR(64) NOT NULL,
    -- Modo mantenimiento (silenciar alertas de IA de TODOS sus equipos):
    -- maintenanceMode = indefinido ("hasta que yo diga"); maintenanceUntil
    -- = silenciado por tiempo limitado (se apaga solo en cuanto pasa esa
    -- fecha, sin necesidad de un cron). Ver migración 006.
    maintenanceMode   BOOLEAN NOT NULL DEFAULT FALSE,
    maintenanceUntil  DATETIME NULL,
    -- Marca de tiempo del botón "Re-escanear" (Nodos y topología) — el
    -- agente la compara contra la última que ya procesó para adelantar su
    -- ciclo de descubrimiento sin esperar a DISCOVERY_INTERVAL. Ver
    -- migración 008.
    rescanRequestedAt DATETIME NULL,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (orgId) REFERENCES organizations(orgId) ON DELETE CASCADE,
    UNIQUE KEY uq_site_apikey (apiKey)
);

-- ------------------------------------------------------------
-- zones
-- ------------------------------------------------------------
CREATE TABLE zones (
    zoneId          INT AUTO_INCREMENT PRIMARY KEY,
    siteId          INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    icon            VARCHAR(30) NOT NULL DEFAULT 'building',
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_zone_site (zoneId, siteId),
    FOREIGN KEY (siteId) REFERENCES sites(siteId) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- nodes
-- ------------------------------------------------------------
CREATE TABLE nodes (
    nodeId          INT AUTO_INCREMENT PRIMARY KEY,
    siteId          INT NOT NULL,
    zoneId          INT DEFAULT NULL,
    parentNodeId    INT DEFAULT NULL,
    name            VARCHAR(100) NOT NULL,
    deviceType      ENUM('router', 'switch', 'access_point', 'camera', 'server', 'endpoint') NOT NULL,
    isRootGateway   BOOLEAN DEFAULT FALSE,
    ipAddress       VARCHAR(45) NOT NULL,
    macAddress      VARCHAR(17),

    snmpEnabled     BOOLEAN DEFAULT FALSE,
    snmpVersion     ENUM('v1', 'v2c', 'v3') DEFAULT 'v2c',
    snmpCommunity   VARCHAR(100) DEFAULT NULL,
    snmpPort        INT DEFAULT 161,
    snmpSecName     VARCHAR(64) DEFAULT NULL,
    snmpSecLevel    ENUM('noAuthNoPriv', 'authNoPriv', 'authPriv') DEFAULT 'noAuthNoPriv',
    snmpAuthProto   ENUM('MD5', 'SHA', 'SHA-256', 'SHA-512') DEFAULT NULL,
    snmpAuthPass    VARCHAR(255) DEFAULT NULL,
    snmpPrivProto   ENUM('DES', 'AES', 'AES-128', 'AES-256') DEFAULT NULL,
    snmpPrivPass    VARCHAR(255) DEFAULT NULL,

    status          ENUM('Online', 'Warning', 'Critical', 'Offline', 'Unknown') DEFAULT 'Unknown',
    lastPingMs      DECIMAL(6, 2) DEFAULT NULL,
    lastSeenAt      TIMESTAMP NULL,
    -- Modo mantenimiento (silenciar alertas de IA de este equipo). Ver
    -- migración 006 y el mismo campo en `sites` (silenciar la sucursal
    -- entera silencia también a todos sus equipos).
    maintenanceMode   BOOLEAN NOT NULL DEFAULT FALSE,
    maintenanceUntil  DATETIME NULL,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (siteId) REFERENCES sites(siteId) ON DELETE CASCADE,
    FOREIGN KEY (zoneId) REFERENCES zones(zoneId) ON DELETE SET NULL,
    FOREIGN KEY (parentNodeId) REFERENCES nodes(nodeId) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- discovery_candidates (dispositivos que el agente descubrió solo en la
-- LAN del cliente; NO cuentan como nodo real ni se facturan hasta que el
-- dueño de la sucursal aprueba uno explícitamente desde el panel)
-- ------------------------------------------------------------
CREATE TABLE discovery_candidates (
    candidateId         INT AUTO_INCREMENT PRIMARY KEY,
    siteId              INT NOT NULL,
    ipAddress           VARCHAR(45) NOT NULL,
    macAddress          VARCHAR(17) DEFAULT NULL,
    hostname            VARCHAR(255) DEFAULT NULL,
    openPorts           JSON DEFAULT NULL,
    suggestedDeviceType ENUM('router', 'switch', 'access_point', 'camera', 'server', 'endpoint') DEFAULT 'endpoint',
    suggestedVendor     VARCHAR(100) DEFAULT NULL,
    status              ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    resolvedNodeId      INT DEFAULT NULL,
    firstSeenAt         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lastSeenAt          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (siteId) REFERENCES sites(siteId) ON DELETE CASCADE,
    FOREIGN KEY (resolvedNodeId) REFERENCES nodes(nodeId) ON DELETE SET NULL,
    UNIQUE KEY uq_site_ip (siteId, ipAddress)
);

-- ------------------------------------------------------------
-- incidents  (nodeId es NULL-able: se conserva el historial
-- aunque el nodo relacionado se elimine — decisión de negocio)
-- ------------------------------------------------------------
CREATE TABLE incidents (
    incidentId          BIGINT AUTO_INCREMENT PRIMARY KEY,
    nodeId              INT NULL,
    siteId              INT NOT NULL,
    severity            VARCHAR(30) NOT NULL DEFAULT 'MEDIUM', -- CRITICAL, HIGH, MEDIUM, LOW, Warning, Info, etc.
    type                VARCHAR(100) NOT NULL,                 -- Admite cualquier etiqueta de la IA o ICMP
    title               VARCHAR(200) NOT NULL,
    message             TEXT NOT NULL,
    mongoAnomalyId      VARCHAR(50) DEFAULT NULL,              -- ObjectId de MongoDB para trazabilidad
    -- Métrica cruda que originó el incidente (avg_ms/loss_percent/
    -- jitter_ms/stddev_ms) — NULL en incidentes manuales. El frontend la
    -- usa para armar la explicación en español simple (causas probables,
    -- sugerencia) sin tener que parsear el texto de `message`. Ver
    -- migración 009 y dathua-api/src/services/incidentCopy.js.
    metricAnalyzed      VARCHAR(30) DEFAULT NULL,
    isResolved          BOOLEAN DEFAULT FALSE,
    startedAt           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolvedAt          TIMESTAMP NULL DEFAULT NULL,

    FOREIGN KEY (nodeId) REFERENCES nodes(nodeId) ON DELETE SET NULL,
    FOREIGN KEY (siteId) REFERENCES sites(siteId) ON DELETE CASCADE
);

CREATE INDEX idx_incidents_active ON incidents (siteId, isResolved, startedAt);
CREATE INDEX idx_incidents_node ON incidents (nodeId, isResolved);
CREATE INDEX idx_incidents_mongo ON incidents (mongoAnomalyId);

-- ------------------------------------------------------------
-- notificaciones — solo los incidentes generan notificación (manual o
-- generado por IA); una anomalía que de verdad importa ya se convierte
-- en incidente, así que no hace falta una segunda fuente de eventos.
-- ------------------------------------------------------------
CREATE TABLE notification_preferences (
    userId          INT PRIMARY KEY,
    notifyCritical  BOOLEAN NOT NULL DEFAULT TRUE,
    notifyHigh      BOOLEAN NOT NULL DEFAULT TRUE,
    notifyMedium    BOOLEAN NOT NULL DEFAULT FALSE,
    notifyLow       BOOLEAN NOT NULL DEFAULT FALSE,
    -- Días que se conserva el historial de notificaciones de este usuario
    -- antes de que el cron de limpieza las borre solas (7 / 30 / NULL =
    -- nunca). Ver notificationCleanupJob.js y migración 007.
    retentionDays   INT NULL DEFAULT 30,
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
    link            VARCHAR(255) DEFAULT NULL,
    isRead          BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
    FOREIGN KEY (incidentId) REFERENCES incidents(incidentId) ON DELETE SET NULL,
    FOREIGN KEY (nodeId) REFERENCES nodes(nodeId) ON DELETE SET NULL
);

CREATE INDEX idx_notifications_user ON notifications (userId, isRead, createdAt);
