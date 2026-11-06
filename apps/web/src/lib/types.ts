/**
 * Tipos de la API pública (espejo ligero de los DTOs de apps/api).
 * Los enums se mantienen en sync con packages/shared.
 */
import type { PRODUCT_STATUSES, NODE_STATUSES } from '@devcycle/shared';

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type NodeStatus = (typeof NODE_STATUSES)[number];

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
