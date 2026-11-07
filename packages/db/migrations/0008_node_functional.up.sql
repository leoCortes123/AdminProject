-- 0008_node_functional.up.sql — Ficha integral: descripción + objetivo del nodo
-- Cierra la deuda de la Fase 1 (F1-T08 "ficha con tabs vacías"): sin estos
-- campos, las pestañas Resumen/Funcionalidad de Arquitectura funcional no
-- tienen fuente de verdad propia (los CU/reglas/RNF/flujos siguen viviendo
-- en Documentación como elementos documentales, prompt §5.2).
-- Ver docs/planificacion/05-experiencia-usuario.md §4 y muckup/index.html
-- (tab-resumen: fichaDesc · tab-funcionalidad: Objetivo).

ALTER TABLE product_nodes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE product_nodes ADD COLUMN IF NOT EXISTS objective text;

-- ---------------------------------------------------------------------------
-- FTS: la descripción y el objetivo del nodo deben ser buscables.
-- Se redefine product_nodes_set_search_tsv() (0006) incluyendo ambos campos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION product_nodes_set_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector(
    'spanish',
    coalesce(NEW.code, '') || ' ' || NEW.name || ' ' || coalesce(NEW.path::text, '')
      || ' ' || coalesce(NEW.description, '') || ' ' || coalesce(NEW.objective, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill de filas existentes (el trigger solo cubre INSERT/UPDATE futuros).
UPDATE product_nodes SET search_tsv = to_tsvector(
  'spanish',
  coalesce(code, '') || ' ' || name || ' ' || coalesce(path::text, '')
    || ' ' || coalesce(description, '') || ' ' || coalesce(objective, '')
);
