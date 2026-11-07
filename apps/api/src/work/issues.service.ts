import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  productNodes,
  relations,
  stateTransitions,
  tasks,
  issues,
  workflowStates,
} from '@devcycle/db';
import {
  Problems,
  type CreateIssueInput,
  type ListIssuesQueryInput,
  type TransitionIssueInput,
  type UpdateIssueInput,
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

export interface IssueDto {
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
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  nodeCodes: string[];
  linkedTaskIds: string[];
}

@Injectable()
export class IssuesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly activity: ActivityService,
    private readonly iam: IamService,
  ) {}

  private async findActiveOrThrow(executor: DbExecutor, productId: string, idOrCode: string) {
    const byId = UUID_RE.test(idOrCode);
    const [row] = await executor
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.productId, productId),
          byId ? eq(issues.id, idOrCode) : eq(issues.code, idOrCode),
          isNull(issues.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new ProblemException(Problems.notFound('Incidencia', idOrCode));
    return row;
  }

  private async resolveStateId(
    executor: DbExecutor,
    productId: string,
    scope: 'task' | 'issue',
    stateKey: string,
  ) {
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

  private async resolveInitialStateId(executor: DbExecutor, productId: string) {
    const [viaTransition] = await executor
      .select({ state: workflowStates })
      .from(stateTransitions)
      .innerJoin(workflowStates, eq(workflowStates.id, stateTransitions.toStateId))
      .where(
        and(
          eq(stateTransitions.productId, productId),
          eq(stateTransitions.scope, 'issue'),
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
      .where(and(eq(workflowStates.productId, productId), eq(workflowStates.scope, 'issue')))
      .orderBy(workflowStates.position)
      .limit(1);
    if (!first)
      throw new ProblemException(Problems.internal('Producto sin workflow_states (seed)'));
    return {
      id: first.id,
      key: first.key,
      label: first.label,
      color: first.color,
      isTerminal: first.isTerminal,
    };
  }

  private async loadNodeCodes(executor: DbExecutor, issueId: string): Promise<string[]> {
    const rows = await executor
      .select({ code: productNodes.code })
      .from(relations)
      .innerJoin(productNodes, eq(productNodes.id, relations.targetId))
      .where(
        and(
          eq(relations.sourceKind, 'issue'),
          eq(relations.sourceId, issueId),
          eq(relations.targetKind, 'node'),
        ),
      );
    const rows2 = await executor
      .select({ code: productNodes.code })
      .from(relations)
      .innerJoin(productNodes, eq(productNodes.id, relations.sourceId))
      .where(
        and(
          eq(relations.targetKind, 'issue'),
          eq(relations.targetId, issueId),
          eq(relations.sourceKind, 'node'),
        ),
      );
    return [...new Set([...rows.map((r) => r.code), ...rows2.map((r) => r.code)])].sort();
  }

  private async loadLinkedTaskIds(
    executor: DbExecutor,
    productId: string,
    issueId: string,
  ): Promise<string[]> {
    const out = await executor
      .select({ targetId: relations.targetId })
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'issue'),
          eq(relations.sourceId, issueId),
          eq(relations.targetKind, 'task'),
        ),
      );
    const inbound = await executor
      .select({ sourceId: relations.sourceId, relationType: relations.relationType })
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.targetKind, 'issue'),
          eq(relations.targetId, issueId),
          eq(relations.sourceKind, 'task'),
        ),
      );
    const ids = [...out.map((r) => r.targetId), ...inbound.map((r) => r.sourceId)];
    return [...new Set(ids)];
  }

  async toDto(executor: DbExecutor, row: typeof issues.$inferSelect): Promise<IssueDto> {
    const [state] = await executor
      .select()
      .from(workflowStates)
      .where(eq(workflowStates.id, row.stateId))
      .limit(1);
    const [nodeCodes, linkedTaskIds] = await Promise.all([
      this.loadNodeCodes(executor, row.id),
      this.loadLinkedTaskIds(executor, row.productId, row.id),
    ]);
    const steps = (row.reproductionSteps as unknown as string[]) ?? [];
    return {
      id: row.id,
      productId: row.productId,
      code: row.code,
      title: row.title,
      description: row.description,
      expectedBehavior: row.expectedBehavior,
      observedBehavior: row.observedBehavior,
      reproductionSteps: steps,
      severity: row.severity,
      priority: row.priority,
      stateKey: state?.key ?? '',
      stateLabel: state?.label ?? '',
      stateColor: state?.color ?? null,
      assigneeId: row.assigneeId,
      reopenCount: row.reopenCount,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resolvedAt: row.resolvedAt,
      nodeCodes,
      linkedTaskIds,
    };
  }

  async listStates(productId: string) {
    return this.db
      .select()
      .from(workflowStates)
      .where(and(eq(workflowStates.productId, productId), eq(workflowStates.scope, 'issue')))
      .orderBy(workflowStates.position);
  }

  async listIssues(productId: string, filters: ListIssuesQueryInput): Promise<IssueDto[]> {
    const conditions = [eq(issues.productId, productId), isNull(issues.deletedAt)];
    if (filters.severity) conditions.push(eq(issues.severity, filters.severity));
    if (filters.priority) conditions.push(eq(issues.priority, filters.priority));
    if (filters.assigneeId) conditions.push(eq(issues.assigneeId, filters.assigneeId));
    if (filters.stateKey) {
      conditions.push(
        sql`${issues.stateId} IN (SELECT id FROM workflow_states WHERE product_id = ${productId} AND scope = 'issue' AND key = ${filters.stateKey})`,
      );
    }
    if (filters.nodeCode) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM relations r JOIN product_nodes n ON n.id = r.target_id
          WHERE r.product_id = ${productId} AND r.source_kind = 'issue' AND r.target_kind = 'node'
            AND r.source_id = ${issues.id} AND n.code = ${filters.nodeCode}
        )`,
      );
    }
    if (filters.q) {
      const q = `%${filters.q.toLowerCase()}%`;
      conditions.push(
        sql`(lower(${issues.title}) LIKE ${q} OR lower(coalesce(${issues.code}, '')) LIKE ${q} OR lower(${issues.description}) LIKE ${q} OR lower(${issues.observedBehavior}) LIKE ${q})`,
      );
    }
    const rows = await this.db
      .select()
      .from(issues)
      .where(and(...conditions))
      .orderBy(desc(issues.updatedAt));
    return Promise.all(rows.map((row) => this.toDto(this.db, row)));
  }

  async getIssue(productId: string, idOrCode: string): Promise<IssueDto> {
    const row = await this.findActiveOrThrow(this.db, productId, idOrCode);
    return this.toDto(this.db, row);
  }

  async listForNode(productId: string, nodeCode: string): Promise<IssueDto[]> {
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
    const linked = await this.db
      .select({ id: relations.sourceId })
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'issue'),
          eq(relations.targetKind, 'node'),
          eq(relations.targetId, node.id),
        ),
      );
    if (linked.length === 0) return [];
    const ids = linked.map((r) => r.id);
    const rows = await this.db
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.productId, productId),
          isNull(issues.deletedAt),
          sql`${issues.id} IN (${sql.join(
            ids.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        ),
      )
      .orderBy(desc(issues.updatedAt));
    return Promise.all(rows.map((row) => this.toDto(this.db, row)));
  }

  async createIssue(
    product: ResolvedProduct,
    input: CreateIssueInput,
    actorId: string,
    ip?: string,
  ): Promise<IssueDto> {
    try {
      return await this.db.transaction(async (tx) => {
        const state = input.stateKey
          ? await this.resolveStateId(tx, product.id, 'issue', input.stateKey)
          : await this.resolveInitialStateId(tx, product.id);
        const [created] = await tx
          .insert(issues)
          .values({
            productId: product.id,
            code: input.code ?? null,
            title: input.title,
            description: input.description,
            expectedBehavior: input.expectedBehavior,
            observedBehavior: input.observedBehavior,
            reproductionSteps: input.reproductionSteps ?? [],
            severity: input.severity,
            priority: input.priority,
            stateId: state.id,
            assigneeId: input.assigneeId ?? null,
            createdBy: actorId,
            resolvedAt: state.isTerminal ? new Date() : null,
          })
          .returning();
        if (!created) throw new Error('Insert de incidencia no devolvió fila');
        for (const nodeCode of input.nodeCodes ?? []) {
          await this.linkNodeInternal(tx, created.id, product.id, nodeCode, actorId, ip);
        }
        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'issue.created',
            entityKind: 'issue',
            entityId: created.id,
            summary: `Incidencia creada: ${created.code ? `${created.code} · ` : ''}${created.title}`,
            metadata: {
              severity: input.severity,
              stateKey: state.key,
              nodeCodes: input.nodeCodes ?? [],
            },
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
            `Ya existe una incidencia con código '${input.code}' en este producto`,
            'issue.code_conflict',
          ),
        );
      }
      throw error;
    }
  }

  private async linkNodeInternal(
    tx: DbExecutor,
    issueId: string,
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
    await tx
      .insert(relations)
      .values({
        productId,
        sourceKind: 'issue',
        sourceId: issueId,
        targetKind: 'node',
        targetId: node.id,
        relationType: 'affects',
        metadata: {},
        createdBy: actorId,
      })
      .onConflictDoNothing();
    await this.activity.emit(
      {
        productId,
        actorUserId: actorId,
        action: 'issue.node_linked',
        entityKind: 'issue',
        entityId: issueId,
        summary: `Incidencia vinculada al nodo ${nodeCode}`,
        metadata: { nodeId: node.id, nodeCode },
        ip: ip ?? null,
      },
      tx,
    );
  }

  async updateIssue(
    product: ResolvedProduct,
    idOrCode: string,
    input: UpdateIssueInput,
    actorId: string,
    ip?: string,
  ): Promise<IssueDto> {
    return this.db.transaction(async (tx) => {
      const current = await this.findActiveOrThrow(tx, product.id, idOrCode);
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.title !== undefined) updates['title'] = input.title;
      if (input.description !== undefined) updates['description'] = input.description;
      if (input.expectedBehavior !== undefined)
        updates['expectedBehavior'] = input.expectedBehavior;
      if (input.observedBehavior !== undefined)
        updates['observedBehavior'] = input.observedBehavior;
      if (input.reproductionSteps !== undefined)
        updates['reproductionSteps'] = input.reproductionSteps;
      if (input.severity !== undefined) updates['severity'] = input.severity;
      if (input.priority !== undefined) updates['priority'] = input.priority;
      if (input.assigneeId !== undefined) updates['assigneeId'] = input.assigneeId;
      const [updated] = await tx
        .update(issues)
        .set(updates)
        .where(eq(issues.id, current.id))
        .returning();
      await this.activity.emit(
        {
          productId: product.id,
          actorUserId: actorId,
          action: 'issue.updated',
          entityKind: 'issue',
          entityId: current.id,
          summary: `Incidencia editada: ${(updated?.title ?? current.title).slice(0, 80)}`,
          metadata: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
          ip: ip ?? null,
        },
        tx,
      );
      return this.toDto(tx, updated!);
    });
  }

  async transitionIssue(
    product: ResolvedProduct,
    idOrCode: string,
    input: TransitionIssueInput,
    actorId: string,
    ip?: string,
  ): Promise<IssueDto> {
    return this.db.transaction(async (tx) => {
      const current = await this.findActiveOrThrow(tx, product.id, idOrCode);
      const [fromState] = await tx
        .select()
        .from(workflowStates)
        .where(eq(workflowStates.id, current.stateId))
        .limit(1);
      const target = await this.resolveStateId(tx, product.id, 'issue', input.toStateKey);
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
        .where(
          and(eq(stateTransitions.productId, product.id), eq(stateTransitions.scope, 'issue')),
        );
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
            'issue.invalid_transition',
          ),
        );
      }
      const reopenDelta =
        fromKey === 'resolved' || fromKey === 'closed' ? (input.toStateKey === 'open' ? 1 : 0) : 0;
      const [updated] = await tx
        .update(issues)
        .set({
          stateId: target.id,
          updatedAt: new Date(),
          resolvedAt: target.isTerminal ? new Date() : null,
          reopenCount: current.reopenCount + reopenDelta,
        })
        .where(eq(issues.id, current.id))
        .returning();
      await this.activity.emit(
        {
          productId: product.id,
          actorUserId: actorId,
          action: 'issue.transitioned',
          entityKind: 'issue',
          entityId: current.id,
          summary: `Incidencia movida a ${target.label}: ${current.title.slice(0, 80)}`,
          metadata: { from: fromKey, to: input.toStateKey },
          ip: ip ?? null,
        },
        tx,
      );
      return this.toDto(tx, updated!);
    });
  }

  async resolveIssue(
    product: ResolvedProduct,
    idOrCode: string,
    actorId: string,
    ip?: string,
  ): Promise<IssueDto> {
    // Atajo semántico: open/in_progress → resolved si la transición existe.
    const current = await this.findActiveOrThrow(this.db, product.id, idOrCode);
    const [fromState] = await this.db
      .select()
      .from(workflowStates)
      .where(eq(workflowStates.id, current.stateId))
      .limit(1);
    if (fromState?.key === 'resolved' || fromState?.key === 'closed')
      return this.toDto(this.db, current);
    return this.transitionIssue(product, idOrCode, { toStateKey: 'resolved' }, actorId, ip);
  }

  async deleteIssue(product: ResolvedProduct, idOrCode: string, actorId: string, ip?: string) {
    const current = await this.findActiveOrThrow(this.db, product.id, idOrCode);
    const [deleted] = await this.db
      .update(issues)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(issues.id, current.id))
      .returning({ id: issues.id });
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'issue.deleted',
      entityKind: 'issue',
      entityId: current.id,
      summary: `Incidencia desactivada: ${current.title}`,
      metadata: {},
      ip: ip ?? null,
    });
    return { deleted: Boolean(deleted) };
  }

  async linkNode(
    product: ResolvedProduct,
    idOrCode: string,
    nodeCode: string,
    actorId: string,
    ip?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const issue = await this.findActiveOrThrow(tx, product.id, idOrCode);
      await this.linkNodeInternal(tx, issue.id, product.id, nodeCode, actorId, ip);
      return { issueId: issue.id, nodeCode };
    });
  }

  async unlinkNode(
    product: ResolvedProduct,
    idOrCode: string,
    nodeCode: string,
    actorId: string,
    ip?: string,
  ) {
    const issue = await this.findActiveOrThrow(this.db, product.id, idOrCode);
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
          eq(relations.sourceKind, 'issue'),
          eq(relations.sourceId, issue.id),
          eq(relations.targetKind, 'node'),
          eq(relations.targetId, node.id),
        ),
      )
      .returning({ id: relations.id });
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'issue.node_unlinked',
      entityKind: 'issue',
      entityId: issue.id,
      summary: `Incidencia desvinculada del nodo ${nodeCode}`,
      metadata: { nodeId: node.id, nodeCode },
      ip: ip ?? null,
    });
    return { unlinked: deleted.length > 0 };
  }

  /** Crea la tarea correctiva y la vincula con la incidencia en una transacción. */
  async linkTask(
    product: ResolvedProduct,
    idOrCode: string,
    taskId: string,
    actorId: string,
    ip?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const issue = await this.findActiveOrThrow(tx, product.id, idOrCode);
      const [task] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.productId, product.id), isNull(tasks.deletedAt)))
        .limit(1);
      if (!task)
        throw new ProblemException(Problems.unprocessable('La tarea no existe en este producto'));
      try {
        const [created] = await tx
          .insert(relations)
          .values({
            productId: product.id,
            sourceKind: 'issue',
            sourceId: issue.id,
            targetKind: 'task',
            targetId: task.id,
            relationType: 'relates_to',
            metadata: { note: 'tarea correctiva' },
            createdBy: actorId,
          })
          .returning();
        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'issue.task_linked',
            entityKind: 'issue',
            entityId: issue.id,
            summary: `Incidencia vinculada a tarea correctiva`,
            metadata: { taskId: task.id },
            ip: ip ?? null,
          },
          tx,
        );
        return created!;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ProblemException(
            Problems.conflict('Esa vinculación ya existe', 'relation.duplicate'),
          );
        }
        throw error;
      }
    });
  }

  async listLinkedTasks(productId: string, idOrCode: string) {
    const issue = await this.findActiveOrThrow(this.db, productId, idOrCode);
    const out = await this.db
      .select()
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'issue'),
          eq(relations.sourceId, issue.id),
          eq(relations.targetKind, 'task'),
        ),
      );
    const inbound = await this.db
      .select()
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.targetKind, 'issue'),
          eq(relations.targetId, issue.id),
          eq(relations.sourceKind, 'task'),
        ),
      );
    return [...out, ...inbound];
  }
}
