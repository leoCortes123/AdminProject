import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  DEFAULT_WORKFLOW_STATES,
  DEFAULT_WORKFLOW_TRANSITIONS,
  productMembers,
  products,
  roles,
  stateTransitions,
  users,
  workflowStates,
} from '@devcycle/db';
import { Problems, type CreateProductInput } from '@devcycle/shared';
import { ProblemException } from '../common/problem.exception';
import { DB, type Database } from '../database';
import { ActivityService } from '../common/activity.service';
import { type DbExecutor } from '../common/activity.service';
import type { AddMemberInput, UpdateProductInput } from './products.dto';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  status: string;
  techStack: unknown;
  icon: string | null;
  color: string | null;
  role: string;
  createdAt: Date;
}

@Injectable()
export class ProductsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly activity: ActivityService,
  ) {}

  async listForUser(userId: string, adminGlobal: boolean): Promise<ProductListItem[]> {
    if (adminGlobal) {
      const rows = await this.db
        .select()
        .from(products)
        .where(isNull(products.deletedAt))
        .orderBy(products.name);
      return rows.map((row) => this.toListItem(row, 'admin_global'));
    }
    const rows = await this.db
      .select({ product: products, roleKey: roles.key })
      .from(productMembers)
      .innerJoin(products, eq(products.id, productMembers.productId))
      .innerJoin(roles, eq(roles.id, productMembers.roleId))
      .where(and(eq(productMembers.userId, userId), isNull(products.deletedAt)))
      .orderBy(products.name);
    return rows.map(({ product, roleKey }) => this.toListItem(product, roleKey));
  }

  async findBySlug(slug: string) {
    const [product] = await this.db
      .select()
      .from(products)
      .where(and(eq(products.slug, slug), isNull(products.deletedAt)))
      .limit(1);
    return product ?? null;
  }

  /**
   * Creación compuesta (F1-T06): producto + membresía del creador (admin_product)
   * + workflow_states/transiciones por defecto + activity_log, en UNA transacción.
   */
  async createProduct(input: CreateProductInput, creatorId: string, ip?: string) {
    try {
      return await this.db.transaction(async (tx) => {
        const [product] = await tx
          .insert(products)
          .values({
            orgId: await this.getDefaultOrgId(tx),
            slug: input.slug,
            name: input.name,
            tagline: input.tagline ?? null,
            description: input.description ?? null,
            status: input.status,
            techStack: input.techStack,
            repoUrl: input.repoUrl ?? null,
            icon: input.icon ?? null,
            color: input.color ?? null,
          })
          .returning();
        if (!product) {
          throw new Error('Insert de producto no devolvió fila');
        }

        const [creatorRole] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.key, 'admin_product'))
          .limit(1);
        if (creatorRole) {
          await tx.insert(productMembers).values({
            productId: product.id,
            userId: creatorId,
            roleId: creatorRole.id,
            acceptedAt: new Date(),
          });
        }

        await this.seedWorkflowDefaults(tx, product.id);

        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: creatorId,
            action: 'product.created',
            entityKind: 'product',
            entityId: product.id,
            summary: `Producto creado: ${product.name} (${product.slug})`,
            metadata: { slug: product.slug },
            ip: ip ?? null,
          },
          tx,
        );

        return product;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProblemException(
          Problems.conflict(
            `Ya existe un producto con slug '${input.slug}'`,
            'product.slug_conflict',
          ),
        );
      }
      throw error;
    }
  }

  /** v1: mono-organización — devuelve la org por defecto (la única, 'Acme & Co'). */
  private async getDefaultOrgId(tx: DbExecutor): Promise<string> {
    const result = await tx.execute(
      sql`SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1`,
    );
    const rows = result as unknown as Array<{ id: string }>;
    const id = rows[0]?.id;
    if (!id) {
      throw new ProblemException(
        Problems.internal('No existe ninguna organización (ejecuta `pnpm db:seed`)'),
      );
    }
    return id;
  }

  private async seedWorkflowDefaults(tx: DbExecutor, productId: string): Promise<void> {
    for (const state of DEFAULT_WORKFLOW_STATES) {
      await tx
        .insert(workflowStates)
        .values({
          productId,
          scope: state.scope,
          key: state.key,
          label: state.label,
          color: state.color,
          position: state.position,
          isTerminal: state.isTerminal,
        })
        .onConflictDoNothing();
    }
    const rows = await tx
      .select({ id: workflowStates.id, scope: workflowStates.scope, key: workflowStates.key })
      .from(workflowStates)
      .where(eq(workflowStates.productId, productId));
    const stateId = new Map(rows.map((row) => [`${row.scope}:${row.key}`, row.id]));

    for (const transition of DEFAULT_WORKFLOW_TRANSITIONS) {
      const toStateId = stateId.get(`${transition.scope}:${transition.toKey}`);
      if (!toStateId) continue;
      const fromStateId = transition.fromKey
        ? (stateId.get(`${transition.scope}:${transition.fromKey}`) ?? null)
        : null;
      await tx.insert(stateTransitions).values({
        productId,
        scope: transition.scope,
        fromStateId,
        toStateId,
        requiredPermission: transition.requiredPermission ?? null,
        requiresConfirmation: transition.requiresConfirmation ?? false,
      });
    }
  }

  async updateProduct(productId: string, input: UpdateProductInput) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates['name'] = input.name;
    if (input.tagline !== undefined) updates['tagline'] = input.tagline;
    if (input.description !== undefined) updates['description'] = input.description;
    if (input.status !== undefined) updates['status'] = input.status;
    if (input.techStack !== undefined) updates['techStack'] = input.techStack;
    if (input.repoUrl !== undefined) updates['repoUrl'] = input.repoUrl;
    if (input.icon !== undefined) updates['icon'] = input.icon;
    if (input.color !== undefined) updates['color'] = input.color;

    const [updated] = await this.db
      .update(products)
      .set(updates)
      .where(eq(products.id, productId))
      .returning();
    return updated ?? null;
  }

  async listMembers(productId: string) {
    const rows = await this.db
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        roleKey: roles.key,
        invitedAt: productMembers.invitedAt,
        acceptedAt: productMembers.acceptedAt,
      })
      .from(productMembers)
      .innerJoin(users, eq(users.id, productMembers.userId))
      .innerJoin(roles, eq(roles.id, productMembers.roleId))
      .where(eq(productMembers.productId, productId))
      .orderBy(users.name);
    return rows;
  }

  /**
   * Alta de miembro v1: añade directamente a un usuario YA registrado
   * (no hay flujo de invitación por email todavía); accepted_at = now().
   * Rol actualizado si ya existía la membresía (upsert).
   */
  async addMember(productId: string, input: AddMemberInput, actorId: string, ip?: string) {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (!user) {
      throw new ProblemException(Problems.notFound('Usuario', input.email));
    }
    const [role] = await this.db
      .select({ id: roles.id, key: roles.key })
      .from(roles)
      .where(eq(roles.key, input.roleKey))
      .limit(1);
    if (!role) {
      throw new ProblemException(Problems.internal(`Rol '${input.roleKey}' no existe (seed)`));
    }

    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ roleId: productMembers.roleId })
        .from(productMembers)
        .where(and(eq(productMembers.productId, productId), eq(productMembers.userId, user.id)))
        .limit(1);

      if (existing) {
        await tx
          .update(productMembers)
          .set({ roleId: role.id })
          .where(and(eq(productMembers.productId, productId), eq(productMembers.userId, user.id)));
      } else {
        await tx.insert(productMembers).values({
          productId,
          userId: user.id,
          roleId: role.id,
          acceptedAt: new Date(),
        });
      }

      await this.activity.emit(
        {
          productId,
          actorUserId: actorId,
          action: existing ? 'member.role_changed' : 'member.added',
          entityKind: 'product',
          entityId: productId,
          summary: existing
            ? `Rol de ${user.email} actualizado a ${role.key}`
            : `${user.email} añadido como ${role.key}`,
          metadata: { userId: user.id, roleKey: role.key },
          ip: ip ?? null,
        },
        tx,
      );

      return { userId: user.id, email: user.email, name: user.name, roleKey: role.key };
    });
  }

  private toListItem(row: typeof products.$inferSelect, role: string): ProductListItem {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      status: row.status,
      techStack: row.techStack,
      icon: row.icon,
      color: row.color,
      role,
      createdAt: row.createdAt,
    };
  }
}
