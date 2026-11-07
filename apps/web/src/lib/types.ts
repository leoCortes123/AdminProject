/**
 * Tipos de la API pública (espejo ligero de los DTOs de apps/api).
 * Los enums se mantienen en sync con packages/shared.
 */
import type { DOCUMENT_STATUSES, PRODUCT_STATUSES, NODE_STATUSES } from '@devcycle/shared';

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type NodeStatus = (typeof NODE_STATUSES)[number];
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  status: ProductStatus;
  techStack: string[];
  icon: string | null;
  color: string | null;
  role: string;
  createdAt: string;
}

export interface ProductDetail extends ProductListItem {
  description: string | null;
  repoUrl: string | null;
  updatedAt: string;
}

export interface ProductNode {
  id: string;
  parentId: string | null;
  productId?: string;
  nodeTypeId?: string;
  code: string;
  name: string;
  /** Descripción funcional breve (ficha · Resumen); `null` si no se declaró. */
  description: string | null;
  /** Objetivo funcional (ficha · Funcionalidad); `null` si no se declaró. */
  objective: string | null;
  path: string;
  depth: number;
  position: number;
  status: NodeStatus;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  nodeType: {
    key: string;
    label: string;
    color: string | null;
    icon: string | null;
  };
}

export interface ProductMember {
  userId: string;
  email: string;
  name: string;
  roleKey: string;
  invitedAt: string;
  acceptedAt: string | null;
}

export interface MeResponse {
  user: { id: string; email: string; name: string };
  globalRoles: string[];
  memberships: Array<{ productId: string; slug: string; name: string; roleKey: string }>;
}

// --- Documentación (Fase 2 · M-03) ---

export interface DocumentType {
  id: string;
  key: string;
  label: string;
  description: string | null;
  position: number;
}

export interface DocumentItem {
  id: string;
  productId: string;
  docTypeId: string;
  docTypeKey: string;
  docTypeLabel: string;
  code: string | null;
  title: string;
  bodyMarkdown: string;
  status: DocumentStatus;
  scope: string;
  version: number;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  nodeCodes: string[];
}

export interface DocumentVersion {
  id: string;
  itemId: string;
  version: number;
  title: string;
  bodyMarkdown: string;
  metadata: Record<string, unknown>;
  authorId: string | null;
  changeNote: string | null;
  createdAt: string;
}

export interface AttachmentInfo {
  id: string;
  productId: string;
  ownerKind: string;
  ownerId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string | null;
  createdAt: string;
}

export interface DocRelation {
  id: string;
  productId: string;
  sourceKind: string;
  sourceId: string;
  targetKind: string;
  targetId: string;
  relationType: string;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
}

export interface SearchHit {
  kind: 'document' | 'node' | 'task' | 'issue' | 'change' | 'test_case';
  id: string;
  code: string | null;
  title: string;
  docTypeKey?: string;
  docTypeLabel?: string;
  nodeTypeKey?: string;
  nodeTypeLabel?: string;
  status: string;
  snippet: string;
  rank: number;
  nodeCodes: string[];
}

// --- Seguimiento (Fase 5 · M-08) ---

export interface OverviewModule {
  id: string;
  code: string;
  name: string;
  nodesTotal: number;
  nodesDone: number;
  tasksTotal: number;
  tasksDone: number;
  pct: number;
}

export interface OverviewDto {
  avancePct: number;
  counts: {
    tasksTotal: number;
    tasksDone: number;
    tasksOpen: number;
    tasksBlocked: number;
    issuesTotal: number;
    issuesOpen: number;
    issuesBySeverity: Record<string, number>;
    changesProposed: number;
    changesExecuted: number;
  };
  modules: OverviewModule[];
  openIssues: Array<{
    id: string;
    code: string | null;
    title: string;
    severity: string;
    priority: string;
    stateKey: string;
  }>;
  blockedTasks: Array<{
    id: string;
    code: string | null;
    title: string;
    priority: string;
    stateKey: string;
  }>;
  recentChanges: Array<{
    id: string;
    code: string | null;
    title: string;
    status: string;
    executedAt: string | null;
    createdAt: string;
  }>;
}

export interface CoverageNode {
  id: string;
  code: string;
  name: string;
  nodeTypeKey: string;
  path: string;
}

export interface CoverageDto {
  totalNodes: number;
  withDocs: number;
  withoutDocs: number;
  withTests: number;
  withoutTests: number;
  pctDocs: number;
  pctTests: number;
  withoutDocsList: CoverageNode[];
  withoutTestsList: CoverageNode[];
}

export interface ActivityEntry {
  id: string;
  actorType: string;
  actorUserId: string | null;
  action: string;
  entityKind: string | null;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export interface ActivityPage {
  items: ActivityEntry[];
  nextCursor: string | null;
}

// --- Trabajo (Fase 3 · M-04/M-05) ---

export interface WorkflowState {
  id: string;
  productId: string;
  scope: 'task' | 'issue';
  key: string;
  label: string;
  color: string | null;
  position: number;
  isTerminal: boolean;
}

export interface TaskDependency {
  id: string;
  targetId: string;
  relationType: string;
}

export interface TaskItem {
  id: string;
  productId: string;
  code: string | null;
  title: string;
  description: string;
  type: string;
  stateKey: string;
  stateLabel: string;
  stateColor: string | null;
  priority: string;
  assigneeId: string | null;
  estimateMinutes: number | null;
  acceptanceCriteria: Array<{ text: string; done: boolean }>;
  dueDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  nodeCodes: string[];
  blockedBy: TaskDependency[];
  blocks: TaskDependency[];
}

export interface IssueItem {
  id: string;
  productId: string;
  code: string | null;
  title: string;
  description: string;
  expectedBehavior: string;
  observedBehavior: string;
  reproductionSteps: string[];
  severity: string;
  priority: string;
  stateKey: string;
  stateLabel: string;
  stateColor: string | null;
  assigneeId: string | null;
  reopenCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  nodeCodes: string[];
  linkedTaskIds: string[];
}

export interface CommentItem {
  id: string;
  productId: string;
  parentKind: string;
  parentId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// --- Trazabilidad (Fase 4 · M-06/M-07) ---

export interface ChangeItem {
  id: string;
  productId: string;
  code: string | null;
  title: string;
  description: string;
  kind: string;
  status: string;
  gitRepo: string | null;
  gitBranch: string | null;
  gitSha: string | null;
  gitPrUrl: string | null;
  gitFiles: string[];
  executedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  nodeCodes: string[];
  taskIds: string[];
  issueIds: string[];
  resolvedIssueIds: string[];
  testCaseIds: string[];
}

export interface TestCaseItem {
  id: string;
  productId: string;
  code: string | null;
  title: string;
  type: string;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  itemCodes: string[];
  nodeCodes: string[];
  lastResult: {
    id: string;
    status: string;
    executedAt: string;
    executedByKind: string;
  } | null;
}

export interface RelationDto {
  id: string;
  productId: string;
  sourceKind: string;
  sourceId: string;
  sourceCode: string | null;
  sourceTitle: string | null;
  targetKind: string;
  targetId: string;
  targetCode: string | null;
  targetTitle: string | null;
  relationType: string;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
}

export interface TraceRow {
  kind: string;
  id: string;
  code: string | null;
  title: string;
  subtitle: string;
}

export interface HistoryEntry {
  at: string;
  actorType: string;
  action: string;
  summary: string;
  source: 'activity' | 'version';
  entityKind: string | null;
  entityId: string | null;
}

export interface TraceGraph {
  center: { kind: string; id: string; code: string | null; title: string };
  nodes: Array<{
    kind: string;
    id: string;
    code: string | null;
    title: string | null;
  }>;
  edges: Array<{ source: string; target: string; type: string }>;
}

// --- Integraciones (Fase 6a · M-09) ---

export interface ServiceAccount {
  id: string;
  productId: string;
  name: string;
  agentKind: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
}

export interface ApiTokenInfo {
  id: string;
  serviceAccountId: string;
  tokenPrefix: string;
  scopes: string[];
  label: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedApiToken {
  id: string;
  token: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
}

export interface AgentExecution {
  id: string;
  serviceAccountId: string | null;
  agentName: string | null;
  toolName: string | null;
  requestSummary: string;
  status: string;
  durationMs: number | null;
  createdAt: string;
}
