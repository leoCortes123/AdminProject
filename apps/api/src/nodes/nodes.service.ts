import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { nodeTypes, productNodes } from '@devcycle/db';
import {
  Problems,
  type CreateNodeInput,
  type MoveNodeInput,
  type UpdateNodeInput,
} from '@devcycle/shared';
import { ProblemException } from '../common/problem.exception';
import { DB, type Database } from '../database';
import { ActivityService } from '../common/activity.service';
import { type DbExecutor } from '../common/activity.service';
import type { ResolvedProduct } from '../common/authenticated-request';
import {
  allocateDuplicateCodes,
  ltreeLabel,
  nextSiblingPosition,
  pathDepth,
  pathIsDescendantOrEqual,
} from './tree.utils';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';

const isSerializationFailure = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '40001';

interface NodeRow {
  id: string;
  parentId: string | null;
  nodeTypeId: string;
  code: string;
  name: string;
  description: string | null;
  objective: string | null;
  path: string;
  depth: number;
  position: number;
  status: string;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const nodeColumns = {
  id: productNodes.id,
  parentId: productNodes.parentId,
  nodeTypeId: productNodes.nodeTypeId,
  code: productNodes.code,
  name: productNodes.name,
  description: productNodes.description,
  objective: productNodes.objective,
  path: productNodes.path,
  depth: productNodes.depth,
  position: productNodes.position,
  status: productNodes.status,
  ownerId: productNodes.ownerId,
  createdAt: productNodes.createdAt,
  updatedAt: productNodes.updatedAt,
} as const;

export interface NodeTypeInfo {
  key: string;
  label: string;
  color: string | null;
  icon: string | null;
}

export type NodeDto = NodeRow & { nodeType: NodeTypeInfo };

/** Normaliza texto funcional opcional: undefined/null/vacío → NULL (sin dato). */
const normalizeFunctionalText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
};

@Injectable()
export class NodesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly activity: ActivityService,
  ) {}

  private async withType(productId: string): Promise<NodeDto[]> {
    const rows = await this.db
      .select({ node: nodeColumns, type: nodeTypes })
      .from(productNodes)
      .innerJoin(nodeTypes, eq(nodeTypes.id, productNodes.nodeTypeId))
      .where(and(eq(productNodes.productId, productId), isNull(productNodes.deletedAt)))
      .orderBy(sql`${productNodes.path}`);
    return rows.map(({ node, type }) => ({
      ...node,
      nodeType: { key: type.key, label: type.label, color: type.color, icon: type.icon },
    }));
  }

  async listNodes(productId: string): Promise<NodeDto[]> {
    return this.withType(productId);
  }

  async getNode(productId: string, code: string, executor?: DbExecutor): Promise<NodeDto> {
    const target = executor ?? this.db;
    const node = await this.findActiveOrThrow(target, productId, code);
    const [typed] = await target
      .select({ node: nodeColumns, type: nodeTypes })
      .from(productNodes)
      .innerJoin(nodeTypes, eq(nodeTypes.id, productNodes.nodeTypeId))
      .where(eq(productNodes.id, node.id))
      .limit(1);
    return { ...typed!.node, nodeType: this.typeInfo(typed!.type) };
  }

  private typeInfo(type: typeof nodeTypes.$inferSelect): NodeTypeInfo {
    return { key: type.key, label: type.label, color: type.color, icon: type.icon };
  }

  private async findActiveOrThrow(
    executor: DbExecutor,
    productId: string,
    code: string,
    forUpdate = false,
  ) {
    let query = executor
      .select(nodeColumns)
      .from(productNodes)
      .where(
        and(
          eq(productNodes.productId, productId),
          eq(productNodes.code, code),
          isNull(productNodes.deletedAt),
        ),
      )
      .limit(1);
    if (forUpdate) {
      query = query.for('update') as typeof query;
    }
    const [node] = await query;
    if (!node) {
      throw new ProblemException(Problems.notFound('Nodo', code));
    }
    return node;
  }

  async createNode(
    product: ResolvedProduct,
    input: CreateNodeInput,
    actorId: string,
    ip?: string,
  ): Promise<NodeDto> {
    try {
      return await this.db.transaction(async (tx) => {
        // Tipo de nodo: catálogo global o personalizado del producto (gana el del producto).
        const types = await tx
          .select()
          .from(nodeTypes)
          .where(
            and(
              eq(nodeTypes.key, input.nodeTypeKey),
              isNull(nodeTypes.deletedAt),
              sql`(${nodeTypes.productId} IS NULL OR ${nodeTypes.productId} = ${product.id})`,
            ),
          )
          .orderBy(sql`${nodeTypes.productId} NULLS LAST`)
          .limit(1);
        const type = types[0];
        if (!type) {
          throw new ProblemException(
            Problems.unprocessable(`Tipo de nodo desconocido: '${input.nodeTypeKey}'`),
          );
        }

        let parentPath: string | null = null;
        if (input.parentId) {
          const [parent] = await tx
            .select({ path: productNodes.path })
            .from(productNodes)
            .where(
              and(
                eq(productNodes.id, input.parentId),
                eq(productNodes.productId, product.id),
                isNull(productNodes.deletedAt),
              ),
            )
            .limit(1);
          if (!parent) {
            throw new ProblemException(
              Problems.unprocessable('El nodo padre no existe en este producto'),
            );
          }
          parentPath = parent.path;
        }

        const path = parentPath
          ? `${parentPath}.${ltreeLabel(input.code)}`
          : ltreeLabel(input.code);
        const depth = pathDepth(path);

        const [maxRow] = await tx
          .select({ max: sql<number>`coalesce(max(${productNodes.position}), -1)::int` })
          .from(productNodes)
          .where(
            and(
              eq(productNodes.productId, product.id),
              input.parentId
                ? eq(productNodes.parentId, input.parentId)
                : isNull(productNodes.parentId),
              isNull(productNodes.deletedAt),
            ),
          );

        const [created] = await tx
          .insert(productNodes)
          .values({
            productId: product.id,
            parentId: input.parentId,
            nodeTypeId: type.id,
            code: input.code,
            name: input.name,
            description: normalizeFunctionalText(input.description),
            objective: normalizeFunctionalText(input.objective),
            path,
            depth,
            position: (maxRow?.max ?? -1) + 1,
            status: input.status,
            ownerId: input.ownerId ?? null,
          })
          .returning();
        if (!created) {
          throw new Error('Insert de nodo no devolvió fila');
        }

        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'node.created',
            entityKind: 'node',
            entityId: created.id,
            summary: `Nodo creado: ${created.code} · ${created.name}`,
            metadata: { code: created.code, path: created.path },
            ip: ip ?? null,
          },
          tx,
        );

        return { ...created, nodeType: this.typeInfo(type) };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProblemException(
          Problems.conflict(
            `Ya existe un nodo con código '${input.code}' en este producto`,
            'node.code_conflict',
          ),
        );
      }
      throw error;
    }
  }

  async updateNode(
    product: ResolvedProduct,
    code: string,
    input: UpdateNodeInput,
    actorId: string,
    ip?: string,
  ): Promise<NodeDto> {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates['name'] = input.name;
    if (input.description !== undefined)
      updates['description'] = normalizeFunctionalText(input.description);
    if (input.objective !== undefined)
      updates['objective'] = normalizeFunctionalText(input.objective);
    if (input.status !== undefined) updates['status'] = input.status;
    if (input.ownerId !== undefined) updates['ownerId'] = input.ownerId ?? null;
    if (input.position !== undefined) updates['position'] = input.position;

    const [updated] = await this.db
      .update(productNodes)
      .set(updates)
      .where(
        and(
          eq(productNodes.productId, product.id),
          eq(productNodes.code, code),
          isNull(productNodes.deletedAt),
        ),
      )
      .returning({ id: productNodes.id });
    if (!updated) {
      throw new ProblemException(Problems.notFound('Nodo', code));
    }

    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'node.updated',
      entityKind: 'node',
      entityId: updated.id,
      summary: `Nodo actualizado: ${code}`,
      metadata: { fields: Object.keys(updates).filter((key) => key !== 'updatedAt') },
      ip: ip ?? null,
    });

    return this.getNode(product.id, code);
  }

  /**
   * Mueve un nodo (y su subárbol) bajo otro padre, en transacción SERIALIZABLE.
   * Recomputa `path`/`depth` vía ltree (`path = nuevoPadre.path || subpath(...)`).
   * Rechaza mover un nodo dentro de sí mismo o de un descendiente suyo.
   */
  async moveNode(
    product: ResolvedProduct,
    code: string,
    input: MoveNodeInput,
    actorId: string,
    ip?: string,
  ) {
    try {
      return await this.db.transaction(
        async (tx) => {
          const node = await this.findActiveOrThrow(tx, product.id, code, true);

          if (input.newParentId === node.id) {
            throw new ProblemException({
              ...Problems.unprocessable('Un nodo no puede ser movido dentro de sí mismo'),
              code: 'node.move_to_self',
            });
          }

          let parentPath: string | null = null;
          if (input.newParentId) {
            const [parent] = await tx
              .select({ id: productNodes.id, path: productNodes.path })
              .from(productNodes)
              .where(
                and(
                  eq(productNodes.id, input.newParentId),
                  eq(productNodes.productId, product.id),
                  isNull(productNodes.deletedAt),
                ),
              )
              .limit(1);
            if (!parent) {
              throw new ProblemException({
                ...Problems.unprocessable('El nodo padre destino no existe en este producto'),
                code: 'node.parent_not_found',
              });
            }
            if (pathIsDescendantOrEqual(node.path, parent.path)) {
              throw new ProblemException({
                ...Problems.unprocessable(
                  'El nodo destino es el propio nodo o un descendiente suyo (ciclo)',
                ),
                code: 'node.move_into_descendant',
              });
            }
            parentPath = parent.path;
          }

          const newPath = parentPath
            ? `${parentPath}.${ltreeLabel(node.code)}`
            : ltreeLabel(node.code);

          // Recomputa path/depth de TODO el subárbol de una tacada.
          // Nota: `subpath(path, nlevel(old))` es inválido para el nodo raíz
          // (offset fuera de rango), por eso el CASE.
          await tx.execute(sql`
            WITH moved AS (
              SELECT id,
                CASE
                  WHEN path = ${node.path}::ltree THEN ${newPath}::ltree
                  ELSE (${newPath}::ltree || subpath(path, nlevel(${node.path}::ltree))::ltree)::ltree
                END AS newpath
              FROM product_nodes
              WHERE product_id = ${product.id}
                AND path <@ ${node.path}::ltree
                AND deleted_at IS NULL
            )
            UPDATE product_nodes AS p
            SET path = moved.newpath,
                depth = nlevel(moved.newpath) - 1,
                updated_at = now()
            FROM moved
            WHERE p.id = moved.id
          `);

          // Posición entre los hermanos destino.
          if (input.position !== undefined) {
            await tx.execute(sql`
              UPDATE product_nodes
              SET position = position + 1
              WHERE product_id = ${product.id}
                AND parent_id IS NOT DISTINCT FROM ${input.newParentId}::uuid
                AND position >= ${input.position}
                AND id <> ${node.id}
                AND deleted_at IS NULL
            `);
            await tx
              .update(productNodes)
              .set({ position: input.position, updatedAt: new Date() })
              .where(eq(productNodes.id, node.id));
          } else {
            const [maxRow] = await tx
              .select({ max: sql<number>`coalesce(max(${productNodes.position}), -1)::int` })
              .from(productNodes)
              .where(
                and(
                  eq(productNodes.productId, product.id),
                  input.newParentId
                    ? eq(productNodes.parentId, input.newParentId)
                    : isNull(productNodes.parentId),
                  ne(productNodes.id, node.id),
                  isNull(productNodes.deletedAt),
                ),
              );
            await tx
              .update(productNodes)
              .set({ position: (maxRow?.max ?? -1) + 1, updatedAt: new Date() })
              .where(eq(productNodes.id, node.id));
          }

          // El nodo queda bajo su nuevo padre (parent_id era NULL-able; actualizar aparte).
          await tx
            .update(productNodes)
            .set({ parentId: input.newParentId, updatedAt: new Date() })
            .where(eq(productNodes.id, node.id));

          await this.activity.emit(
            {
              productId: product.id,
              actorUserId: actorId,
              action: 'node.moved',
              entityKind: 'node',
              entityId: node.id,
              summary: `Nodo movido: ${node.code}`,
              metadata: {
                fromParentId: node.parentId,
                toParentId: input.newParentId,
                fromPath: node.path,
                toPath: newPath,
              },
              ip: ip ?? null,
            },
            tx,
          );

          return this.getNode(product.id, code, tx);
        },
        { isolationLevel: 'serializable' },
      );
    } catch (error) {
      if (isSerializationFailure(error)) {
        throw new ProblemException(
          Problems.conflict(
            'Conflicto de concurrencia al mover el nodo; reintenta',
            'node.concurrent_move',
          ),
        );
      }
      throw error;
    }
  }

  /**
   * Duplica un subárbol completo: mismos tipos/estructura, códigos nuevos con
   * el siguiente número libre por prefijo (formato `PREFIJO-123`), bajo el
   * mismo padre que el original. Códigos históricos (incluso borrados) cuentan
   * como ocupados.
   */
  async duplicateNode(product: ResolvedProduct, code: string, actorId: string, ip?: string) {
    try {
      return await this.db.transaction(
        async (tx) => {
          const node = await this.findActiveOrThrow(tx, product.id, code, true);

          const subtree = await tx
            .select(nodeColumns)
            .from(productNodes)
            .where(
              and(
                eq(productNodes.productId, product.id),
                sql`${productNodes.path} <@ ${node.path}::ltree`,
                isNull(productNodes.deletedAt),
              ),
            )
            .orderBy(sql`${productNodes.path}`);

          const existing = await tx
            .select({ code: productNodes.code })
            .from(productNodes)
            .where(eq(productNodes.productId, product.id));
          const codeMap = allocateDuplicateCodes(
            subtree.map((item) => item.code),
            existing.map((item) => item.code),
          );

          // Path del padre del nodo raíz duplicado (el duplicado cuelga del mismo sitio).
          let rootParentPath: string | null = null;
          if (node.parentId) {
            const [parent] = await tx
              .select({ path: productNodes.path })
              .from(productNodes)
              .where(eq(productNodes.id, node.parentId))
              .limit(1);
            rootParentPath = parent?.path ?? null;
          }

          const siblingPositions = await tx
            .select({ position: productNodes.position })
            .from(productNodes)
            .where(
              and(
                eq(productNodes.productId, product.id),
                node.parentId
                  ? eq(productNodes.parentId, node.parentId)
                  : isNull(productNodes.parentId),
                isNull(productNodes.deletedAt),
              ),
            );
          const rootPosition = nextSiblingPosition(siblingPositions.map((row) => row.position));

          const pathMap = new Map<string, string>();
          const idMap = new Map<string, string>();
          const created: NodeRow[] = [];
          for (const current of subtree) {
            const newCode = codeMap.get(current.code);
            if (!newCode) {
              throw new Error(`Sin código asignado para '${current.code}'`);
            }
            const isRoot = current.id === node.id;
            const label = ltreeLabel(newCode);
            const parentId = isRoot
              ? node.parentId
              : current.parentId
                ? (idMap.get(current.parentId) ?? null)
                : null;
            const newPath = isRoot
              ? rootParentPath
                ? `${rootParentPath}.${label}`
                : label
              : `${pathMap.get(current.parentId as string)}.${label}`;
            const newDepth = pathDepth(newPath);
            const position = isRoot ? rootPosition : current.position;

            const [createdRow] = await tx
              .insert(productNodes)
              .values({
                productId: product.id,
                parentId,
                nodeTypeId: current.nodeTypeId,
                code: newCode,
                name: current.name,
                description: current.description,
                objective: current.objective,
                path: newPath,
                depth: newDepth,
                position,
                status: current.status,
                ownerId: current.ownerId,
              })
              .returning();
            if (!createdRow) {
              throw new Error('Insert de nodo duplicado no devolvió fila');
            }
            pathMap.set(current.id, newPath);
            idMap.set(current.id, createdRow.id);
            created.push(createdRow);
          }

          await this.activity.emit(
            {
              productId: product.id,
              actorUserId: actorId,
              action: 'node.duplicated',
              entityKind: 'node',
              entityId: idMap.get(node.id) ?? null,
              summary: `Subárbol duplicado desde ${node.code} (${created.length} nodos)`,
              metadata: {
                sourceRootId: node.id,
                newRootId: idMap.get(node.id),
                count: created.length,
              },
              ip: ip ?? null,
            },
            tx,
          );

          return {
            sourceRootId: node.id,
            newRootId: idMap.get(node.id),
            nodes: created.map((row) => row.code),
          };
        },
        { isolationLevel: 'serializable' },
      );
    } catch (error) {
      if (isSerializationFailure(error)) {
        throw new ProblemException(
          Problems.conflict(
            'Conflicto de concurrencia al duplicar; reintenta',
            'node.concurrent_duplicate',
          ),
        );
      }
      if (isUniqueViolation(error)) {
        throw new ProblemException(
          Problems.conflict('Colisión de código al duplicar; reintenta', 'node.code_conflict'),
        );
      }
      throw error;
    }
  }

  /** Soft-delete del subárbol completo (los hijos quedan fuera de las consultas). */
  async deactivateNode(
    product: ResolvedProduct,
    code: string,
    actorId: string,
    ip?: string,
  ): Promise<{ deactivated: number }> {
    return this.db.transaction(async (tx) => {
      const node = await this.findActiveOrThrow(tx, product.id, code, true);
      const deleted = await tx
        .update(productNodes)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(productNodes.productId, product.id),
            sql`${productNodes.path} <@ ${node.path}::ltree`,
            isNull(productNodes.deletedAt),
          ),
        )
        .returning({ id: productNodes.id });

      await this.activity.emit(
        {
          productId: product.id,
          actorUserId: actorId,
          action: 'node.deactivated',
          entityKind: 'node',
          entityId: node.id,
          summary: `Subárbol desactivado desde ${node.code} (${deleted.length} nodos)`,
          metadata: { rootId: node.id, count: deleted.length },
          ip: ip ?? null,
        },
        tx,
      );

      return { deactivated: deleted.length };
    });
  }
}
