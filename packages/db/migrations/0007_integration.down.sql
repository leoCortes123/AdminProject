-- 0007_integration.down.sql — revierte la Fase 6a (orden inverso)
DROP INDEX IF EXISTS activity_log_product_service_created_idx;
ALTER TABLE activity_log DROP COLUMN IF EXISTS actor_service_account_id;

DROP INDEX IF EXISTS agent_executions_service_created_idx;
ALTER TABLE agent_executions DROP COLUMN IF EXISTS ip;
ALTER TABLE agent_executions DROP COLUMN IF EXISTS result_summary;
ALTER TABLE agent_executions DROP COLUMN IF EXISTS request_args;
ALTER TABLE agent_executions DROP CONSTRAINT IF EXISTS agent_executions_service_account_fk;

DROP INDEX IF EXISTS api_tokens_service_idx;
DROP TABLE IF EXISTS api_tokens;

DROP INDEX IF EXISTS service_accounts_product_idx;
DROP INDEX IF EXISTS service_accounts_product_name_uq;
DROP TABLE IF EXISTS service_accounts;
