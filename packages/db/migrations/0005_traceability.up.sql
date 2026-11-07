-- 0005_traceability.up.sql — Fase 4 · Trazabilidad (M-06, M-07)
-- changes + test_cases/test_results + agent_executions (incipiente 6a) +
-- relaciones endurecidas (kinds change/test_case) + índices de traza.
-- Ver docs/planificacion/04-modelo-datos.md §4.4-§4.5 y 07-plan-implementacion.md §5.

CREATE TABLE changes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id),
  code          text,
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  kind          text NOT NULL DEFAULT 'functional'
                CHECK (kind IN ('functional','technical')),
  status        text NOT NULL DEFAULT 'proposed'
                CHECK (status IN ('proposed','executed')),
  git_repo      text,
  git_branch    text,
  git_sha       text,
  git_pr_url    text,
  git_files     jsonb NOT NULL DEFAULT '[]'::jsonb,
  executed_at   timestamptz,
  created_by    text REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE UNIQUE INDEX changes_id_product_uq ON changes (id, product_id);
CREATE UNIQUE INDEX changes_code_active_uq ON changes (product_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;
CREATE INDEX changes_product_status_idx ON changes (product_id, status);
CREATE INDEX changes_product_created_idx ON changes (product_id, created_at DESC);

CREATE TABLE test_cases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id),
  code          text,
  title         text NOT NULL,
  type          text NOT NULL DEFAULT 'manual'
                CHECK (type IN ('manual','automated','e2e')),
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','draft','archived')),
  created_by    text REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE UNIQUE INDEX test_cases_id_product_uq ON test_cases (id, product_id);
CREATE UNIQUE INDEX test_cases_code_active_uq ON test_cases (product_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;
CREATE INDEX test_cases_product_type_idx ON test_cases (product_id, type);

CREATE TABLE test_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id        uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id),
  status              text NOT NULL
                      CHECK (status IN ('passed','failed','skipped')),
  environment         text,
  notes               text NOT NULL DEFAULT '',
  executed_by_kind    text NOT NULL DEFAULT 'human'
                      CHECK (executed_by_kind IN ('human','agent')),
  executed_by         text REFERENCES users(id),
  service_account_id  uuid,
  executed_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX test_results_case_time_idx ON test_results (test_case_id, executed_at DESC);
CREATE INDEX test_results_product_time_idx ON test_results (product_id, executed_at DESC);

-- agent_executions: incipiente para Fase 6a (auditabilidad sin lógica aún).
-- Append-only desde el día uno: mismo patrón que activity_log.
CREATE TABLE agent_executions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES products(id),
  service_account_id uuid,
  agent_name        text,
  tool_name         text,
  request_summary   text NOT NULL DEFAULT '',
  status            text NOT NULL DEFAULT 'ok'
                    CHECK (status IN ('ok','error','confirmation_required','rejected')),
  idempotency_key   text,
  duration_ms       integer,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX agent_executions_idempotency_uq ON agent_executions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX agent_executions_product_created_idx ON agent_executions (product_id, created_at DESC);
CREATE TRIGGER agent_executions_append_only
  BEFORE UPDATE OR DELETE ON agent_executions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ---------------------------------------------------------------------------
-- Endurecer relations: kinds change/test_case con existencia + producto.
-- (0003: node/item · 0004: + task/issue · 0005: + change/test_case — cierra F4-T02)
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
  ELSIF NEW.source_kind = 'change' THEN
    IF NOT EXISTS (SELECT 1 FROM changes WHERE id = NEW.source_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: source change inexistente o de otro producto';
    END IF;
  ELSIF NEW.source_kind = 'test_case' THEN
    IF NOT EXISTS (SELECT 1 FROM test_cases WHERE id = NEW.source_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: source test_case inexistente o de otro producto';
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
  ELSIF NEW.target_kind = 'change' THEN
    IF NOT EXISTS (SELECT 1 FROM changes WHERE id = NEW.target_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: target change inexistente o de otro producto';
    END IF;
  ELSIF NEW.target_kind = 'test_case' THEN
    IF NOT EXISTS (SELECT 1 FROM test_cases WHERE id = NEW.target_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: target test_case inexistente o de otro producto';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER relations_validate_trigger
  BEFORE INSERT OR UPDATE ON relations
  FOR EACH ROW EXECUTE FUNCTION relations_validate();

-- Índices compuestos para las consultas de traza (product_id primero:
-- el guard de tenant ya filtra por producto; el índice cubre el resto).
CREATE INDEX relations_product_source_idx ON relations (product_id, source_kind, source_id);
CREATE INDEX relations_product_target_idx ON relations (product_id, target_kind, target_id);

-- Vistas de compatibilidad con el prompt §8 (node_relations / item_relations).
CREATE OR REPLACE VIEW node_relations AS
  SELECT * FROM relations WHERE source_kind = 'node' OR target_kind = 'node';
CREATE OR REPLACE VIEW item_relations AS
  SELECT * FROM relations WHERE source_kind = 'item' OR target_kind = 'item';

-- ---------------------------------------------------------------------------
-- comments / attachments: validar también parent/owner change (el CHECK ya
-- incluía 'change' desde 0004; el trigger no lo validaba).
-- ---------------------------------------------------------------------------
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
  ELSIF NEW.parent_kind = 'change' THEN
    SELECT product_id INTO parent_product FROM changes WHERE id = NEW.parent_id;
    IF parent_product IS NULL OR parent_product <> NEW.product_id THEN
      RAISE EXCEPTION 'comments: padre change inexistente o de otro producto';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_validate_trigger
  BEFORE INSERT OR UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION comments_validate();

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
  ELSIF NEW.owner_kind = 'change' THEN
    SELECT product_id INTO owner_product FROM changes WHERE id = NEW.owner_id;
    IF owner_product IS NULL OR owner_product <> NEW.product_id THEN
      RAISE EXCEPTION 'attachments: dueño change inexistente o de otro producto';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attachments_validate_trigger
  BEFORE INSERT OR UPDATE ON attachments
  FOR EACH ROW EXECUTE FUNCTION attachments_validate();
