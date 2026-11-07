-- 0003_documents.down.sql — revierte Fase 2 (orden inverso de dependencias)
DROP TRIGGER IF EXISTS attachments_validate_trigger ON attachments;
DROP FUNCTION IF EXISTS attachments_validate();
DROP TABLE IF EXISTS attachments;
DROP TRIGGER IF EXISTS comments_validate_trigger ON comments;
DROP FUNCTION IF EXISTS comments_validate();
DROP TABLE IF EXISTS comments;
DROP TRIGGER IF EXISTS relations_validate_trigger ON relations;
DROP FUNCTION IF EXISTS relations_validate();
DROP TABLE IF EXISTS relations;
DROP TRIGGER IF EXISTS item_node_links_validate_trigger ON item_node_links;
DROP FUNCTION IF EXISTS item_node_links_validate();
DROP TABLE IF EXISTS item_node_links;
DROP TRIGGER IF EXISTS item_versions_append_only ON item_versions;
DROP TABLE IF EXISTS item_versions;
DROP TRIGGER IF EXISTS content_items_search_tsv_trigger ON content_items;
DROP FUNCTION IF EXISTS content_items_set_search_tsv();
DROP TABLE IF EXISTS content_items;
