-- 0007_integration.up.sql — Fase 6a · Integraciones (M-09) F6a-T01…T03
-- service_accounts + api_tokens (hash, scopes, expiración, revocación) +
-- agent_executions enriquecidas (args redactados, resultado, IP) +
-- activity_log.actor_service_account_id para enlazar agente ↔ actividad.
-- Ver docs/planificacion/06-integraciones-agentes.md §2/§8 y
-- 07-plan-implementacion.md §7 (F6a-T01…T03).

-- ---------------------------------------------------------------------------
-- service_accounts: identidad de agente/integración separada de `users`.
-- ---------------------------------------------------------------------------
CREATE TABLE service_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        text NOT NULL,
  agent_kind  text NOT NULL DEFAULT 'agent',
  description text,
  created_by  text REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);
CREATE UNIQUE INDEX service_accounts_product_name_uq ON service_accounts (product_id, name);
CREATE INDEX service_accounts_product_idx ON service_accounts (product_id);

-- FK diferida desde agent_executions/test_results (columnas preexistentes sin FK).
ALTER TABLE agent_executions
  ADD CONSTRAINT agent_executions_service_account_fk
  FOREIGN KEY (service_account_id) REFERENCES service_accounts(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- api_tokens: hash sha256, scopes JSONB, expiración, revocación.
-- El token en claro solo se muestra una única vez (patrón GitHub).
-- ---------------------------------------------------------------------------
CREATE TABLE api_tokens (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_account_id uuid NOT NULL REFERENCES service_accounts(id) ON DELETE CASCADE,
  token_hash         text NOT NULL UNIQUE,
  token_prefix       text NOT NULL DEFAULT '',
  scopes             jsonb NOT NULL DEFAULT '[]'::jsonb,
  label              text,
  expires_at         timestamptz,
  last_used_at       timestamptz,
  revoked_at         timestamptz,
  created_by         text REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_tokens_service_idx ON api_tokens (service_account_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- agent_executions: columnas de auditoría (args redactados, resultado, IP).
-- ---------------------------------------------------------------------------
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS request_args jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS result_summary text NOT NULL DEFAULT '';
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS ip inet;
CREATE INDEX IF NOT EXISTS agent_executions_service_created_idx
  ON agent_executions (service_account_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- activity_log: enlace con cuenta de servicio (actor_type='agent').
-- ---------------------------------------------------------------------------
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS actor_service_account_id uuid;
CREATE INDEX IF NOT EXISTS activity_log_product_service_created_idx
  ON activity_log (product_id, actor_service_account_id, created_at DESC);
