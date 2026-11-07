import { z } from 'zod';
import {
  DOCUMENT_SCOPES,
  DOCUMENT_STATUSES,
  ENTITY_KINDS,
  NODE_STATUSES,
  NODE_TYPE_KEYS,
  PRIORITIES,
  PRODUCT_STATUSES,
  RELATION_TYPES,
  ROLE_KEYS,
  TASK_TYPES,
} from './constants.js';

export const uuidSchema = z.string().uuid();
export const productStatusSchema = z.enum(PRODUCT_STATUSES);
export const nodeStatusSchema = z.enum(NODE_STATUSES);
export const nodeTypeKeySchema = z.enum(NODE_TYPE_KEYS);
export const prioritySchema = z.enum(PRIORITIES);
export const taskTypeSchema = z.enum(TASK_TYPES);
export const roleKeySchema = z.enum(ROLE_KEYS);
export const entityKindSchema = z.enum(ENTITY_KINDS);
export const relationTypeSchema = z.enum(RELATION_TYPES);
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);
export const documentScopeSchema = z.enum(DOCUMENT_SCOPES);

/** Código documental opcional (DOC-101, CU-014, RN-014…); único por producto. */
export const documentCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{0,15}-[0-9]{1,6}$/, 'código tipo DOC-101');

/** Paginación cursor: `?cursor=<opaque>&limit=<n>` (máx 100). */
export const cursorPageSchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CursorPage = z.infer<typeof cursorPageSchema>;

/** Esquema base de creación de producto (F1-T06). */
export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'slug en minúsculas, dígitos y guiones'),
  tagline: z.string().trim().max(200).optional(),
  description: z.string().trim().max(10_000).optional(),
  status: productStatusSchema.default('in_development'),
  techStack: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  repoUrl: z.string().url().max(500).optional(),
  icon: z.string().trim().max(40).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const createNodeSchema = z.object({
  parentId: uuidSchema.nullable().default(null),
  nodeTypeKey: nodeTypeKeySchema,
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{0,15}-[0-9]{1,6}$/, 'código tipo PANT-02'),
  name: z.string().trim().min(1).max(200),
  status: nodeStatusSchema.default('planned'),
  // better-auth usa ids `text` (no uuid) para users — ver migración 0002 / schema.ts.
  ownerId: z.string().min(1).max(128).nullish(),
});
export type CreateNodeInput = z.infer<typeof createNodeSchema>;

export const moveNodeSchema = z.object({
  newParentId: uuidSchema.nullable(),
  position: z.number().int().min(0).optional(),
});
export type MoveNodeInput = z.infer<typeof moveNodeSchema>;

/** Patch parcial de nodo (F1-T07). El código (`code`) es inmutable. */
export const updateNodeSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    status: nodeStatusSchema.optional(),
    // better-auth usa ids `text` (no uuid) — ver schema.ts. null = desasignar.
    ownerId: z.string().min(1).max(128).nullish(),
    position: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Al menos un campo debe ser actualizado',
  });
export type UpdateNodeInput = z.infer<typeof updateNodeSchema>;

// ---------------------------------------------------------------------------
// Documentación (Fase 2 · F2-T02…T07)
// ---------------------------------------------------------------------------

export const createDocumentSchema = z.object({
  docTypeKey: z.string().trim().min(1).max(60),
  code: documentCodeSchema.nullish(),
  title: z.string().trim().min(1).max(500),
  bodyMarkdown: z.string().max(200_000).default(''),
  scope: documentScopeSchema.default('node'),
  /** Códigos de nodos a vincular al crear (validados en el servicio). */
  nodeCodes: z.array(z.string().trim().min(1).max(32)).max(50).default([]),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

/**
 * Edición de un documento (F2-T02). `bodyMarkdown`/`title` actualizan el
 * trabajo en curso; la snapshot versionada se crea con POST `/:id/versions`
 * o al publicar. `expectedVersion` (opcional) habilita optimistic locking.
 */
export const updateDocumentSchema = z
  .object({
    docTypeKey: z.string().trim().min(1).max(60).optional(),
    title: z.string().trim().min(1).max(500).optional(),
    bodyMarkdown: z.string().max(200_000).optional(),
    scope: documentScopeSchema.optional(),
    expectedVersion: z.number().int().min(1).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Al menos un campo debe ser actualizado',
  });
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const transitionDocumentSchema = z.object({
  toStatus: documentStatusSchema,
});
export type TransitionDocumentInput = z.infer<typeof transitionDocumentSchema>;

export const publishDocumentSchema = z.object({
  changeNote: z.string().trim().max(1000).optional(),
});
export type PublishDocumentInput = z.infer<typeof publishDocumentSchema>;

/** Snapshot versionado (F2-T03). Si se omite título/cuerpo se congela el estado actual. */
export const createVersionSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  bodyMarkdown: z.string().max(200_000).optional(),
  changeNote: z.string().trim().max(1000).optional(),
  expectedVersion: z.number().int().min(1).optional(),
});
export type CreateVersionInput = z.infer<typeof createVersionSchema>;

export const linkNodeSchema = z.object({
  nodeCode: z.string().trim().min(1).max(32),
});
export type LinkNodeInput = z.infer<typeof linkNodeSchema>;

export const createRelationSchema = z.object({
  targetId: uuidSchema,
  relationType: relationTypeSchema,
  metadata: z.record(z.unknown()).optional(),
});
export type CreateRelationInput = z.infer<typeof createRelationSchema>;

/** Búsqueda FTS (F2-T07) — `kinds` queda abierto para el global de Fase 5. */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(300),
  kinds: z.string().trim().max(100).default('document'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;

export const listDocumentsQuerySchema = z.object({
  docTypeKey: z.string().trim().max(60).optional(),
  status: documentStatusSchema.optional(),
  scope: documentScopeSchema.optional(),
  nodeCode: z.string().trim().max(32).optional(),
  q: z.string().trim().max(300).optional(),
});
export type ListDocumentsQueryInput = z.infer<typeof listDocumentsQuerySchema>;
