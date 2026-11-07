-- 0003_documents.up.sql — Fase 2 · Conocimiento (M-03)
-- content_items (supertipo documental) + item_versions (append-only) +
-- item_node_links (N:M doc↔nodo) + relations base (doc↔doc, triggers node/item) +
-- comments base + attachments (con StoragePort en apps/api).
-- Ver docs/planificacion/04-modelo-datos.md §4.3 y §4.5 y 07-plan-implementacion.md §3.

CREATE TABLE content_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES products(id),
  doc_type_id     uuid NOT NULL REFERENCES document_types(id),
  code            text,
  title           text NOT NULL,
  body_markdown   text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','in_review','published','archived')),
  scope           text NOT NULL DEFAULT 'node'
                  CHECK (scope IN ('node','global')),
  version         integer NOT NULL DEFAULT 1,
  search_tsv      tsvector,
  created_by      text REFERENCES users(id),
  updated_by      text REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE UNIQUE INDEX content_items_id_product_uq ON content_items (id, product_id);
CREATE UNIQUE INDEX content_items_code_active_uq ON content_items (product_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;
CREATE INDEX content_items_product_type_status_idx ON content_items (product_id, doc_type_id, status);
CREATE INDEX content_items_search_gin ON content_items USING GIN (search_tsv);

-- FTS en español: trigger-maintained (to_tsvector no es IMMUTABLE ⇒ no cabe en GENERATED).
CREATE OR REPLACE FUNCTION content_items_set_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector('spanish', coalesce(NEW.code, '') || ' ' || NEW.title || ' ' || NEW.body_markdown);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_items_search_tsv_trigger
  BEFORE INSERT OR UPDATE OF code, title, body_markdown ON content_items
  FOR EACH ROW EXECUTE FUNCTION content_items_set_search_tsv();

CREATE TABLE item_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES content_items(id) ON DELETE RESTRICT,
  version       integer NOT NULL,
  title         text NOT NULL,
  body_markdown text NOT NULL,
  author_id     text REFERENCES users(id),
  change_note   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, version)
);
CREATE INDEX item_versions_item_version_idx ON item_versions (item_id, version DESC);
-- append-only: reutiliza forbid_mutation() de 0002_core.
CREATE TRIGGER item_versions_append_only
  BEFORE UPDATE OR DELETE ON item_versions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- N:M explícita documento↔nodo (un doc a N nodos; un nodo varios docs).
CREATE TABLE item_node_links (
  item_id     uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  node_id     uuid NOT NULL REFERENCES product_nodes(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, node_id)
);
CREATE INDEX item_node_links_node_idx ON item_node_links (node_id);

CREATE OR REPLACE FUNCTION item_node_links_validate() RETURNS trigger AS $$
DECLARE
  item_product uuid;
  node_product uuid;
BEGIN
  SELECT product_id INTO item_product FROM content_items WHERE id = NEW.item_id;
  SELECT product_id INTO node_product FROM product_nodes WHERE id = NEW.node_id;
  IF item_product IS NULL OR node_product IS NULL THEN
    RAISE EXCEPTION 'item_node_links: item o nodo inexistente';
  END IF;
  IF item_product <> NEW.product_id OR node_product <> NEW.product_id THEN
    RAISE EXCEPTION 'item_node_links: producto inconsistente (cross-product prohibido)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_node_links_validate_trigger
  BEFORE INSERT OR UPDATE ON item_node_links
  FOR EACH ROW EXECUTE FUNCTION item_node_links_validate();

-- relations base (Fase 2: kinds node/item activos; task/issue/change/test_case
-- se endurecen en Fases 3-4 cuando sus tablas existan — 04 §6).
CREATE TABLE relations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id),
  source_kind   text NOT NULL
                CHECK (source_kind IN ('node','item','task','issue','change','test_case')),
  source_id     uuid NOT NULL,
  target_kind   text NOT NULL
                CHECK (target_kind IN ('node','item','task','issue','change','test_case')),
  target_id     uuid NOT NULL,
  relation_type text NOT NULL
                CHECK (relation_type IN (
                  'affects','documents','specifies','implements','resolves','blocks',
                  'is_blocked_by','verifies','depends_on','relates_to','modifies',
                  'references','applies_rule')),
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    text REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, source_kind, source_id, target_kind, target_id, relation_type)
);
CREATE INDEX relations_source_idx ON relations (source_kind, source_id);
CREATE INDEX relations_target_idx ON relations (target_kind, target_id);
CREATE INDEX relations_product_type_idx ON relations (product_id, relation_type);

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
  END IF;
  IF NEW.target_kind = 'node' THEN
    IF NOT EXISTS (SELECT 1 FROM product_nodes WHERE id = NEW.target_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: target node inexistente o de otro producto';
    END IF;
  ELSIF NEW.target_kind = 'item' THEN
    IF NOT EXISTS (SELECT 1 FROM content_items WHERE id = NEW.target_id AND product_id = NEW.product_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'relations: target item inexistente o de otro producto';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER relations_validate_trigger
  BEFORE INSERT OR UPDATE ON relations
  FOR EACH ROW EXECUTE FUNCTION relations_validate();

-- comments base (Fase 2: parent_kind=item; Fase 3 extiende a task/issue/change).
CREATE TABLE comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id),
  parent_kind   text NOT NULL CHECK (parent_kind IN ('item')),
  parent_id     uuid NOT NULL,
  author_id     text REFERENCES users(id),
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX comments_parent_idx ON comments (parent_kind, parent_id, created_at);

CREATE OR REPLACE FUNCTION comments_validate() RETURNS trigger AS $$
DECLARE
  parent_product uuid;
BEGIN
  IF NEW.parent_kind = 'item' THEN
    SELECT product_id INTO parent_product FROM content_items WHERE id = NEW.parent_id;
    IF parent_product IS NULL OR parent_product <> NEW.product_id THEN
      RAISE EXCEPTION 'comments: padre item inexistente o de otro producto';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_validate_trigger
  BEFORE INSERT OR UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION comments_validate();

-- attachments base (Fase 2: owner_kind=item; el binario vive en StoragePort).
CREATE TABLE attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id),
  owner_kind    text NOT NULL CHECK (owner_kind IN ('item')),
  owner_id      uuid NOT NULL,
  storage_key   text NOT NULL UNIQUE,
  filename      text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    integer NOT NULL,
  sha256        text NOT NULL,
  uploaded_by   text REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachments_owner_idx ON attachments (owner_kind, owner_id);

CREATE OR REPLACE FUNCTION attachments_validate() RETURNS trigger AS $$
DECLARE
  owner_product uuid;
BEGIN
  IF NEW.owner_kind = 'item' THEN
    SELECT product_id INTO owner_product FROM content_items WHERE id = NEW.owner_id;
    IF owner_product IS NULL OR owner_product <> NEW.product_id THEN
      RAISE EXCEPTION 'attachments: dueño item inexistente o de otro producto';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attachments_validate_trigger
  BEFORE INSERT OR UPDATE ON attachments
  FOR EACH ROW EXECUTE FUNCTION attachments_validate();
