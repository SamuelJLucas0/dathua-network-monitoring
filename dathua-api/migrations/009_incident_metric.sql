-- Antes el incidente solo guardaba `title`/`message` con la métrica
-- incrustada en el texto (frágil de leer de vuelta) — se agrega la
-- métrica cruda como su propia columna para que el frontend pueda armar
-- la explicación (causas probables/sugerencia) sin tener que parsear el
-- mensaje. Incidentes manuales la dejan en NULL (no aplica).
ALTER TABLE incidents
  ADD COLUMN metricAnalyzed VARCHAR(30) NULL;
