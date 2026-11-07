-- 0009_functional_metadata.down.sql

DROP INDEX IF EXISTS content_items_metadata_gin_idx;

ALTER TABLE item_versions DROP COLUMN IF EXISTS metadata;
ALTER TABLE content_items DROP COLUMN IF EXISTS metadata;