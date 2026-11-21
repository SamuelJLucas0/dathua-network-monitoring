-- Modo mantenimiento (silenciar alertas) por equipo y por sucursal.
--
-- maintenanceMode = TRUE  -> silenciado indefinidamente ("hasta que yo diga").
-- maintenanceUntil = fecha futura -> silenciado por tiempo limitado, se
--   considera "fuera de mantenimiento" en cuanto esa fecha ya pasó (no hace
--   falta un cron para "apagarlo": el chequeo es siempre `> NOW()`).
-- Ambos pueden estar activos a la vez si el usuario primero puso un tiempo
-- límite y luego decide dejarlo indefinido; se consideran con OR.

ALTER TABLE nodes
  ADD COLUMN maintenanceMode BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN maintenanceUntil DATETIME NULL;

ALTER TABLE sites
  ADD COLUMN maintenanceMode BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN maintenanceUntil DATETIME NULL;
