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
    /** Descripción funcional breve (pestaña Resumen de la ficha integral). */
    description: text('description'),
    /** Objetivo funcional del elemento (pestaña Funcionalidad). */
    objective: text('objective'),
    path: ltree('path').notNull(),
    depth: integer('depth').notNull().default(0),
    position: integer('position').notNull().default(0),
    status: text('status').notNull().default('planned'),
    ownerId: text('owner_id').references(() => users.id),
    /** FTS español (F5-T05, 0008): code + name + path + description + objective, trigger-maintained. */
    searchTsv: tsvector('search_tsv'),
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
    index('product_nodes_search_gin').using('gin', t.searchTsv),
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
    /** Datos estructurados tipados por docTypeKey (CU/reglas/RNF/flujos). */
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
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
    /** Snapshot estructurado del documento en esta versión. */
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
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
// Trabajo (Fase 3 · M-04, M-05 — migración 0004_work)
// ---------------------------------------------------------------------------

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    code: text('code'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    type: text('type').notNull().default('development'),
    stateId: uuid('state_id')
      .notNull()
      .references(() => workflowStates.id),
    priority: text('priority').notNull().default('medium'),
    assigneeId: text('assignee_id').references(() => users.id),
    estimateMinutes: integer('estimate_minutes'),
    acceptanceCriteria: jsonb('acceptance_criteria')
      .notNull()
      .default(sql`'[]'::jsonb`),
    dueDate: text('due_date'),
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    completedAt: timestamptz('completed_at'),
    deletedAt: timestamptz('deleted_at'),
    /** FTS español (F5-T05): code + title + description, trigger-maintained. */
    searchTsv: tsvector('search_tsv'),
  },
  (t) => [
    check(
      'tasks_type_check',
      sql`${t.type} IN ('development','analysis','documentation','maintenance')`,
    ),
    check('tasks_priority_check', sql`${t.priority} IN ('critical','high','medium','low')`),
    uniqueIndex('tasks_id_product_uq').on(t.id, t.productId),
    uniqueIndex('tasks_code_active_uq')
      .on(t.productId, t.code)
      .where(sql`${t.deletedAt} IS NULL AND ${t.code} IS NOT NULL`),
    index('tasks_product_state_idx').on(t.productId, t.stateId),
    index('tasks_product_assignee_idx').on(t.productId, t.assigneeId),
    index('tasks_product_due_idx').on(t.productId, t.dueDate),
    index('tasks_search_gin').using('gin', t.searchTsv),
  ],
);

export const issues = pgTable(
  'issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    code: text('code'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    expectedBehavior: text('expected_behavior').notNull().default(''),
    observedBehavior: text('observed_behavior').notNull().default(''),
    reproductionSteps: jsonb('reproduction_steps')
      .notNull()
      .default(sql`'[]'::jsonb`),
    severity: text('severity').notNull().default('medium'),
    priority: text('priority').notNull().default('medium'),
    stateId: uuid('state_id')
      .notNull()
      .references(() => workflowStates.id),
    assigneeId: text('assignee_id').references(() => users.id),
    reopenCount: integer('reopen_count').notNull().default(0),
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    resolvedAt: timestamptz('resolved_at'),
    deletedAt: timestamptz('deleted_at'),
    /** FTS español (F5-T05): code + title + description + behaviors, trigger-maintained. */
    searchTsv: tsvector('search_tsv'),
  },
  (t) => [
    check('issues_severity_check', sql`${t.severity} IN ('critical','high','medium','low')`),
    check('issues_priority_check', sql`${t.priority} IN ('critical','high','medium','low')`),
    uniqueIndex('issues_id_product_uq').on(t.id, t.productId),
    uniqueIndex('issues_code_active_uq')
      .on(t.productId, t.code)
      .where(sql`${t.deletedAt} IS NULL AND ${t.code} IS NOT NULL`),
    index('issues_product_state_idx').on(t.productId, t.stateId),
    index('issues_product_severity_idx').on(t.productId, t.severity),
    index('issues_product_assignee_idx').on(t.productId, t.assigneeId),
    index('issues_search_gin').using('gin', t.searchTsv),
  ],
);

// ---------------------------------------------------------------------------
// Trazabilidad (Fase 4 · M-06, M-07 — migración 0005_traceability)
// ---------------------------------------------------------------------------

export const changes = pgTable(
  'changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    code: text('code'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    kind: text('kind').notNull().default('functional'),
    status: text('status').notNull().default('proposed'),
    gitRepo: text('git_repo'),
    gitBranch: text('git_branch'),
    gitSha: text('git_sha'),
    gitPrUrl: text('git_pr_url'),
    gitFiles: jsonb('git_files')
      .notNull()
      .default(sql`'[]'::jsonb`),
    executedAt: timestamptz('executed_at'),
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
    /** FTS español (F5-T05): code + title + description, trigger-maintained. */
    searchTsv: tsvector('search_tsv'),
  },
  (t) => [
    check('changes_kind_check', sql`${t.kind} IN ('functional','technical')`),
    check('changes_status_check', sql`${t.status} IN ('proposed','executed')`),
    uniqueIndex('changes_id_product_uq').on(t.id, t.productId),
    uniqueIndex('changes_code_active_uq')
      .on(t.productId, t.code)
      .where(sql`${t.deletedAt} IS NULL AND ${t.code} IS NOT NULL`),
    index('changes_product_status_idx').on(t.productId, t.status),
    index('changes_product_created_idx').on(t.productId, t.createdAt),
    index('changes_search_gin').using('gin', t.searchTsv),
  ],
);

export const testCases = pgTable(
  'test_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    code: text('code'),
    title: text('title').notNull(),
    type: text('type').notNull().default('manual'),
    status: text('status').notNull().default('active'),
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
    /** FTS español (F5-T05): code + title, trigger-maintained. */
    searchTsv: tsvector('search_tsv'),
  },
  (t) => [
    check('test_cases_type_check', sql`${t.type} IN ('manual','automated','e2e')`),
    check('test_cases_status_check', sql`${t.status} IN ('active','draft','archived')`),
    uniqueIndex('test_cases_id_product_uq').on(t.id, t.productId),
    uniqueIndex('test_cases_code_active_uq')
      .on(t.productId, t.code)
      .where(sql`${t.deletedAt} IS NULL AND ${t.code} IS NOT NULL`),
    index('test_cases_product_type_idx').on(t.productId, t.type),
    index('test_cases_search_gin').using('gin', t.searchTsv),
  ],
);

export const testResults = pgTable(
  'test_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    testCaseId: uuid('test_case_id')
      .notNull()
      .references(() => testCases.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    status: text('status').notNull(),
    environment: text('environment'),
    notes: text('notes').notNull().default(''),
    executedByKind: text('executed_by_kind').notNull().default('human'),
    executedBy: text('executed_by').references(() => users.id),
    serviceAccountId: uuid('service_account_id'),
    executedAt: timestamptz('executed_at').notNull().defaultNow(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('test_results_status_check', sql`${t.status} IN ('passed','failed','skipped')`),
    check('test_results_executor_check', sql`${t.executedByKind} IN ('human','agent')`),
    index('test_results_case_time_idx').on(t.testCaseId, t.executedAt),
    index('test_results_product_time_idx').on(t.productId, t.executedAt),
  ],
);

/** agent_executions — incipiente Fase 4 (append-only desde el día uno). */
export const agentExecutions = pgTable(
  'agent_executions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    serviceAccountId: uuid('service_account_id'),
    agentName: text('agent_name'),
    toolName: text('tool_name'),
    requestSummary: text('request_summary').notNull().default(''),
    /** Argumentos redactados (sin secretos) para auditoría (F6a-T03). */
    requestArgs: jsonb('request_args')
      .notNull()
      .default(sql`'{}'::jsonb`),
    resultSummary: text('result_summary').notNull().default(''),
    status: text('status').notNull().default('ok'),
    idempotencyKey: text('idempotency_key'),
    durationMs: integer('duration_ms'),
    ip: inet('ip'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check(
      'agent_executions_status_check',
      sql`${t.status} IN ('ok','error','confirmation_required','rejected')`,
    ),
    index('agent_executions_product_created_idx').on(t.productId, t.createdAt),
    index('agent_executions_service_created_idx').on(t.serviceAccountId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Integraciones (Fase 6a · M-09 — migración 0007_integration)
// ---------------------------------------------------------------------------

/**
 * Cuenta de servicio por producto (identidad de agente/integración separada
 * de `users`). Debe ser creada por `Administrador de producto`.
 */
export const serviceAccounts = pgTable(
  'service_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    agentKind: text('agent_kind').notNull().default('agent'),
    description: text('description'),
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    disabledAt: timestamptz('disabled_at'),
  },
  (t) => [
    uniqueIndex('service_accounts_product_name_uq').on(t.productId, t.name),
    index('service_accounts_product_idx').on(t.productId),
  ],
);

/**
 * Token de servicio con hash (sha256), scopes, expiración y revocación.
 * El token en claro solo se muestra una vez al crear (patrón GitHub).
 */
export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceAccountId: uuid('service_account_id')
      .notNull()
      .references(() => serviceAccounts.id, { onDelete: 'cascade' }),
    /** Hash sha256 hex del token en claro (lookup por hash en cada request). */
    tokenHash: text('token_hash').notNull().unique(),
    /** Prefijo legible para UI (p. ej. `dvc_1a2b`, sin secreto). */
    tokenPrefix: text('token_prefix').notNull().default(''),
    scopes: jsonb('scopes')
      .notNull()
      .default(sql`'[]'::jsonb`),
    label: text('label'),
    expiresAt: timestamptz('expires_at'),
    lastUsedAt: timestamptz('last_used_at'),
    revokedAt: timestamptz('revoked_at'),
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('api_tokens_service_idx').on(t.serviceAccountId, t.createdAt)],
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
    actorServiceAccountId: uuid('actor_service_account_id'),
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
