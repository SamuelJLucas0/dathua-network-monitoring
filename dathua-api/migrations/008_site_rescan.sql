-- Botón "Re-escanear" en Nodos y topología: el dueño pide un descubrimiento
-- inmediato sin tener que reiniciar el agente completo. El agente ya
-- consulta `GET /nodes/worker/active` cada POLL_INTERVAL (20s) para el
-- monitoreo de ping — el mismo endpoint ahora también devuelve esta marca
-- de tiempo, y el agente compara contra la última que ya procesó para
-- saber si debe adelantar su ciclo de descubrimiento (que de otro modo
-- solo corre cada DISCOVERY_INTERVAL, 30 min por default).
ALTER TABLE sites
  ADD COLUMN rescanRequestedAt DATETIME NULL;
