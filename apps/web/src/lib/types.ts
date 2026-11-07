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
  kind: 'document';
  id: string;
  code: string | null;
  title: string;
  docTypeKey: string;
  docTypeLabel: string;
  status: string;
  snippet: string;
  rank: number;
  nodeCodes: string[];
}
