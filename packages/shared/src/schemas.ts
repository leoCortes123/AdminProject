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
  SEVERITIES,
  TASK_TYPES,
  INTEGRATION_SCOPES,
  CONTEXT_SECTIONS,
  CONTEXT_MAX_BYTES,
  type ContextSection,
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
  /** Descripción funcional breve (ficha · Resumen). Vacío = sin descripción. */
  description: z.string().trim().max(10_000).optional(),
  /** Objetivo funcional (ficha · Funcionalidad). Vacío = sin objetivo. */
  objective: z.string().trim().max(10_000).optional(),
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
    /** Descripción funcional breve. `null` (o cad. vacía) la borra. */
    description: z.string().trim().max(10_000).nullable().optional(),
    /** Objetivo funcional. `null` (o cad. vacía) lo borra. */
    objective: z.string().trim().max(10_000).nullable().optional(),
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
  /** Datos estructurados tipados por docTypeKey (CU/reglas/RNF/flujos). */
  metadata: z.record(z.unknown()).default({}),
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
    metadata: z.record(z.unknown()).optional(),
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
  metadata: z.record(z.unknown()).optional(),
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

/** Búsqueda FTS (F2-T07, global F5-T05) — `kinds` coma-separated:
 *  document,node,task,issue,change,test_case (def. document). */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(300),
  kinds: z.string().trim().max(100).default('document'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;

// ---------------------------------------------------------------------------
// Datos funcionales estructurados (ADR-008)
// ---------------------------------------------------------------------------
// Esquemas tipados para la columna `metadata` de content_items cuando
// docTypeKey es uno de los cuatro "comportamientos" vinculados a un nodo.
// Se validan en el servicio de documentos (create/update/version).

export const useCaseMetadataSchema = z.object({
  actor: z.string().trim().max(200).optional(),
  goal: z.string().trim().max(2000).optional(),
  preconditions: z.array(z.string().trim().min(1).max(500)).default([]),
  mainFlow: z.array(z.string().trim().min(1).max(1000)).default([]),
  alternativeFlows: z.array(z.string().trim().min(1).max(1000)).default([]),
  postconditions: z.array(z.string().trim().min(1).max(500)).default([]),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});
export type UseCaseMetadata = z.infer<typeof useCaseMetadataSchema>;

export const businessRuleMetadataSchema = z.object({
  condition: z.string().trim().max(2000).optional(),
  action: z.string().trim().max(2000).optional(),
  scope: z.string().trim().max(500).optional(),
  exceptions: z.array(z.string().trim().min(1).max(500)).default([]),
  owner: z.string().trim().max(200).optional(),
});
export type BusinessRuleMetadata = z.infer<typeof businessRuleMetadataSchema>;

export const nonFunctionalRequirementMetadataSchema = z.object({
  category: z
    .enum([
      'performance',
      'security',
      'usability',
      'availability',
      'maintainability',
      'portability',
      'other',
    ])
    .default('other'),
  metric: z.string().trim().max(300).optional(),
  threshold: z.string().trim().max(300).optional(),
  measurementMethod: z.string().trim().max(1000).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});
export type NonFunctionalRequirementMetadata = z.infer<
  typeof nonFunctionalRequirementMetadataSchema
>;

export const flowMetadataSchema = z.object({
  trigger: z.string().trim().max(500).optional(),
  steps: z
    .array(
      z.object({
        order: z.number().int().min(1),
        action: z.string().trim().min(1).max(1000),
        actor: z.string().trim().max(200).optional(),
        system: z.string().trim().max(200).optional(),
      }),
    )
    .default([]),
  exceptions: z.array(z.string().trim().min(1).max(500)).default([]),
});
export type FlowMetadata = z.infer<typeof flowMetadataSchema>;

export const FUNCTIONAL_DOCUMENT_METADATA_SCHEMAS = {
  use_case: useCaseMetadataSchema,
  business_rule: businessRuleMetadataSchema,
  req_non_functional: nonFunctionalRequirementMetadataSchema,
  workflow: flowMetadataSchema,
} as const;

export type FunctionalDocumentKind = keyof typeof FUNCTIONAL_DOCUMENT_METADATA_SCHEMAS;

export const listDocumentsQuerySchema = z.object({
  docTypeKey: z.string().trim().max(60).optional(),
  status: documentStatusSchema.optional(),
  scope: documentScopeSchema.optional(),
  nodeCode: z.string().trim().max(32).optional(),
  q: z.string().trim().max(300).optional(),
});
export type ListDocumentsQueryInput = z.infer<typeof listDocumentsQuerySchema>;

// ---------------------------------------------------------------------------
// Trabajo (Fase 3 · F3-T02…T05)
// ---------------------------------------------------------------------------

const taskPrioritySchema = z.enum(PRIORITIES as unknown as [string, ...string[]]);
const severitySchema = z.enum(SEVERITIES as unknown as [string, ...string[]]);

/** Criterio de aceptación (checklist jsonb) — texto + estado. */
export const acceptanceCriterionSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  done: z.boolean().default(false),
});
export type AcceptanceCriterion = z.infer<typeof acceptanceCriterionSchema>;

/** Código opcional de tarea/incidencia (TAR-231, INC-087…); único por producto. */
export const taskCodeSchema = z
  .string()
  .trim()
  .regex(/^(TAR|INC)-[0-9]{1,6}$/, 'código tipo TAR-231 o INC-087');
export const issueCodeSchema = taskCodeSchema;

export const createTaskSchema = z.object({
  code: taskCodeSchema.nullish(),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(50_000).default(''),
  type: z.enum(TASK_TYPES).default('development'),
  stateKey: z.string().trim().min(1).max(60).optional(),
  priority: taskPrioritySchema.default('medium'),
  assigneeId: z.string().min(1).max(128).nullable().optional(),
  estimateMinutes: z.number().int().min(0).max(100_000).nullable().optional(),
  acceptanceCriteria: z.array(acceptanceCriterionSchema).max(50).default([]),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  /** Códigos de nodos a vincular al crear (validados en el servicio). */
  nodeCodes: z.array(z.string().trim().min(1).max(32)).max(50).default([]),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().max(50_000).optional(),
    type: z.enum(TASK_TYPES).optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: z.string().min(1).max(128).nullable().optional(),
    estimateMinutes: z.number().int().min(0).max(100_000).nullable().optional(),
    acceptanceCriteria: z.array(acceptanceCriterionSchema).max(50).optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Al menos un campo debe ser actualizado',
  });
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const transitionTaskSchema = z.object({
  toStateKey: z.string().trim().min(1).max(60),
});
export type TransitionTaskInput = z.infer<typeof transitionTaskSchema>;

export const listTasksQuerySchema = z.object({
  type: z.enum(TASK_TYPES).optional(),
  stateKey: z.string().trim().max(60).optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().trim().max(128).optional(),
  nodeCode: z.string().trim().max(32).optional(),
  q: z.string().trim().max(300).optional(),
});
export type ListTasksQueryInput = z.infer<typeof listTasksQuerySchema>;

export const createDependencySchema = z.object({
  targetId: uuidSchema,
  relationType: z.enum(['blocks', 'is_blocked_by', 'depends_on']).default('blocks'),
});
export type CreateDependencyInput = z.infer<typeof createDependencySchema>;

export const createTaskRelationSchema = z.object({
  targetId: uuidSchema.nullish(),
  targetKind: z.enum(['node', 'item', 'issue', 'task']).optional(),
  targetCode: z.string().trim().min(1).max(64).optional(),
  relationType: relationTypeSchema.default('relates_to'),
});
export type CreateTaskRelationInput = z.infer<typeof createTaskRelationSchema>;

export const createIssueSchema = z.object({
  code: issueCodeSchema.nullish(),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(50_000).default(''),
  expectedBehavior: z.string().max(50_000).default(''),
  observedBehavior: z.string().max(50_000).default(''),
  reproductionSteps: z.array(z.string().trim().min(1).max(5000)).max(50).default([]),
  severity: severitySchema.default('medium'),
  priority: taskPrioritySchema.default('medium'),
  stateKey: z.string().trim().min(1).max(60).optional(),
  assigneeId: z.string().min(1).max(128).nullable().optional(),
  nodeCodes: z.array(z.string().trim().min(1).max(32)).max(50).default([]),
});
export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const updateIssueSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().max(50_000).optional(),
    expectedBehavior: z.string().max(50_000).optional(),
    observedBehavior: z.string().max(50_000).optional(),
    reproductionSteps: z.array(z.string().trim().min(1).max(5000)).max(50).optional(),
    severity: severitySchema.optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: z.string().min(1).max(128).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Al menos un campo debe ser actualizado',
  });
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;

export const transitionIssueSchema = z.object({
  toStateKey: z.string().trim().min(1).max(60),
});
export type TransitionIssueInput = z.infer<typeof transitionIssueSchema>;

export const listIssuesQuerySchema = z.object({
  severity: severitySchema.optional(),
  stateKey: z.string().trim().max(60).optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().trim().max(128).optional(),
  nodeCode: z.string().trim().max(32).optional(),
  q: z.string().trim().max(300).optional(),
});
export type ListIssuesQueryInput = z.infer<typeof listIssuesQuerySchema>;

export const createCommentSchema = z.object({
  parentId: uuidSchema,
  parentKind: z.enum(['task', 'issue', 'item', 'change']),
  body: z.string().trim().min(1).max(50_000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const createIssueLinkTaskSchema = z.object({
  taskId: uuidSchema,
});
export type CreateIssueLinkTaskInput = z.infer<typeof createIssueLinkTaskSchema>;

// ---------------------------------------------------------------------------
// Trazabilidad (Fase 4 · F4-T03…T05)
// ---------------------------------------------------------------------------

import {
  CHANGE_KINDS,
  CHANGE_STATUSES,
  TEST_CASE_STATUSES,
  TEST_CASE_TYPES,
  TRACE_MAX_DEPTH,
} from './constants.js';

/** Código opcional de modificación/caso de prueba (MOD-031, TC-014…); único por producto. */
export const changeCodeSchema = z
  .string()
  .trim()
  .regex(/^(MOD)-[0-9]{1,6}$/, 'código tipo MOD-031');
export const testCaseCodeSchema = z
  .string()
  .trim()
  .regex(/^(TC|TEST)-[0-9]{1,6}$/, 'código tipo TC-014');

export const createChangeSchema = z.object({
  code: changeCodeSchema.nullish(),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(50_000).default(''),
  kind: z.enum(CHANGE_KINDS).default('functional'),
  gitRepo: z.string().trim().max(500).nullish(),
  gitBranch: z.string().trim().max(200).nullish(),
  gitSha: z.string().trim().max(64).nullish(),
  gitPrUrl: z.string().trim().max(1000).nullish(),
  gitFiles: z.array(z.string().trim().min(1).max(500)).max(200).optional(),
  /** Códigos de nodos afectados a vincular al crear (validados en el servicio). */
  nodeCodes: z.array(z.string().trim().min(1).max(32)).max(50).default([]),
});
export type CreateChangeInput = z.infer<typeof createChangeSchema>;

export const updateChangeSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().max(50_000).optional(),
    kind: z.enum(CHANGE_KINDS).optional(),
    gitRepo: z.string().trim().max(500).nullable().optional(),
    gitBranch: z.string().trim().max(200).nullable().optional(),
    gitSha: z.string().trim().max(64).nullable().optional(),
    gitPrUrl: z.string().trim().max(1000).nullable().optional(),
    gitFiles: z.array(z.string().trim().min(1).max(500)).max(200).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Al menos un campo debe ser actualizado',
  });
export type UpdateChangeInput = z.infer<typeof updateChangeSchema>;

export const executeChangeSchema = z.object({
  gitRepo: z.string().trim().max(500).optional(),
  gitBranch: z.string().trim().max(200).optional(),
  gitSha: z.string().trim().max(64).optional(),
  gitPrUrl: z.string().trim().max(1000).optional(),
  gitFiles: z.array(z.string().trim().min(1).max(500)).max(200).optional(),
});
export type ExecuteChangeInput = z.infer<typeof executeChangeSchema>;

export const listChangesQuerySchema = z.object({
  status: z.enum(CHANGE_STATUSES).optional(),
  kind: z.enum(CHANGE_KINDS).optional(),
  nodeCode: z.string().trim().max(32).optional(),
  q: z.string().trim().max(300).optional(),
});
export type ListChangesQueryInput = z.infer<typeof listChangesQuerySchema>;

/** Relación genérica de una modificación (target por id o por código legible). */
export const createChangeRelationSchema = z.object({
  targetId: uuidSchema.nullish(),
  targetKind: z.enum(['node', 'item', 'task', 'issue', 'change', 'test_case']).optional(),
  targetCode: z.string().trim().min(1).max(64).optional(),
  relationType: relationTypeSchema.default('relates_to'),
});
export type CreateChangeRelationInput = z.infer<typeof createChangeRelationSchema>;

export const createChangeLinkSchema = z.object({
  /** Código destino opcional (TAR-…, INC-…, MOD-…, TC-…) o `targetId` uuid. */
  nodeCode: z.string().trim().min(1).max(32).optional(),
  taskId: uuidSchema.optional(),
  issueId: uuidSchema.optional(),
  issueCode: z.string().trim().min(1).max(64).optional(),
  taskCode: z.string().trim().min(1).max(64).optional(),
});
export type CreateChangeLinkInput = z.infer<typeof createChangeLinkSchema>;

export const createTestCaseSchema = z.object({
  code: testCaseCodeSchema.nullish(),
  title: z.string().trim().min(1).max(500),
  type: z.enum(TEST_CASE_TYPES).default('manual'),
  status: z.enum(TEST_CASE_STATUSES).default('active'),
  /** Documentos (CU) verificados por este caso. */
  itemCodes: z.array(z.string().trim().min(1).max(64)).max(50).default([]),
  nodeCodes: z.array(z.string().trim().min(1).max(32)).max(50).default([]),
});
export type CreateTestCaseInput = z.infer<typeof createTestCaseSchema>;

export const registerTestResultSchema = z.object({
  status: z.enum(['passed', 'failed', 'skipped']),
  environment: z.string().trim().max(200).optional(),
  notes: z.string().max(10_000).default(''),
});
export type RegisterTestResultInput = z.infer<typeof registerTestResultSchema>;

/** Relación genérica bidireccional (F4-T05): cualquier kind ↔ cualquier kind. */
export const createGenericRelationSchema = z.object({
  sourceKind: z.enum(['node', 'item', 'task', 'issue', 'change', 'test_case']),
  sourceId: uuidSchema,
  targetKind: z.enum(['node', 'item', 'task', 'issue', 'change', 'test_case']),
  targetId: uuidSchema,
  relationType: relationTypeSchema,
  metadata: z.record(z.unknown()).optional(),
});
export type CreateGenericRelationInput = z.infer<typeof createGenericRelationSchema>;

export const traceDepthSchema = z.coerce.number().int().min(1).max(TRACE_MAX_DEPTH).default(1);

// ---------------------------------------------------------------------------
// Seguimiento (Fase 5 · M-08)
// ---------------------------------------------------------------------------

/** Kinds de la búsqueda global (F5-T05): document/node/task/issue/change/test_case. */
export const SEARCH_KINDS = ['document', 'node', 'task', 'issue', 'change', 'test_case'] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

/** Feed de actividad cursor-paginado (F5-T03): orden estable (created_at, id) desc. */
export const activityQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  actorType: z.enum(['human', 'agent', 'system']).optional(),
  entityKind: z.enum(['node', 'item', 'task', 'issue', 'change', 'test_case']).optional(),
  /** Prefijo de acción para filtrar (p. ej. `task.` o `doc.`). */
  actionPrefix: z.string().trim().max(64).optional(),
});
export type ActivityQueryInput = z.infer<typeof activityQuerySchema>;

/** Informe exportable (F5-T06): CSV de tareas/incidencias/modificaciones. */
export const exportQuerySchema = z.object({
  kind: z.enum(['tasks', 'issues', 'changes']),
});
export type ExportQueryInput = z.infer<typeof exportQuerySchema>;
export const EXPORT_KINDS = ['tasks', 'issues', 'changes'] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

// ---------------------------------------------------------------------------
// Integraciones (Fase 6a · M-09)
// ---------------------------------------------------------------------------

/** Nombre estable de cuenta de servicio (p. ej. `claude-code`, `ci-bot`). */
export const serviceAccountNameSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{1,60}$/, 'nombre en minúsculas, dígitos y guiones');

/** Scopes de un token: subconjunto de INTEGRATION_SCOPES (lectura por defecto). */
export const integrationScopesSchema = z.array(z.enum(INTEGRATION_SCOPES)).max(20).default([]);

/** Alta de cuenta de servicio por producto (F6a-T01, permiso `integrations:manage`). */
export const createServiceAccountSchema = z.object({
  name: serviceAccountNameSchema,
  agentKind: z.string().trim().min(1).max(60).default('agent'),
  description: z.string().trim().max(1000).optional(),
});
export type CreateServiceAccountInput = z.infer<typeof createServiceAccountSchema>;

/**
 * Alta de token de servicio (F6a-T01). `scopes` vacío = scopes de solo
 * lectura por defecto. Sin scopes de escritura salvo alta explícita.
 */
export const createApiTokenSchema = z.object({
  serviceAccountId: uuidSchema,
  scopes: integrationScopesSchema,
  expiresInDays: z.number().int().min(1).max(365).optional(),
  label: z.string().trim().max(200).optional(),
});
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>;

/** Contexto estructurado para agente (F6a-T02 `get_product_context`, 06 §6). */
export const integrationContextQuerySchema = z.object({
  sections: z.string().trim().max(500).optional(),
  maxBytes: z.coerce.number().int().min(4096).max(CONTEXT_MAX_BYTES).optional().default(32_000),
});
export type IntegrationContextQueryInput = z.infer<typeof integrationContextQuerySchema>;

export function parseContextSections(raw?: string): ContextSection[] {
  if (!raw) {
    // Por defecto: todas excepto `history` completo (solo resumen).
    return CONTEXT_SECTIONS.filter((s) => s !== 'history');
  }
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => (CONTEXT_SECTIONS as readonly string[]).includes(s));
  const unique = [...new Set(parts)] as ContextSection[];
  return unique.length > 0 ? unique : [];
}
