-- ============================================================
-- Migración 002: Planes de suscripción, prueba gratuita
-- y corrección de la FK de incidents.nodeId
-- ============================================================
-- Ejecutar contra la base de datos ya existente ("dathua").
-- Está escrita para ser segura de correr una sola vez; si ya
-- aplicaste parte de esto a mano, ajusta lo que corresponda.
-- ============================================================

USE dathua;

-- 1) Plan y estado de suscripción por organización -----------
ALTER TABLE organizations
  ADD COLUMN plan ENUM('BASICO', 'PRO') NOT NULL DEFAULT 'BASICO' AFTER maxFreeZones,
  ADD COLUMN subscriptionStatus ENUM('trialing', 'active', 'expired', 'cancelled') NOT NULL DEFAULT 'trialing' AFTER plan,
  ADD COLUMN trialEndsAt DATETIME NULL AFTER subscriptionStatus;

-- Organizaciones que ya existían antes de esta migración: les damos
-- 30 días de prueba a partir de HOY para no dejarlas bloqueadas de golpe.
UPDATE organizations
SET trialEndsAt = DATE_ADD(NOW(), INTERVAL 30 DAY)
WHERE trialEndsAt IS NULL;

-- 2) Decisión de negocio: conservar el historial de incidentes -------
--    aunque el nodo relacionado se elimine (ON DELETE SET NULL en vez
--    de CASCADE). Para esto, nodeId debe admitir NULL.
ALTER TABLE incidents
  DROP FOREIGN KEY incidents_ibfk_1;

ALTER TABLE incidents
  MODIFY COLUMN nodeId INT NULL;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_ibfk_1
  FOREIGN KEY (nodeId) REFERENCES nodes(nodeId) ON DELETE SET NULL;

-- Nota: el nombre "incidents_ibfk_1" es el que MySQL genera por
-- convención para la primera FK declarada en la tabla. Si tu FK real
-- tiene otro nombre, revísalo con:
--   SHOW CREATE TABLE incidents;
-- y ajusta el nombre en el DROP FOREIGN KEY de arriba antes de correr
-- este script.
