-- 0004_work.up.sql — Fase 3 · Trabajo (M-04, M-05)
-- tasks + issues (workflow configurables) + extensión de triggers
-- relations/comments/attachments para kinds task/issue.
-- Ver docs/planificacion/04-modelo-datos.md §4.4 y §4.5 y 07-plan-implementacion.md §4.

CREATE TABLE tasks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL REFERENCES products(id),
  code                  text,
  title                 text NOT NULL,
  description           text NOT NULL DEFAULT '',
  type                  text NOT NULL DEFAULT 'development'
                        CHECK (type IN ('development','analysis','documentation','maintenance')),
  state_id              uuid NOT NULL REFERENCES workflow_states(id),
  priority              text NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('critical','high','medium','low')),
  assignee_id           text REFERENCES users(id),
  estimate_minutes      integer,
  acceptance_criteria   jsonb NOT NULL DEFAULT '[]'::jsonb,
  due_date              date,
  created_by            text REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  deleted_at            timestamptz
);
CREATE UNIQUE INDEX tasks_id_product_uq ON tasks (id, product_id);
CREATE UNIQUE INDEX tasks_code_active_uq ON tasks (product_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;
CREATE INDEX tasks_product_state_idx ON tasks (product_id, state_id);
CREATE INDEX tasks_product_assignee_idx ON tasks (product_id, assignee_id)
  WHERE completed_at IS NULL;
CREATE INDEX tasks_product_due_idx ON tasks (product_id, due_date);

CREATE TABLE issues (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL REFERENCES products(id),
  code                  text,
  title                 text NOT NULL,
  description           text NOT NULL DEFAULT '',
  expected_behavior     text NOT NULL DEFAULT '',
  observed_behavior     text NOT NULL DEFAULT '',
  reproduction_steps    jsonb NOT NULL DEFAULT '[]'::jsonb,
  severity              text NOT NULL DEFAULT 'medium'
                        CHECK (severity IN ('critical','high','medium','low')),
  priority              text NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('critical','high','medium','low')),
  state_id              uuid NOT NULL REFERENCES workflow_states(id),
  assignee_id           text REFERENCES users(id),
  reopen_count          integer NOT NULL DEFAULT 0,
  created_by            text REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  resolved_at           timestamptz,
  deleted_at            timestamptz
);
CREATE UNIQUE INDEX issues_id_product_uq ON issues (id, product_id);
CREATE UNIQUE INDEX issues_code_active_uq ON issues (product_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;
CREATE INDEX issues_product_state_idx ON issues (product_id, state_id);
CREATE INDEX issues_product_severity_idx ON issues (product_id, severity);
CREATE INDEX issues_product_assignee_idx ON issues (product_id, assignee_id)
  WHERE resolved_at IS NULL;

-- ---------------------------------------------------------------------------
-- Extensión de relations: kinds task/issue con validación de existencia.
-- Fila base creada en 0003 (kinds node/item). Fase 4 endurecerá change/test_case.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS relations_validate_trigger ON relations;
DROP FUNCTION IF EXISTS relations_validate();

CREATE OR REPLACE FUNCTION relations_validate() RETURNS trigger AS $$
BEGIN
  IF NEW.source_kind = NEW.target_kind AND NEW.source_id = NEW.target_id THEN
    RAISE EXCEPTION 'relations: auto-relación prohibida';
  END IF;
  IF NEW.source_kind = 'node' THEN
    IF NOT EXISTS (SELECT 1 FROM product_nodes WHERE id = NEW.source_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: source node inexistente o de otro producto';
    END IF;
  ELSIF NEW.source_kind = 'item' THEN
    IF NOT EXISTS (SELECT 1 FROM content_items WHERE id = NEW.source_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: source item inexistente o de otro producto';
    END IF;
  ELSIF NEW.source_kind = 'task' THEN
    IF NOT EXISTS (SELECT 1 FROM tasks WHERE id = NEW.source_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: source task inexistente o de otro producto';
    END IF;
  ELSIF NEW.source_kind = 'issue' THEN
    IF NOT EXISTS (SELECT 1 FROM issues WHERE id = NEW.source_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: source issue inexistente o de otro producto';
    END IF;
  END IF;
  IF NEW.target_kind = 'node' THEN
    IF NOT EXISTS (SELECT 1 FROM product_nodes WHERE id = NEW.target_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: target node inexistente o de otro producto';
    END IF;
  ELSIF NEW.target_kind = 'item' THEN
    IF NOT EXISTS (SELECT 1 FROM content_items WHERE id = NEW.target_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: target item inexistente o de otro producto';
    END IF;
  ELSIF NEW.target_kind = 'task' THEN
    IF NOT EXISTS (SELECT 1 FROM tasks WHERE id = NEW.target_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: target task inexistente o de otro producto';
    END IF;
  ELSIF NEW.target_kind = 'issue' THEN
    IF NOT EXISTS (SELECT 1 FROM issues WHERE id = NEW.target_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: target issue inexistente o de otro producto';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER relations_validate_trigger
  BEFORE INSERT OR UPDATE ON relations
  FOR EACH ROW EXECUTE FUNCTION relations_validate();

-- ---------------------------------------------------------------------------
-- Extensión de comments: parent_kind item/task/issue (change llega en Fase 4).
-- ---------------------------------------------------------------------------
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_parent_kind_check;
ALTER TABLE comments ADD CONSTRAINT comments_parent_kind_check
  CHECK (parent_kind IN ('item','task','issue','change'));

DROP TRIGGER IF EXISTS comments_validate_trigger ON comments;
DROP FUNCTION IF EXISTS comments_validate();

CREATE OR REPLACE FUNCTION comments_validate() RETURNS trigger AS $$
DECLARE
  parent_product uuid;
BEGIN
  IF NEW.parent_kind = 'item' THEN
    SELECT product_id INTO parent_product FROM content_items WHERE id = NEW.parent_id;
    IF parent_product IS NULL OR parent_product <> NEW.product_id THEN
      RAISE EXCEPTION 'comments: padre item inexistente o de otro producto';
    END IF;
  ELSIF NEW.parent_kind = 'task' THEN
    SELECT product_id INTO parent_product FROM tasks WHERE id = NEW.parent_id;
    IF parent_product IS NULL OR parent_product <> NEW.product_id THEN
      RAISE EXCEPTION 'comments: padre task inexistente o de otro producto';
    END IF;
  ELSIF NEW.parent_kind = 'issue' THEN
    SELECT product_id INTO parent_product FROM issues WHERE id = NEW.parent_id;
    IF parent_product IS NULL OR parent_product <> NEW.product_id THEN
      RAISE EXCEPTION 'comments: padre issue inexistente o de otro producto';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_validate_trigger
  BEFORE INSERT OR UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION comments_validate();

-- ---------------------------------------------------------------------------
-- Extensión de attachments: owner_kind item/task/issue (change llega en Fase 4).
-- ---------------------------------------------------------------------------
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_owner_kind_check;
ALTER TABLE attachments ADD CONSTRAINT attachments_owner_kind_check
  CHECK (owner_kind IN ('item','task','issue','change'));

DROP TRIGGER IF EXISTS attachments_validate_trigger ON attachments;
DROP FUNCTION IF EXISTS attachments_validate();

CREATE OR REPLACE FUNCTION attachments_validate() RETURNS trigger AS $$
DECLARE
  owner_product uuid;
BEGIN
  IF NEW.owner_kind = 'item' THEN
    SELECT product_id INTO owner_product FROM content_items WHERE id = NEW.owner_id;
    IF owner_product IS NULL OR owner_product <> NEW.product_id THEN
      RAISE EXCEPTION 'attachments: dueño item inexistente o de otro producto';
    END IF;
  ELSIF NEW.owner_kind = 'task' THEN
    SELECT product_id INTO owner_product FROM tasks WHERE id = NEW.owner_id;
    IF owner_product IS NULL OR owner_product <> NEW.product_id THEN
      RAISE EXCEPTION 'attachments: dueño task inexistente o de otro producto';
    END IF;
  ELSIF NEW.owner_kind = 'issue' THEN
    SELECT product_id INTO owner_product FROM issues WHERE id = NEW.owner_id;
    IF owner_product IS NULL OR owner_product <> NEW.product_id THEN
      RAISE EXCEPTION 'attachments: dueño issue inexistente o de otro producto';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attachments_validate_trigger
  BEFORE INSERT OR UPDATE ON attachments
  FOR EACH ROW EXECUTE FUNCTION attachments_validate();
