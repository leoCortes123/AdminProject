/**
 * Catálogos estables de la plataforma. Las claves son contrato con la base de datos
 * (CHECK constraints / seeds) y con los clientes (API pública, MCP).
 */

export const NODE_TYPE_KEYS = [
  'modulo',
  'submodulo',
  'pantalla',
  'pestana',
  'componente',
  'proceso',
  'servicio',
  'otro',
] as const;
export type NodeTypeKey = (typeof NODE_TYPE_KEYS)[number];

export const PRODUCT_STATUSES = ['active', 'in_development', 'maintenance', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const NODE_STATUSES = ['planned', 'in_progress', 'done', 'deprecated', 'disabled'] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export const DOCUMENT_STATUSES = ['draft', 'in_review', 'published', 'archived'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_SCOPES = ['node', 'global'] as const;
export type DocumentScope = (typeof DOCUMENT_SCOPES)[number];

/** MIME allowlist de adjuntos (03 §4.7: 15 MB/fichero; SVG se sanitiza). */
export const ATTACHMENT_ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
] as const;
export type AttachmentMime = (typeof ATTACHMENT_ALLOWED_MIME)[number];
export const ATTACHMENT_MAX_BYTES = 15_000_000;

export const TASK_TYPES = ['development', 'analysis', 'documentation', 'maintenance'] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];
export type PriorityOrSeverity = Priority | Severity;

/** Roles fijos (seed). La autorización efectiva combina rol + permisos granulares. */
export const ROLE_KEYS = ['admin_global', 'admin_product', 'collaborator', 'viewer'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** Catálogo de permisos granulares (§9). Estable: los roles seed lo referencian. */
export const PERMISSIONS = [
  'products:manage',
  'members:manage',
  'config:manage',
  'integrations:manage',
  'nodes:write',
  'docs:read',
  'docs:write',
  'docs:publish',
  'tasks:write',
  'issues:write',
  'changes:propose',
  'changes:execute',
  'audit:read',
  'agent:confirm',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Kinds válidos en `relations` / `comments` / `attachments` (triggers de integridad). */
export const ENTITY_KINDS = ['node', 'item', 'task', 'issue', 'change', 'test_case'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

/** Modificaciones (Fase 4 · M-06): tipo funcional/técnico y estado propuesto/ejecutado. */
export const CHANGE_KINDS = ['functional', 'technical'] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];
export const CHANGE_STATUSES = ['proposed', 'executed'] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

/** Casos de prueba (Fase 4 · M-07): tipo manual/automatizado/e2e y resultado. */
export const TEST_CASE_TYPES = ['manual', 'automated', 'e2e'] as const;
export type TestCaseType = (typeof TEST_CASE_TYPES)[number];
export const TEST_CASE_STATUSES = ['active', 'draft', 'archived'] as const;
export type TestCaseStatus = (typeof TEST_CASE_STATUSES)[number];
export const TEST_RESULT_STATUSES = ['passed', 'failed', 'skipped'] as const;
export type TestResultStatus = (typeof TEST_RESULT_STATUSES)[number];

/** Profundidad máxima de las consultas transitivas de traza (F4-T05). */
export const TRACE_MAX_DEPTH = 3;
export type TraceDepth = 1 | 2 | 3;

/** Scopes de tokens de servicio (Fase 6a · M-09) — contrato API pública e MCP. */
export const INTEGRATION_SCOPES = [
  'read:products',
  'read:structure',
  'read:docs',
  'read:tasks',
  'read:issues',
  'read:changes',
  'read:tests',
  'read:trace',
  'read:search',
  'write:docs',
  'write:tasks',
  'write:issues',
  'write:changes',
  'write:tests',
  'changes:propose',
  'issues:resolve',
  'agent:confirm',
] as const;
export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number];

/** Scopes de solo lectura (F6a: los tokens se crean con solo lectura por defecto). */
export const READ_SCOPES = INTEGRATION_SCOPES.filter((s) => s.startsWith('read:')) as ReadonlyArray<
  (typeof INTEGRATION_SCOPES)[number]
>;
/** Scopes de escritura (F6c: nunca por defecto; siempre alta explícita por admin). */
export const WRITE_SCOPES = INTEGRATION_SCOPES.filter(
  (s) => !s.startsWith('read:') && s !== 'agent:confirm',
) as ReadonlyArray<(typeof INTEGRATION_SCOPES)[number]>;

/** Secciones seleccionables de `get_product_context` (06-integraciones §6). */
export const CONTEXT_SECTIONS = [
  'functional',
  'docs',
  'rules',
  'useCases',
  'nfr',
  'dataModel',
  'apiContracts',
  'pendingTasks',
  'openIssues',
  'decisions',
  'dependencies',
  'history',
] as const;
export type ContextSection = (typeof CONTEXT_SECTIONS)[number];

/** Presupuesto total de `get_product_context` (06-integraciones §6). */
export const CONTEXT_MAX_BYTES = 32_000;

export const RELATION_TYPES = [
  'affects',
  'documents',
  'specifies',
  'implements',
  'resolves',
  'blocks',
  'is_blocked_by',
  'verifies',
  'depends_on',
  'relates_to',
  'modifies',
  'references',
  'applies_rule',
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];
