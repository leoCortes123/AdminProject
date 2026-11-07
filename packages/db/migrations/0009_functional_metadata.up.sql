-- 0009_functional_metadata.up.sql — Datos estructurados para CU/reglas/RNF/flujos
-- Hoy los casos de uso, reglas de negocio, requisitos no funcionales y flujos
-- viven como documentos (content_items) con cuerpo Markdown. Esta migración
-- añade una columna `metadata jsonb` tipada por docTypeKey para guardar campos
-- estructurados (actor, precondiciones, flujo principal/alternativo, condición,
-- acción, categoría/métrica/umbral, pasos del flujo) sin perder el versionado,
-- los vínculos a nodos ni las relaciones existentes.
-- Ver docs/adr/ADR-008-datos-funcionales-estructurados.md.

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE item_versions
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Índice GIN para consultas por campos estructurados (p. ej. metadata->>'actor').
CREATE INDEX IF NOT EXISTS content_items_metadata_gin_idx
  ON content_items USING gin (metadata);

-- Backfill defensivo (las columnas ya nacen con default).
UPDATE content_items SET metadata = '{}'::jsonb WHERE metadata IS NULL;
UPDATE item_versions SET metadata = '{}'::jsonb WHERE metadata IS NULL;