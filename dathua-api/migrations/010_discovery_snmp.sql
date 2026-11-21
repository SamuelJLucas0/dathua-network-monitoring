-- Evidencia SNMP recolectada por el agente para equipo ADMINISTRADO
-- (routers/switches/APs/servidores con SNMP habilitado) — la mayoría de
-- los candidatos seguirán sin nada aquí (switch no administrado, cámara,
-- endpoint) y eso es normal, no un error. `lldpNeighbors` guarda la
-- adyacencia real reportada por LLDP-MIB (lldpRemTable): de dónde salió
-- ese candidato en el mapa de la red, no solo qué es.
ALTER TABLE discovery_candidates
  ADD COLUMN snmpReachable   BOOLEAN DEFAULT FALSE,
  ADD COLUMN snmpSysDescr    VARCHAR(500) DEFAULT NULL,
  ADD COLUMN snmpSysObjectId VARCHAR(100) DEFAULT NULL,
  ADD COLUMN snmpSysName     VARCHAR(255) DEFAULT NULL,
  ADD COLUMN lldpNeighbors   JSON DEFAULT NULL;
