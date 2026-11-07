/**
 * Esquema Drizzle — DevCycle.
 * Fuente de verdad del *modelo*; las migraciones SQL viven en `migrations/`
 * (escritas a mano para revisión en PR + runner propio en `src/migrate.ts`).
 *
 * Migración 001 (F1-T02): extensiones, identidad/organización, productos,
 * RBAC, árbol funcional, catálogos (document_types, workflow_states), activity_log.
 * Migración 002 (Fase 2, F2-T01): content_items, item_versions, item_node_links,
 * relations base, comments base, attachments.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  index,
  integer,
  inet,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** citext — emails y slugs insensibles a mayúsculas (extensión citext). */
const citext = customType<{ data: string }>({
  dataType: () => 'citext',
});

/** ltree — materialized path del árbol funcional (extensión ltree). */
const ltree = customType<{ data: string }>({
  dataType: () => 'ltree',
});

/** tsvector — columna FTS mantenida por trigger (to_tsvector no es IMMUTABLE). */
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// ---------------------------------------------------------------------------
// Identidad y organización
// ---------------------------------------------------------------------------

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: citext('slug').notNull().unique(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

/** Usuarios — tabla gestionada por better-auth (modelName: 'users'). */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: citext('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamptz('expires_at').notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamptz('access_token_expires_at'),
  refreshTokenExpiresAt: timestamptz('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamptz('expires_at').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(true),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  description: text('description'),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

/** Rol global de organización (p. ej. admin_global). Roles por producto van en product_members. */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    slug: citext('slug').notNull().unique(),
    name: text('name').notNull(),
    tagline: text('tagline'),
    description: text('description'),
    status: text('status').notNull().default('in_development'),
    techStack: jsonb('tech_stack')
      .notNull()
      .default(sql`'[]'::jsonb`),
    repoUrl: text('repo_url'),
    icon: text('icon'),
    color: text('color'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (t) => [
    check(
      'products_status_check',
      sql`${t.status} IN ('active','in_development','maintenance','archived')`,
    ),
    index('products_org_idx').on(t.orgId),
  ],
);

export const productMembers = pgTable(
  'product_members',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    invitedAt: timestamptz('invited_at').notNull().defaultNow(),
    acceptedAt: timestamptz('accepted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.userId] })],
);

// ---------------------------------------------------------------------------
// Árbol funcional
// ---------------------------------------------------------------------------

export const nodeTypes = pgTable(
  'node_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** NULL = tipo global (seed); NOT NULL = personalizado por producto. */
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    color: text('color'),
    icon: text('icon'),
    isStructural: boolean('is_structural').notNull().default(true),
    position: integer('position').notNull().default(0),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (t) => [uniqueIndex('node_types_product_key_uq').on(t.productId, t.key)],
);

export const productNodes = pgTable(
  'product_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    parentId: uuid('parent_id'),
    nodeTypeId: uuid('node_type_id')
      .notNull()
      .references(() => nodeTypes.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    path: ltree('path').notNull(),
    depth: integer('depth').notNull().default(0),
    position: integer('position').notNull().default(0),
    status: text('status').notNull().default('planned'),
    ownerId: text('owner_id').references(() => users.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (t) => [
    check(
      'product_nodes_status_check',
      sql`${t.status} IN ('planned','in_progress','done','deprecated','disabled')`,
    ),
    // FK compuesta hacia el padre (mismo producto) — ver migración 0003.
    uniqueIndex('product_nodes_id_product_uq').on(t.id, t.productId),
    index('product_nodes_parent_idx').on(t.parentId, t.position),
    index('product_nodes_type_idx').on(t.nodeTypeId),
  ],
);

// ---------------------------------------------------------------------------
// Catálogos (seed)
// ---------------------------------------------------------------------------

export const documentTypes = pgTable('document_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),
  position: integer('position').notNull().default(0),
});

export const workflowStates = pgTable(
  'workflow_states',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    color: text('color'),
    position: integer('position').notNull().default(0),
    isTerminal: boolean('is_terminal').notNull().default(false),
  },
  (t) => [
    check('workflow_states_scope_check', sql`${t.scope} IN ('task','issue')`),
    uniqueIndex('workflow_states_product_scope_key_uq').on(t.productId, t.scope, t.key),
  ],
);

export const stateTransitions = pgTable(
  'state_transitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    fromStateId: uuid('from_state_id').references(() => workflowStates.id, { onDelete: 'cascade' }),
    toStateId: uuid('to_state_id')
      .notNull()
      .references(() => workflowStates.id, { onDelete: 'cascade' }),
    requiredPermission: text('required_permission'),
    requiresConfirmation: boolean('requires_confirmation').notNull().default(false),
  },
  (t) => [check('state_transitions_scope_check', sql`${t.scope} IN ('task','issue')`)],
);

// ---------------------------------------------------------------------------
// Documentación (Fase 2 · M-03 — migración 0003_documents)
// ---------------------------------------------------------------------------

export const contentItems = pgTable(
  'content_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    docTypeId: uuid('doc_type_id')
      .notNull()
      .references(() => documentTypes.id),
    code: text('code'),
    title: text('title').notNull(),
    bodyMarkdown: text('body_markdown').notNull().default(''),
    status: text('status').notNull().default('draft'),
    scope: text('scope').notNull().default('node'),
    version: integer('version').notNull().default(1),
    searchTsv: tsvector('search_tsv'),
    createdBy: text('created_by').references(() => users.id),
    updatedBy: text('updated_by').references(() => users.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (t) => [
    check(
      'content_items_status_check',
      sql`${t.status} IN ('draft','in_review','published','archived')`,
    ),
    check('content_items_scope_check', sql`${t.scope} IN ('node','global')`),
    uniqueIndex('content_items_id_product_uq').on(t.id, t.productId),
    uniqueIndex('content_items_code_active_uq')
      .on(t.productId, t.code)
      .where(sql`${t.deletedAt} IS NULL AND ${t.code} IS NOT NULL`),
    index('content_items_product_type_status_idx').on(t.productId, t.docTypeId, t.status),
  ],
);

export const itemVersions = pgTable(
  'item_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    bodyMarkdown: text('body_markdown').notNull(),
    authorId: text('author_id').references(() => users.id),
    changeNote: text('change_note'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('item_versions_item_version_uq').on(t.itemId, t.version),
    index('item_versions_item_version_idx').on(t.itemId, t.version),
  ],
);

export const itemNodeLinks = pgTable(
  'item_node_links',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    nodeId: uuid('node_id')
      .notNull()
      .references(() => productNodes.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.nodeId] }),
    index('item_node_links_node_idx').on(t.nodeId),
  ],
);

export const relations = pgTable(
  'relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    sourceKind: text('source_kind').notNull(),
    sourceId: uuid('source_id').notNull(),
    targetKind: text('target_kind').notNull(),
    targetId: uuid('target_id').notNull(),
    relationType: text('relation_type').notNull(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'relations_source_kind_check',
      sql`${t.sourceKind} IN ('node','item','task','issue','change','test_case')`,
    ),
    check(
      'relations_target_kind_check',
      sql`${t.targetKind} IN ('node','item','task','issue','change','test_case')`,
    ),
    check(
      'relations_type_check',
      sql`${t.relationType} IN ('affects','documents','specifies','implements','resolves','blocks','is_blocked_by','verifies','depends_on','relates_to','modifies','references','applies_rule')`,
    ),
    uniqueIndex('relations_unique_uq').on(
      t.productId,
      t.sourceKind,
      t.sourceId,
      t.targetKind,
      t.targetId,
      t.relationType,
    ),
    index('relations_source_idx').on(t.sourceKind, t.sourceId),
    index('relations_target_idx').on(t.targetKind, t.targetId),
    index('relations_product_type_idx').on(t.productId, t.relationType),
  ],
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    parentKind: text('parent_kind').notNull(),
    parentId: uuid('parent_id').notNull(),
    authorId: text('author_id').references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (t) => [index('comments_parent_idx').on(t.parentKind, t.parentId, t.createdAt)],
);

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    ownerKind: text('owner_kind').notNull(),
    ownerId: uuid('owner_id').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    uploadedBy: text('uploaded_by').references(() => users.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('attachments_owner_idx').on(t.ownerKind, t.ownerId)],
);

// ---------------------------------------------------------------------------
// Actividad (append-only)
// ---------------------------------------------------------------------------

export const activityLog = pgTable(
  'activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').references(() => products.id),
    actorType: text('actor_type').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    entityKind: text('entity_kind'),
    entityId: uuid('entity_id'),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    ip: inet('ip'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('activity_log_actor_type_check', sql`${t.actorType} IN ('human','agent','system')`),
    index('activity_log_product_created_idx').on(t.productId, t.createdAt),
  ],
);
