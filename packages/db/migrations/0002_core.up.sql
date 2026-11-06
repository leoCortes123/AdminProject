-- 0002_core.up.sql — identidad, organización, RBAC, productos, árbol funcional, catálogos, actividad

CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        citext NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- users: gestionada por better-auth (modelName 'users')
CREATE TABLE users (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  email           citext NOT NULL UNIQUE,
  email_verified  boolean NOT NULL DEFAULT false,
  image           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id          text PRIMARY KEY,
  expires_at  timestamptz NOT NULL,
  token       text NOT NULL UNIQUE,
  ip_address  text,
  user_agent  text,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE accounts (
  id                        text PRIMARY KEY,
  account_id                text NOT NULL,
  provider_id               text NOT NULL,
  user_id                   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token              text,
  refresh_token             text,
  id_token                  text,
  access_token_expires_at   timestamptz,
  refresh_token_expires_at  timestamptz,
  scope                     text,
  password                  text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX accounts_user_idx ON accounts (user_id);

CREATE TABLE verifications (
  id          text PRIMARY KEY,
  identifier  text NOT NULL,
  value       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RBAC
CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  label       text NOT NULL,
  description text,
  is_system   boolean NOT NULL DEFAULT true
);

CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  description text
);

CREATE TABLE role_permissions (
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Productos
CREATE TABLE products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  slug          citext NOT NULL UNIQUE,
  name          text NOT NULL,
  tagline       text,
  description   text,
  status        text NOT NULL DEFAULT 'in_development'
                CHECK (status IN ('active','in_development','maintenance','archived')),
  tech_stack    jsonb NOT NULL DEFAULT '[]'::jsonb,
  repo_url      text,
  icon          text,
  color         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX products_org_idx ON products (org_id);

CREATE TABLE product_members (
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES roles(id),
  invited_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, user_id)
);

-- Árbol funcional
CREATE TABLE node_types (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid REFERENCES products(id) ON DELETE CASCADE, -- NULL = global (seed)
  key           text NOT NULL,
  label         text NOT NULL,
  color         text,
  icon          text,
  is_structural boolean NOT NULL DEFAULT true,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE UNIQUE INDEX node_types_product_key_uq ON node_types (product_id, key);
CREATE UNIQUE INDEX node_types_global_key_uq ON node_types (key) WHERE product_id IS NULL;

CREATE TABLE product_nodes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id),
  parent_id     uuid,
  node_type_id  uuid NOT NULL REFERENCES node_types(id),
  code          text NOT NULL,
  name          text NOT NULL,
  path          ltree NOT NULL,
  depth         integer NOT NULL DEFAULT 0,
  position      integer NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'planned'
                CHECK (status IN ('planned','in_progress','done','deprecated','disabled')),
  owner_id      text REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE UNIQUE INDEX product_nodes_id_product_uq ON product_nodes (id, product_id);
CREATE UNIQUE INDEX product_nodes_code_active_uq ON product_nodes (product_id, code) WHERE deleted_at IS NULL;
CREATE INDEX product_nodes_parent_idx ON product_nodes (parent_id, position);
CREATE INDEX product_nodes_type_idx ON product_nodes (node_type_id);
CREATE INDEX product_nodes_path_gist ON product_nodes USING GIST (path);
-- FK compuesta padre→hijo dentro del mismo producto (cross-product imposible por construcción)
ALTER TABLE product_nodes
  ADD CONSTRAINT product_nodes_parent_product_fk
  FOREIGN KEY (parent_id, product_id) REFERENCES product_nodes (id, product_id);

-- Catálogos
CREATE TABLE document_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  label       text NOT NULL,
  description text,
  position    integer NOT NULL DEFAULT 0
);

CREATE TABLE workflow_states (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  scope       text NOT NULL CHECK (scope IN ('task','issue')),
  key         text NOT NULL,
  label       text NOT NULL,
  color       text,
  position    integer NOT NULL DEFAULT 0,
  is_terminal boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX workflow_states_product_scope_key_uq ON workflow_states (product_id, scope, key);

CREATE TABLE state_transitions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  scope                 text NOT NULL CHECK (scope IN ('task','issue')),
  from_state_id         uuid REFERENCES workflow_states(id) ON DELETE CASCADE,
  to_state_id           uuid NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
  required_permission   text,
  requires_confirmation boolean NOT NULL DEFAULT false
);

-- Actividad append-only
CREATE TABLE activity_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid REFERENCES products(id),
  actor_type    text NOT NULL CHECK (actor_type IN ('human','agent','system')),
  actor_user_id text REFERENCES users(id),
  action        text NOT NULL,
  entity_kind   text,
  entity_id     uuid,
  summary       text NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip            inet,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_product_created_idx ON activity_log (product_id, created_at DESC);

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% es append-only: % no permitido', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_log_append_only
  BEFORE UPDATE OR DELETE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
