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
export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

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
