import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import {
  permissions,
  productMembers,
  products,
  rolePermissions,
  roles,
  userRoles,
} from '@devcycle/db';
import { PERMISSIONS, type Permission } from '@devcycle/shared';
import { DB, type Database } from '../database';

export interface MembershipInfo {
  productId: string;
  slug: string;
  name: string;
  roleKey: string;
}

/**
 * Consultas de autorización. Defensa en profundidad: la API filtra siempre por
 * `product_id` además de los guards.
 *
 * Permisos efectivos:
 *  - `admin_global` (rol global vía `user_roles`) → TODOS los permisos, en todo producto.
 *  - resto → permisos del rol en `product_members` para ESE producto.
 */
@Injectable()
export class IamService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async getGlobalRoleKeys(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ key: roles.key })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userId));
    return rows.map((row) => row.key);
  }

  async isAdminGlobal(userId: string): Promise<boolean> {
    return (await this.getGlobalRoleKeys(userId)).includes('admin_global');
  }

  async getProductMembership(
    userId: string,
    productId: string,
  ): Promise<{ roleKey: string } | null> {
    const [row] = await this.db
      .select({ roleKey: roles.key })
      .from(productMembers)
      .innerJoin(roles, eq(roles.id, productMembers.roleId))
      .where(and(eq(productMembers.userId, userId), eq(productMembers.productId, productId)))
      .limit(1);
    return row ?? null;
  }

  async getEffectivePermissions(userId: string, productId?: string): Promise<Permission[]> {
    if (await this.isAdminGlobal(userId)) {
      return [...PERMISSIONS];
    }
    if (!productId) {
      // Sin contexto de producto no hay permisos elevados (solo admin_global).
      return [];
    }
    const membership = await this.getProductMembership(userId, productId);
    if (!membership) return [];
    const rows = await this.db
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(roles, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(roles.key, membership.roleKey));
    return rows.map((row) => row.key as Permission);
  }

  async listMemberships(userId: string): Promise<MembershipInfo[]> {
    const rows = await this.db
      .select({
        productId: products.id,
        slug: products.slug,
        name: products.name,
        roleKey: roles.key,
      })
      .from(productMembers)
      .innerJoin(products, eq(products.id, productMembers.productId))
      .innerJoin(roles, eq(roles.id, productMembers.roleId))
      .where(and(eq(productMembers.userId, userId), isNull(products.deletedAt)));
    return rows;
  }
}
