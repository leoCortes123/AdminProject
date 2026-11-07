import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  issues,
  productNodes,
  relations,
  stateTransitions,
  tasks,
  workflowStates,
} from '@devcycle/db';
import {
  Problems,
  type CreateDependencyInput,
  type CreateTaskRelationInput,
  type CreateTaskInput,
  type ListTasksQueryInput,
  type TransitionTaskInput,
  type UpdateTaskInput,
} from '@devcycle/shared';
import { ProblemException } from '../common/problem.exception';
import { DB, type Database } from '../database';
import { ActivityService, type DbExecutor } from '../common/activity.service';
import type { ResolvedProduct } from '../common/authenticated-request';
import { IamService } from '../iam/iam.service';
import { canTransition as evalTransition } from './work-transitions';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TaskDto {
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
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  nodeCodes: string[];
  blockedBy: taskDependencyDto[];
  blocks: taskDependencyDto[];
}

export interface taskDependencyDto {
  id: string;
  targetId: string;
  relationType: string;
}

@Injectable()
export class TasksService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly activity: ActivityService,
    private readonly iam: IamService,
  ) {}

  private async findActiveOrThrow(executor: DbExecutor, productId: string, idOrCode: string) {
    const byId = UUID_RE.test(idOrCode);
    const [row] = await executor
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.productId, productId),
          byId ? eq(tasks.id, idOrCode) : eq(tasks.code, idOrCode),
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new ProblemException(Problems.notFound('Tarea', idOrCode));
    return row;
  }

  private async resolveStateId(
    executor: DbExecutor,
    productId: string,
    scope: 'task' | 'issue',
    stateKey: string,
  ): Promise<{
    id: string;
    key: string;
    label: string;
    color: string | null;
    isTerminal: boolean;
  }> {
    const [state] = await executor
      .select()
      .from(workflowStates)
      .where(
        and(
          eq(workflowStates.productId, productId),
          eq(workflowStates.scope, scope),
          eq(workflowStates.key, stateKey),
        ),
      )
      .limit(1);
    if (!state) {
      throw new ProblemException(
        Problems.unprocessable(`Estado '${stateKey}' no existe para ${scope} en este producto`),
      );
    }
    return {
      id: state.id,
      key: state.key,
      label: state.label,
      color: state.color,
      isTerminal: state.isTerminal,
    };
  }

  private async resolveInitialStateId(
    executor: DbExecutor,
    productId: string,
    scope: 'task' | 'issue',
  ) {
    // Estado inicial = destino de la transición (NULL → *) o posición 0.
    const [viaTransition] = await executor
      .select({ state: workflowStates })
      .from(stateTransitions)
      .innerJoin(workflowStates, eq(workflowStates.id, stateTransitions.toStateId))
      .where(
        and(
          eq(stateTransitions.productId, productId),
          eq(stateTransitions.scope, scope),
          isNull(stateTransitions.fromStateId),
        ),
      )
      .limit(1);
    if (viaTransition?.state) {
      const s = viaTransition.state;
      return { id: s.id, key: s.key, label: s.label, color: s.color, isTerminal: s.isTerminal };
    }
    const [first] = await executor
      .select()
      .from(workflowStates)
      .where(and(eq(workflowStates.productId, productId), eq(workflowStates.scope, scope)))
      .orderBy(workflowStates.position)
      .limit(1);
    if (!first) {
      throw new ProblemException(Problems.internal('Producto sin workflow_states (seed)'));
    }
    return {
      id: first.id,
      key: first.key,
      label: first.label,
      color: first.color,
      isTerminal: first.isTerminal,
    };
  }

  private async loadNodeCodes(executor: DbExecutor, taskId: string): Promise<string[]> {
    // source_kind='task' → target_kind='node' (affects) o inversa node→task.
    const rows = await executor
      .select({ code: productNodes.code })
      .from(relations)
      .innerJoin(productNodes, eq(productNodes.id, relations.targetId))
      .where(
        and(
          eq(relations.sourceKind, 'task'),
          eq(relations.sourceId, taskId),
          eq(relations.targetKind, 'node'),
        ),
      );
    const rows2 = await executor
      .select({ code: productNodes.code })
      .from(relations)
      .innerJoin(productNodes, eq(productNodes.id, relations.sourceId))
      .where(
        and(
          eq(relations.targetKind, 'task'),
          eq(relations.targetId, taskId),
          eq(relations.sourceKind, 'node'),
        ),
      );
    const codes = [...rows.map((r) => r.code), ...rows2.map((r) => r.code)];
    return [...new Set(codes)].sort();
  }

  private async loadDependencies(executor: DbExecutor, taskId: string, productId: string) {
    const outgoing = await executor
      .select()
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'task'),
          eq(relations.sourceId, taskId),
          eq(relations.targetKind, 'task'),
        ),
      );
    const incoming = await executor
      .select()
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.targetKind, 'task'),
          eq(relations.targetId, taskId),
          eq(relations.sourceKind, 'task'),
        ),
      );
    const blocks = outgoing
      .filter((r) => r.relationType === 'blocks')
      .map((r) => ({ id: r.id, targetId: r.targetId, relationType: r.relationType }));
    const blockedBy = outgoing
      .filter((r) => ['is_blocked_by', 'depends_on'].includes(r.relationType))
      .map((r) => ({ id: r.id, targetId: r.targetId, relationType: r.relationType }));
    // Las entrantes "X blocks this" también bloquean a esta tarea.
    for (const r of incoming) {
      if (r.relationType === 'blocks') {
        blockedBy.push({ id: r.id, targetId: r.sourceId, relationType: 'is_blocked_by' });
      }
    }
    return { blockedBy, blocks };
  }

  async toDto(executor: DbExecutor, row: typeof tasks.$inferSelect): Promise<TaskDto> {
    const [state] = await executor
      .select()
      .from(workflowStates)
      .where(eq(workflowStates.id, row.stateId))
      .limit(1);
    const [nodeCodes, deps] = await Promise.all([
      this.loadNodeCodes(executor, row.id),
      this.loadDependencies(executor, row.id, row.productId),
    ]);
    const criteria =
      (row.acceptanceCriteria as unknown as Array<{ text: string; done: boolean }>) ?? [];
    return {
      id: row.id,
      productId: row.productId,
      code: row.code,
      title: row.title,
      description: row.description,
      type: row.type,
      stateKey: state?.key ?? '',
      stateLabel: state?.label ?? '',
      stateColor: state?.color ?? null,
      priority: row.priority,
      assigneeId: row.assigneeId,
      estimateMinutes: row.estimateMinutes,
      acceptanceCriteria: criteria,
      dueDate: row.dueDate,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
      nodeCodes,
      blockedBy: deps.blockedBy,
      blocks: deps.blocks,
    };
  }

  async listStates(productId: string) {
    return this.db
      .select()
      .from(workflowStates)
      .where(and(eq(workflowStates.productId, productId), eq(workflowStates.scope, 'task')))
      .orderBy(workflowStates.position);
  }

  async listTransitions(productId: string) {
    return this.db
      .select({
        id: stateTransitions.id,
        fromStateId: stateTransitions.fromStateId,
        toStateId: stateTransitions.toStateId,
        requiredPermission: stateTransitions.requiredPermission,
        requiresConfirmation: stateTransitions.requiresConfirmation,
        fromKey: sql<
          string | null
        >`(SELECT key FROM workflow_states WHERE id = ${stateTransitions.fromStateId})`,
        toKey: sql<string>`(SELECT key FROM workflow_states WHERE id = ${stateTransitions.toStateId})`,
      })
      .from(stateTransitions)
      .where(and(eq(stateTransitions.productId, productId), eq(stateTransitions.scope, 'task')));
  }

  async listTasks(productId: string, filters: ListTasksQueryInput): Promise<TaskDto[]> {
    const conditions = [eq(tasks.productId, productId), isNull(tasks.deletedAt)];
    if (filters.type) conditions.push(eq(tasks.type, filters.type));
    if (filters.priority) conditions.push(eq(tasks.priority, filters.priority));
    if (filters.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));
    if (filters.stateKey) {
      conditions.push(
        sql`${tasks.stateId} IN (SELECT id FROM workflow_states WHERE product_id = ${productId} AND scope = 'task' AND key = ${filters.stateKey})`,
      );
    }
    if (filters.nodeCode) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM relations r
          JOIN product_nodes n ON n.id = r.target_id
          WHERE r.product_id = ${productId}
            AND r.source_kind = 'task' AND r.target_kind = 'node'
            AND r.source_id = ${tasks.id} AND n.code = ${filters.nodeCode}
          UNION ALL
          SELECT 1 FROM relations r
          JOIN product_nodes n ON n.id = r.source_id
          WHERE r.product_id = ${productId}
            AND r.target_kind = 'task' AND r.source_kind = 'node'
            AND r.target_id = ${tasks.id} AND n.code = ${filters.nodeCode}
        )`,
      );
    }
    if (filters.q) {
      const q = `%${filters.q.toLowerCase()}%`;
      conditions.push(
        sql`(lower(${tasks.title}) LIKE ${q} OR lower(coalesce(${tasks.code}, '')) LIKE ${q} OR lower(${tasks.description}) LIKE ${q})`,
      );
    }
    const rows = await this.db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.updatedAt));
    return Promise.all(rows.map((row) => this.toDto(this.db, row)));
  }

  async getTask(productId: string, idOrCode: string): Promise<TaskDto> {
    const row = await this.findActiveOrThrow(this.db, productId, idOrCode);
    return this.toDto(this.db, row);
  }

  async listForNode(productId: string, nodeCode: string): Promise<TaskDto[]> {
    const [node] = await this.db
      .select({ id: productNodes.id })
      .from(productNodes)
      .where(
        and(
          eq(productNodes.productId, productId),
          eq(productNodes.code, nodeCode),
          isNull(productNodes.deletedAt),
        ),
      )
      .limit(1);
    if (!node) throw new ProblemException(Problems.notFound('Nodo', nodeCode));
    const linkedIds = await this.db
      .select({ id: relations.sourceId })
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'task'),
          eq(relations.targetKind, 'node'),
          eq(relations.targetId, node.id),
        ),
      );
    if (linkedIds.length === 0) return [];
    const ids = linkedIds.map((r) => r.id);
    const rows = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.productId, productId),
          isNull(tasks.deletedAt),
          sql`${tasks.id} IN (${sql.join(
            ids.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        ),
      )
      .orderBy(desc(tasks.updatedAt));
    return Promise.all(rows.map((row) => this.toDto(this.db, row)));
  }

  async createTask(
    product: ResolvedProduct,
    input: CreateTaskInput,
    actorId: string,
    ip?: string,
  ): Promise<TaskDto> {
    try {
      return await this.db.transaction(async (tx) => {
        const state = input.stateKey
          ? await this.resolveStateId(tx, product.id, 'task', input.stateKey)
          : await this.resolveInitialStateId(tx, product.id, 'task');
        const [created] = await tx
          .insert(tasks)
          .values({
            productId: product.id,
            code: input.code ?? null,
            title: input.title,
            description: input.description,
            type: input.type,
            stateId: state.id,
            priority: input.priority,
            assigneeId: input.assigneeId ?? null,
            estimateMinutes: input.estimateMinutes ?? null,
            acceptanceCriteria: input.acceptanceCriteria ?? [],
            dueDate: input.dueDate ?? null,
            createdBy: actorId,
            completedAt: state.isTerminal ? new Date() : null,
          })
          .returning();
        if (!created) throw new Error('Insert de tarea no devolvió fila');

        for (const nodeCode of input.nodeCodes ?? []) {
          await this.linkNodeInternal(tx, created.id, product.id, nodeCode, actorId, ip);
        }

        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'task.created',
            entityKind: 'task',
            entityId: created.id,
            summary: `Tarea creada: ${created.code ? `${created.code} · ` : ''}${created.title}`,
            metadata: { type: input.type, stateKey: state.key, nodeCodes: input.nodeCodes ?? [] },
            ip: ip ?? null,
          },
          tx,
        );
        return this.toDto(tx, created);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProblemException(
          Problems.conflict(
            `Ya existe una tarea con código '${input.code}' en este producto`,
            'task.code_conflict',
          ),
        );
      }
      throw error;
    }
  }

  private async linkNodeInternal(
    tx: DbExecutor,
    taskId: string,
    productId: string,
    nodeCode: string,
    actorId: string,
    ip?: string,
  ) {
    const [node] = await tx
      .select({ id: productNodes.id })
      .from(productNodes)
      .where(
        and(
          eq(productNodes.productId, productId),
          eq(productNodes.code, nodeCode),
          isNull(productNodes.deletedAt),
        ),
      )
      .limit(1);
    if (!node) {
      throw new ProblemException(
        Problems.unprocessable(`El nodo '${nodeCode}' no existe en este producto`),
      );
    }
    // El trigger de relations valida producto + existencia; si existe ya, 409.
    try {
      await tx
        .insert(relations)
        .values({
          productId,
          sourceKind: 'task',
          sourceId: taskId,
          targetKind: 'node',
          targetId: node.id,
          relationType: 'affects',
          metadata: {},
          createdBy: actorId,
        })
        .onConflictDoNothing();
    } catch (error) {
      throw new ProblemException(
        Problems.unprocessable(
          `No se pudo vincular la tarea al nodo '${nodeCode}': ${(error as Error).message}`,
        ),
      );
    }
    await this.activity.emit(
      {
        productId,
        actorUserId: actorId,
        action: 'task.node_linked',
        entityKind: 'task',
        entityId: taskId,
        summary: `Tarea vinculada al nodo ${nodeCode}`,
        metadata: { nodeId: node.id, nodeCode },
        ip: ip ?? null,
      },
      tx as DbExecutor,
    );
  }

  async updateTask(
    product: ResolvedProduct,
    idOrCode: string,
    input: UpdateTaskInput,
    actorId: string,
    ip?: string,
  ): Promise<TaskDto> {
    return this.db.transaction(async (tx) => {
      const current = await this.findActiveOrThrow(tx, product.id, idOrCode);
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.title !== undefined) updates['title'] = input.title;
      if (input.description !== undefined) updates['description'] = input.description;
      if (input.type !== undefined) updates['type'] = input.type;
      if (input.priority !== undefined) updates['priority'] = input.priority;
      if (input.assigneeId !== undefined) updates['assigneeId'] = input.assigneeId;
      if (input.estimateMinutes !== undefined) updates['estimateMinutes'] = input.estimateMinutes;
      if (input.acceptanceCriteria !== undefined)
        updates['acceptanceCriteria'] = input.acceptanceCriteria;
      if (input.dueDate !== undefined) updates['dueDate'] = input.dueDate;
      const [updated] = await tx
        .update(tasks)
        .set(updates)
        .where(eq(tasks.id, current.id))
        .returning();
      await this.activity.emit(
        {
          productId: product.id,
          actorUserId: actorId,
          action: 'task.updated',
          entityKind: 'task',
          entityId: current.id,
          summary: `Tarea editada: ${(updated?.title ?? current.title).slice(0, 80)}`,
          metadata: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
          ip: ip ?? null,
        },
        tx,
      );
      return this.toDto(tx, updated!);
    });
  }

  async transitionTask(
    product: ResolvedProduct,
    idOrCode: string,
    input: TransitionTaskInput,
    actorId: string,
    ip?: string,
  ): Promise<TaskDto> {
    return this.db.transaction(async (tx) => {
      const current = await this.findActiveOrThrow(tx, product.id, idOrCode);
      const [fromState] = await tx
        .select()
        .from(workflowStates)
        .where(eq(workflowStates.id, current.stateId))
        .limit(1);
      const target = await this.resolveStateId(tx, product.id, 'task', input.toStateKey);
      const fromKey = fromState?.key ?? '';
      if (fromKey === input.toStateKey) return this.toDto(tx, current);

      const permissions = await this.iam.getEffectivePermissions(actorId, product.id);
      const rows = await tx
        .select({
          fromKey: sql<
            string | null
          >`(SELECT key FROM workflow_states WHERE id = ${stateTransitions.fromStateId})`,
          toKey: sql<string>`(SELECT key FROM workflow_states WHERE id = ${stateTransitions.toStateId})`,
          requiredPermission: stateTransitions.requiredPermission,
          requiresConfirmation: stateTransitions.requiresConfirmation,
        })
        .from(stateTransitions)
        .where(and(eq(stateTransitions.productId, product.id), eq(stateTransitions.scope, 'task')));
      const decision = evalTransition(rows, fromKey, input.toStateKey, permissions);
      if (!decision.allowed) {
        if (decision.reason === 'falta_permiso') {
          throw new ProblemException(
            Problems.forbidden(
              `La transición '${fromKey}' → '${input.toStateKey}' requiere el permiso ${decision.requiredPermission}`,
            ),
          );
        }
        throw new ProblemException(
          Problems.conflict(
            `Transición no permitida: ${fromKey} → ${input.toStateKey}`,
            'task.invalid_transition',
          ),
        );
      }

      const [updated] = await tx
        .update(tasks)
        .set({
          stateId: target.id,
          updatedAt: new Date(),
          completedAt: target.isTerminal ? new Date() : null,
        })
        .where(eq(tasks.id, current.id))
        .returning();
      await this.activity.emit(
        {
          productId: product.id,
          actorUserId: actorId,
          action: 'task.transitioned',
          entityKind: 'task',
          entityId: current.id,
          summary: `Tarea movida a ${target.label}: ${current.title.slice(0, 80)}`,
          metadata: {
            from: fromKey,
            to: input.toStateKey,
            requiresConfirmation: decision.requiresConfirmation,
          },
          ip: ip ?? null,
        },
        tx,
      );
      return this.toDto(tx, updated!);
    });
  }

  async deleteTask(product: ResolvedProduct, idOrCode: string, actorId: string, ip?: string) {
    const current = await this.findActiveOrThrow(this.db, product.id, idOrCode);
    const [deleted] = await this.db
      .update(tasks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(tasks.id, current.id))
      .returning({ id: tasks.id });
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'task.deleted',
      entityKind: 'task',
      entityId: current.id,
      summary: `Tarea desactivada: ${current.title}`,
      metadata: {},
      ip: ip ?? null,
    });
    return { deleted: Boolean(deleted) };
  }

  // -- Dependencias task↔task (F3-T04) ------------------------------------
  private async wouldCreateCycle(
    executor: DbExecutor,
    productId: string,
    fromId: string,
    toId: string,
  ): Promise<boolean> {
    // Si `to` ya (transitivamente) bloquea a `from`, crear from→to cierra un ciclo.
    const queue: string[] = [toId];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === fromId) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      const next = await executor
        .select({ targetId: relations.targetId })
        .from(relations)
        .where(
          and(
            eq(relations.productId, productId),
            eq(relations.sourceKind, 'task'),
            eq(relations.sourceId, current),
            eq(relations.targetKind, 'task'),
            eq(relations.relationType, 'blocks'),
          ),
        );
      for (const n of next) queue.push(n.targetId);
    }
    return false;
  }

  async addDependency(
    product: ResolvedProduct,
    idOrCode: string,
    input: CreateDependencyInput,
    actorId: string,
    ip?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const source = await this.findActiveOrThrow(tx, product.id, idOrCode);
      if (source.id === input.targetId) {
        throw new ProblemException(
          Problems.unprocessable('Una tarea no puede depender de sí misma'),
        );
      }
      const [target] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.id, input.targetId),
            eq(tasks.productId, product.id),
            isNull(tasks.deletedAt),
          ),
        )
        .limit(1);
      if (!target) {
        throw new ProblemException(
          Problems.unprocessable('La tarea destino no existe en este producto'),
        );
      }
      if (input.relationType === 'blocks') {
        const cycle = await this.wouldCreateCycle(tx, product.id, source.id, target.id);
        if (cycle) {
          throw new ProblemException(
            Problems.unprocessable('La dependencia crearía un ciclo (A bloquea B y B bloquea A)'),
          );
        }
      }
      try {
        const [created] = await tx
          .insert(relations)
          .values({
            productId: product.id,
            sourceKind: 'task',
            sourceId: source.id,
            targetKind: 'task',
            targetId: target.id,
            relationType: input.relationType,
            metadata: {},
            createdBy: actorId,
          })
          .returning();
        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'task.dependency_added',
            entityKind: 'task',
            entityId: source.id,
            summary: `Dependencia ${input.relationType} creada`,
            metadata: { targetId: target.id, relationType: input.relationType },
            ip: ip ?? null,
          },
          tx,
        );
        return created!;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ProblemException(
            Problems.conflict('Esa dependencia ya existe', 'relation.duplicate'),
          );
        }
        throw error;
      }
    });
  }

  async listDependencies(productId: string, idOrCode: string) {
    const task = await this.findActiveOrThrow(this.db, productId, idOrCode);
    return this.loadDependencies(this.db, task.id, productId);
  }

  async removeDependency(
    product: ResolvedProduct,
    relationId: string,
    actorId: string,
    ip?: string,
  ) {
    const deleted = await this.db
      .delete(relations)
      .where(and(eq(relations.id, relationId), eq(relations.productId, product.id)))
      .returning({ id: relations.id });
    if (deleted.length === 0) throw new ProblemException(Problems.notFound('Relación', relationId));
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'task.dependency_removed',
      entityKind: 'task',
      entityId: null,
      summary: `Dependencia eliminada: ${relationId}`,
      metadata: { relationId },
      ip: ip ?? null,
    });
    return { deleted: true };
  }

  // -- Relaciones task↔{node,item,issue} genéricas (F3-T05) ----------------
  async linkNode(
    product: ResolvedProduct,
    idOrCode: string,
    nodeCode: string,
    actorId: string,
    ip?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const task = await this.findActiveOrThrow(tx, product.id, idOrCode);
      await this.linkNodeInternal(tx, task.id, product.id, nodeCode, actorId, ip);
      return { taskId: task.id, nodeCode };
    });
  }

  async unlinkNode(
    product: ResolvedProduct,
    idOrCode: string,
    nodeCode: string,
    actorId: string,
    ip?: string,
  ) {
    const task = await this.findActiveOrThrow(this.db, product.id, idOrCode);
    const [node] = await this.db
      .select({ id: productNodes.id })
      .from(productNodes)
      .where(
        and(
          eq(productNodes.productId, product.id),
          eq(productNodes.code, nodeCode),
          isNull(productNodes.deletedAt),
        ),
      )
      .limit(1);
    if (!node) throw new ProblemException(Problems.notFound('Nodo', nodeCode));
    const deleted = await this.db
      .delete(relations)
      .where(
        and(
          eq(relations.productId, product.id),
          eq(relations.sourceKind, 'task'),
          eq(relations.sourceId, task.id),
          eq(relations.targetKind, 'node'),
          eq(relations.targetId, node.id),
        ),
      )
      .returning({ id: relations.id });
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'task.node_unlinked',
      entityKind: 'task',
      entityId: task.id,
      summary: `Tarea desvinculada del nodo ${nodeCode}`,
      metadata: { nodeId: node.id, nodeCode },
      ip: ip ?? null,
    });
    return { unlinked: deleted.length > 0 };
  }

  async createRelation(
    product: ResolvedProduct,
    idOrCode: string,
    input: CreateTaskRelationInput,
    actorId: string,
    ip?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const task = await this.findActiveOrThrow(tx, product.id, idOrCode);
      let targetId: string;
      let targetKind: string = input.targetKind ?? 'item';
      if (input.targetCode && !input.targetId) {
        // Resolve por código (doc INC-087 etc. o nodo PANT-02)
        if (/^(TAR|INC)-/.test(input.targetCode)) {
          const kind = input.targetCode.startsWith('TAR-') ? 'task' : 'issue';
          targetKind = kind;
          if (kind === 'task') {
            const [row] = await tx
              .select({ id: tasks.id })
              .from(tasks)
              .where(
                and(
                  eq(tasks.code, input.targetCode),
                  eq(tasks.productId, product.id),
                  isNull(tasks.deletedAt),
                ),
              )
              .limit(1);
            targetId = row?.id ?? '';
          } else {
            const [row] = await tx
              .select({ id: issues.id })
              .from(issues)
              .where(
                and(
                  eq(issues.code, input.targetCode),
                  eq(issues.productId, product.id),
                  isNull(issues.deletedAt),
                ),
              )
              .limit(1);
            targetId = row?.id ?? '';
          }
          if (!targetId)
            throw new ProblemException(
              Problems.unprocessable(`Destino '${input.targetCode}' no existe`),
            );
        } else {
          // Nodo por código o doc por código: probar nodo primero.
          const [node] = await tx
            .select({ id: productNodes.id })
            .from(productNodes)
            .where(
              and(
                eq(productNodes.productId, product.id),
                eq(productNodes.code, input.targetCode),
                isNull(productNodes.deletedAt),
              ),
            )
            .limit(1);
          if (node) {
            targetId = node.id;
            targetKind = 'node';
          } else {
            throw new ProblemException(
              Problems.unprocessable(`Destino '${input.targetCode}' no existe`),
            );
          }
        }
      } else if (input.targetId) {
        targetId = input.targetId;
        targetKind = input.targetKind ?? 'item';
      } else {
        throw new ProblemException(Problems.unprocessable('Falta targetId o targetCode'));
      }
      if (task.id === targetId) {
        throw new ProblemException(
          Problems.unprocessable('Una tarea no puede relacionarse consigo misma'),
        );
      }
      try {
        const [created] = await tx
          .insert(relations)
          .values({
            productId: product.id,
            sourceKind: 'task',
            sourceId: task.id,
            targetKind,
            targetId,
            relationType: input.relationType,
            metadata: {},
            createdBy: actorId,
          })
          .returning();
        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'relation.added',
            entityKind: 'task',
            entityId: task.id,
            summary: `Relación ${input.relationType} creada desde la tarea`,
            metadata: { targetId, targetKind, relationType: input.relationType },
            ip: ip ?? null,
          },
          tx,
        );
        return created!;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ProblemException(
            Problems.conflict('Esa relación ya existe', 'relation.duplicate'),
          );
        }
        throw error;
      }
    });
  }

  async listRelations(productId: string, idOrCode: string, direction: 'out' | 'in' | 'both') {
    const task = await this.findActiveOrThrow(this.db, productId, idOrCode);
    const base = eq(relations.productId, productId);
    if (direction === 'out') {
      return this.db
        .select()
        .from(relations)
        .where(and(base, eq(relations.sourceKind, 'task'), eq(relations.sourceId, task.id)))
        .orderBy(desc(relations.createdAt));
    }
    if (direction === 'in') {
      return this.db
        .select()
        .from(relations)
        .where(and(base, eq(relations.targetKind, 'task'), eq(relations.targetId, task.id)))
        .orderBy(desc(relations.createdAt));
    }
    return this.db
      .select()
      .from(relations)
      .where(
        and(
          base,
          sql`((source_kind = 'task' AND source_id = ${task.id}) OR (target_kind = 'task' AND target_id = ${task.id}))`,
        ),
      )
      .orderBy(desc(relations.createdAt));
  }
}
