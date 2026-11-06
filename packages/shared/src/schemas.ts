import { z } from 'zod';
import {
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
  ownerId: uuidSchema.nullish(),
});
export type CreateNodeInput = z.infer<typeof createNodeSchema>;

export const moveNodeSchema = z.object({
  newParentId: uuidSchema.nullable(),
  position: z.number().int().min(0).optional(),
});
export type MoveNodeInput = z.infer<typeof moveNodeSchema>;
