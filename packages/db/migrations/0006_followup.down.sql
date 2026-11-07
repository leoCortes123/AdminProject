-- 0006_followup.down.sql — revierte la Fase 5 (orden inverso)
DROP TRIGGER IF EXISTS product_nodes_search_tsv_trigger ON product_nodes;
DROP FUNCTION IF EXISTS product_nodes_set_search_tsv();
DROP TRIGGER IF EXISTS test_cases_search_tsv_trigger ON test_cases;
DROP FUNCTION IF EXISTS test_cases_set_search_tsv();
DROP TRIGGER IF EXISTS changes_search_tsv_trigger ON changes;
DROP FUNCTION IF EXISTS changes_set_search_tsv();
DROP TRIGGER IF EXISTS issues_search_tsv_trigger ON issues;
DROP FUNCTION IF EXISTS issues_set_search_tsv();
DROP TRIGGER IF EXISTS tasks_search_tsv_trigger ON tasks;
DROP FUNCTION IF EXISTS tasks_set_search_tsv();

DROP INDEX IF EXISTS product_nodes_search_gin;
DROP INDEX IF EXISTS test_cases_search_gin;
DROP INDEX IF EXISTS changes_search_gin;
DROP INDEX IF EXISTS issues_search_gin;
DROP INDEX IF EXISTS tasks_search_gin;

ALTER TABLE product_nodes DROP COLUMN IF EXISTS search_tsv;
ALTER TABLE test_cases DROP COLUMN IF EXISTS search_tsv;
ALTER TABLE changes DROP COLUMN IF EXISTS search_tsv;
ALTER TABLE issues DROP COLUMN IF EXISTS search_tsv;
ALTER TABLE tasks DROP COLUMN IF EXISTS search_tsv;

DROP TRIGGER IF EXISTS test_results_append_only ON test_results;
DROP INDEX IF EXISTS activity_log_product_cursor_idx;
DROP INDEX IF EXISTS activity_log_product_actor_created_idx;
