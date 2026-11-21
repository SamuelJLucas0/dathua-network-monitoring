-- ============================================================
-- Migración 004: Ícono personalizado por zona
-- ============================================================
-- Cada zona ahora puede elegir un ícono (piso, bodega, oficina, etc.)
-- para que la tarjeta de la zona en "Sucursales y zonas" se distinga
-- de un vistazo en vez de verse como una simple etiqueta con texto.
-- Ejecutar contra la base de datos ya existente ("dathua").
-- ============================================================

USE dathua;

ALTER TABLE zones
  ADD COLUMN icon VARCHAR(30) NOT NULL DEFAULT 'building' AFTER description;
