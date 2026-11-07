-- 0004_work.down.sql — revierte la Fase 3 (orden inverso)
-- Restaura triggers en su forma de la migración 0003 (node/item solo).

DROP TRIGGER IF EXISTS attachments_validate_trigger ON attachments;
DROP FUNCTION IF EXISTS attachments_validate();
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_owner_kind_check;
ALTER TABLE attachments ADD CONSTRAINT attachments_owner_kind_check CHECK (owner_kind IN ('item'));

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

DROP TRIGGER IF EXISTS comments_validate_trigger ON comments;
DROP FUNCTION IF EXISTS comments_validate();
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_parent_kind_check;
ALTER TABLE comments ADD CONSTRAINT comments_parent_kind_check CHECK (parent_kind IN ('item'));

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

DROP TABLE IF EXISTS issues;
DROP TABLE IF EXISTS tasks;
