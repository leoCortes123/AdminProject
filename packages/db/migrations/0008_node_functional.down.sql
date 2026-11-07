-- 0008_node_functional.down.sql — revierte la ficha funcional (orden inverso)
-- Restaura la función FTS de 0006 (sin description/objective) y elimina las
-- columnas. No se borra el trigger: 0006 sigue vivo.

CREATE OR REPLACE FUNCTION product_nodes_set_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector(
    'spanish',
    coalesce(NEW.code, '') || ' ' || NEW.name || ' ' || coalesce(NEW.path::text, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE product_nodes SET search_tsv = to_tsvector(
  'spanish',
  coalesce(code, '') || ' ' || name || ' ' || coalesce(path::text, '')
);

ALTER TABLE product_nodes DROP COLUMN IF EXISTS objective;
ALTER TABLE product_nodes DROP COLUMN IF EXISTS description;
