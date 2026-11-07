-- 0006_followup.up.sql — Fase 5 · Seguimiento (M-08)
-- F5-T05: FTS español global (tasks/issues/changes/test_cases/nodes) con
-- GIN + triggers; F5-T03: índice para paginación por cursor en activity_log;
-- deuda F4: test_results append-only (trigger forbid_mutation).
-- Ver docs/planificacion/07-plan-implementacion.md §6 y HANDOFF Fase 5.

-- ---------------------------------------------------------------------------
-- F5-T03 · Activity feed: cursor (created_at, id) estable con índice dedicado.
-- (activity_log_product_created_idx ya existía; este densifica para cursor.)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS activity_log_product_cursor_idx
  ON activity_log (product_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS activity_log_product_actor_created_idx
  ON activity_log (product_id, actor_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- Deuda F4 (§2C HANDOFF): test_results append-only desde el día uno.
-- ---------------------------------------------------------------------------
CREATE TRIGGER test_results_append_only
  BEFORE UPDATE OR DELETE ON test_results
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ---------------------------------------------------------------------------
-- F5-T05 · Búsqueda global completa: search_tsv en tasks/issues/changes/
-- test_cases/product_nodes (content_items ya lo tenía desde 0003).
-- ---------------------------------------------------------------------------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_tsv tsvector;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS search_tsv tsvector;
ALTER TABLE changes ADD COLUMN IF NOT EXISTS search_tsv tsvector;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS search_tsv tsvector;
ALTER TABLE product_nodes ADD COLUMN IF NOT EXISTS search_tsv tsvector;

CREATE INDEX IF NOT EXISTS tasks_search_gin ON tasks USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS issues_search_gin ON issues USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS changes_search_gin ON changes USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS test_cases_search_gin ON test_cases USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS product_nodes_search_gin ON product_nodes USING GIN (search_tsv);

CREATE OR REPLACE FUNCTION tasks_set_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector(
    'spanish',
    coalesce(NEW.code, '') || ' ' || NEW.title || ' ' || coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION issues_set_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector(
    'spanish',
    coalesce(NEW.code, '') || ' ' || NEW.title || ' ' || coalesce(NEW.description, '')
      || ' ' || coalesce(NEW.expected_behavior, '') || ' ' || coalesce(NEW.observed_behavior, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION changes_set_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector(
    'spanish',
    coalesce(NEW.code, '') || ' ' || NEW.title || ' ' || coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION test_cases_set_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector(
    'spanish',
    coalesce(NEW.code, '') || ' ' || NEW.title
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION product_nodes_set_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector(
    'spanish',
    coalesce(NEW.code, '') || ' ' || NEW.name || ' ' || coalesce(NEW.path::text, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_search_tsv_trigger ON tasks;
DROP TRIGGER IF EXISTS issues_search_tsv_trigger ON issues;
DROP TRIGGER IF EXISTS changes_search_tsv_trigger ON changes;
DROP TRIGGER IF EXISTS test_cases_search_tsv_trigger ON test_cases;
DROP TRIGGER IF EXISTS product_nodes_search_tsv_trigger ON product_nodes;

CREATE TRIGGER tasks_search_tsv_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_set_search_tsv();
CREATE TRIGGER issues_search_tsv_trigger
  BEFORE INSERT OR UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION issues_set_search_tsv();
CREATE TRIGGER changes_search_tsv_trigger
  BEFORE INSERT OR UPDATE ON changes
  FOR EACH ROW EXECUTE FUNCTION changes_set_search_tsv();
CREATE TRIGGER test_cases_search_tsv_trigger
  BEFORE INSERT OR UPDATE ON test_cases
  FOR EACH ROW EXECUTE FUNCTION test_cases_set_search_tsv();
CREATE TRIGGER product_nodes_search_tsv_trigger
  BEFORE INSERT OR UPDATE ON product_nodes
  FOR EACH ROW EXECUTE FUNCTION product_nodes_set_search_tsv();

-- Backfill de filas existentes (los triggers solo cubren INSERT/UPDATE futuros).
UPDATE tasks SET search_tsv = to_tsvector(
  'spanish',
  coalesce(code, '') || ' ' || title || ' ' || coalesce(description, '')
);
UPDATE issues SET search_tsv = to_tsvector(
  'spanish',
  coalesce(code, '') || ' ' || title || ' ' || coalesce(description, '')
    || ' ' || coalesce(expected_behavior, '') || ' ' || coalesce(observed_behavior, '')
);
UPDATE changes SET search_tsv = to_tsvector(
  'spanish',
  coalesce(code, '') || ' ' || title || ' ' || coalesce(description, '')
);
UPDATE test_cases SET search_tsv = to_tsvector(
  'spanish',
  coalesce(code, '') || ' ' || title
);
UPDATE product_nodes SET search_tsv = to_tsvector(
  'spanish',
  coalesce(code, '') || ' ' || name || ' ' || coalesce(path::text, '')
);
