-- ============================================================
-- Migración 003: Candidatos de descubrimiento de dispositivos
-- ============================================================
-- El agente ahora puede descubrir dispositivos nuevos en la LAN del
-- cliente automáticamente, pero NO se dan de alta como nodos reales de
-- una vez: quedan aquí como "candidatos" hasta que el dueño de la
-- sucursal los aprueba desde el panel (evita facturar nodos extra sin
-- consentimiento). Ejecutar contra la base de datos ya existente
-- ("dathua").
-- ============================================================

USE dathua;

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
