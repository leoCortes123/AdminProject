import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  changes,
  contentItems,
  issues,
  productNodes,
  relations,
  tasks,
  testCases,
  workflowStates,
} from '@devcycle/db';
import {
  Problems,
  type CreateChangeInput,
  type CreateChangeRelationInput,
  type ExecuteChangeInput,
  type ListChangesQueryInput,
  type UpdateChangeInput,
} from '@devcycle/shared';
import { ProblemException } from '../common/problem.exception';
import { DB, type Database } from '../database';
import { ActivityService, type DbExecutor } from '../common/activity.service';
import type { ResolvedProduct } from '../common/authenticated-request';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ChangeDto {
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
  executedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  nodeCodes: string[];
  taskIds: string[];
  issueIds: string[];
  resolvedIssueIds: string[];
  testCaseIds: string[];
}

@Injectable()
export class ChangesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly activity: ActivityService,
  ) {}

  private async findActiveOrThrow(executor: DbExecutor, productId: string, idOrCode: string) {
    const byId = UUID_RE.test(idOrCode);
    const [row] = await executor
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.productId, productId),
          byId ? eq(changes.id, idOrCode) : eq(changes.code, idOrCode),
          isNull(changes.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new ProblemException(Problems.notFound('Modificación', idOrCode));
    return row;
  }

  private async loadLinks(executor: DbExecutor, changeId: string, productId: string) {
    const nodeCodes = await executor
      .select({ code: productNodes.code })
      .from(relations)
      .innerJoin(productNodes, eq(productNodes.id, relations.targetId))
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'change'),
          eq(relations.sourceId, changeId),
          eq(relations.targetKind, 'node'),
        ),
      );
    const taskIds = await executor
      .select({ id: relations.targetId })
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'change'),
          eq(relations.sourceId, changeId),
          eq(relations.targetKind, 'task'),
        ),
      );
    const issueIds = await executor
      .select({ id: relations.targetId, type: relations.relationType })
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'change'),
          eq(relations.sourceId, changeId),
          eq(relations.targetKind, 'issue'),
        ),
      );
    const testCaseIds = await executor
      .select({ id: relations.targetId })
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'change'),
          eq(relations.sourceId, changeId),
          eq(relations.targetKind, 'test_case'),
        ),
      );
    return {
      nodeCodes: [...new Set(nodeCodes.map((r) => r.code))].sort(),
      taskIds: [...new Set(taskIds.map((r) => r.id))],
      issueIds: [...new Set(issueIds.map((r) => r.id))],
      resolvedIssueIds: [
        ...new Set(issueIds.filter((r) => r.type === 'resolves').map((r) => r.id)),
      ],
      testCaseIds: [...new Set(testCaseIds.map((r) => r.id))],
    };
  }

  async toDto(executor: DbExecutor, row: typeof changes.$inferSelect): Promise<ChangeDto> {
    const links = await this.loadLinks(executor, row.id, row.productId);
    const files = (row.gitFiles as unknown as string[]) ?? [];
    return {
      id: row.id,
      productId: row.productId,
      code: row.code,
      title: row.title,
      description: row.description,
      kind: row.kind,
      status: row.status,
      gitRepo: row.gitRepo,
      gitBranch: row.gitBranch,
      gitSha: row.gitSha,
      gitPrUrl: row.gitPrUrl,
      gitFiles: files,
      executedAt: row.executedAt,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      nodeCodes: links.nodeCodes,
      taskIds: links.taskIds,
      issueIds: links.issueIds,
      resolvedIssueIds: links.resolvedIssueIds,
      testCaseIds: links.testCaseIds,
    };
  }

  async listChanges(productId: string, filters: ListChangesQueryInput): Promise<ChangeDto[]> {
    const conditions = [eq(changes.productId, productId), isNull(changes.deletedAt)];
    if (filters.status) conditions.push(eq(changes.status, filters.status));
    if (filters.kind) conditions.push(eq(changes.kind, filters.kind));
    if (filters.nodeCode) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM relations r JOIN product_nodes n ON n.id = r.target_id
          WHERE r.product_id = ${productId} AND r.source_kind = 'change' AND r.target_kind = 'node'
            AND r.source_id = ${changes.id} AND n.code = ${filters.nodeCode}
        )`,
      );
    }
    if (filters.q) {
      const q = `%${filters.q.toLowerCase()}%`;
      conditions.push(
        sql`(lower(${changes.title}) LIKE ${q} OR lower(coalesce(${changes.code}, '')) LIKE ${q} OR lower(${changes.description}) LIKE ${q})`,
      );
    }
    const rows = await this.db
      .select()
      .from(changes)
      .where(and(...conditions))
      .orderBy(desc(changes.createdAt));
    return Promise.all(rows.map((row) => this.toDto(this.db, row)));
  }

  async getChange(productId: string, idOrCode: string): Promise<ChangeDto> {
    const row = await this.findActiveOrThrow(this.db, productId, idOrCode);
    return this.toDto(this.db, row);
  }

  async listForNode(productId: string, nodeCode: string): Promise<ChangeDto[]> {
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
          eq(relations.sourceKind, 'change'),
          eq(relations.targetKind, 'node'),
          eq(relations.targetId, node.id),
        ),
      );
    if (linkedIds.length === 0) return [];
    const ids = linkedIds.map((r) => r.id);
    const rows = await this.db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.productId, productId),
          isNull(changes.deletedAt),
          sql`${changes.id} IN (${sql.join(
            ids.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        ),
      )
      .orderBy(desc(changes.createdAt));
    return Promise.all(rows.map((row) => this.toDto(this.db, row)));
  }

  private async linkNodeInternal(
    tx: DbExecutor,
    changeId: string,
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
        sourceKind: 'change',
        sourceId: changeId,
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
        action: 'change.node_linked',
        entityKind: 'change',
        entityId: changeId,
        summary: `Modificación vinculada al nodo ${nodeCode}`,
        metadata: { nodeId: node.id, nodeCode },
        ip: ip ?? null,
      },
      tx,
    );
  }

  private async linkTaskInternal(
    tx: DbExecutor,
    changeId: string,
    productId: string,
    taskId: string,
    actorId: string,
    ip?: string,
  ) {
    const [target] = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.productId, productId), isNull(tasks.deletedAt)))
      .limit(1);
    if (!target)
      throw new ProblemException(Problems.unprocessable('La tarea no existe en este producto'));
    await tx
      .insert(relations)
      .values({
        productId,
        sourceKind: 'change',
        sourceId: changeId,
        targetKind: 'task',
        targetId: taskId,
        relationType: 'implements',
        metadata: {},
        createdBy: actorId,
      })
      .onConflictDoNothing();
    await this.activity.emit(
      {
        productId,
        actorUserId: actorId,
        action: 'change.task_linked',
        entityKind: 'change',
        entityId: changeId,
        summary: 'Modificación vinculada a tarea',
        metadata: { taskId },
        ip: ip ?? null,
      },
      tx,
    );
  }

  private async linkIssueInternal(
    tx: DbExecutor,
    changeId: string,
    productId: string,
    issueId: string,
    relationType: 'resolves' | 'relates_to',
    actorId: string,
    ip?: string,
  ) {
    const [target] = await tx
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.productId, productId), isNull(issues.deletedAt)))
      .limit(1);
    if (!target)
      throw new ProblemException(
        Problems.unprocessable('La incidencia no existe en este producto'),
      );
    try {
      const [created] = await tx
        .insert(relations)
        .values({
          productId,
          sourceKind: 'change',
          sourceId: changeId,
          targetKind: 'issue',
          targetId: issueId,
          relationType,
          metadata: {},
          createdBy: actorId,
        })
        .returning();
      await this.activity.emit(
        {
          productId,
          actorUserId: actorId,
          action: 'change.issue_linked',
          entityKind: 'change',
          entityId: changeId,
          summary: `Modificación vinculada a incidencia (${relationType})`,
          metadata: { issueId, relationType },
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
  }

  async createChange(
    product: ResolvedProduct,
    input: CreateChangeInput,
    actorId: string,
    ip?: string,
  ): Promise<ChangeDto> {
    try {
      return await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(changes)
          .values({
            productId: product.id,
            code: input.code ?? null,
            title: input.title,
            description: input.description,
            kind: input.kind,
            status: 'proposed',
            gitRepo: input.gitRepo ?? null,
            gitBranch: input.gitBranch ?? null,
            gitSha: input.gitSha ?? null,
            gitPrUrl: input.gitPrUrl ?? null,
            gitFiles: input.gitFiles ?? [],
            createdBy: actorId,
          })
          .returning();
        if (!created) throw new Error('Insert de modificación no devolvió fila');
        for (const nodeCode of input.nodeCodes ?? []) {
          await this.linkNodeInternal(tx, created.id, product.id, nodeCode, actorId, ip);
        }
        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'change.created',
            entityKind: 'change',
            entityId: created.id,
            summary: `Modificación propuesta: ${created.code ? `${created.code} · ` : ''}${created.title}`,
            metadata: { kind: input.kind, nodeCodes: input.nodeCodes ?? [] },
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
            `Ya existe una modificación con código '${input.code}' en este producto`,
            'change.code_conflict',
          ),
        );
      }
      throw error;
    }
  }

  async updateChange(
    product: ResolvedProduct,
    idOrCode: string,
    input: UpdateChangeInput,
    actorId: string,
    ip?: string,
  ): Promise<ChangeDto> {
    return this.db.transaction(async (tx) => {
      const current = await this.findActiveOrThrow(tx, product.id, idOrCode);
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.title !== undefined) updates['title'] = input.title;
      if (input.description !== undefined) updates['description'] = input.description;
      if (input.kind !== undefined) updates['kind'] = input.kind;
      if (input.gitRepo !== undefined) updates['gitRepo'] = input.gitRepo;
      if (input.gitBranch !== undefined) updates['gitBranch'] = input.gitBranch;
      if (input.gitSha !== undefined) updates['gitSha'] = input.gitSha;
      if (input.gitPrUrl !== undefined) updates['gitPrUrl'] = input.gitPrUrl;
      if (input.gitFiles !== undefined) updates['gitFiles'] = input.gitFiles;
      const [updated] = await tx
        .update(changes)
        .set(updates)
        .where(eq(changes.id, current.id))
        .returning();
      await this.activity.emit(
        {
          productId: product.id,
          actorUserId: actorId,
          action: 'change.updated',
          entityKind: 'change',
          entityId: current.id,
          summary: `Modificación editada: ${(updated?.title ?? current.title).slice(0, 80)}`,
          metadata: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
          ip: ip ?? null,
        },
        tx,
      );
      return this.toDto(tx, updated!);
    });
  }

  async deleteChange(product: ResolvedProduct, idOrCode: string, actorId: string, ip?: string) {
    const current = await this.findActiveOrThrow(this.db, product.id, idOrCode);
    const [deleted] = await this.db
      .update(changes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(changes.id, current.id))
      .returning({ id: changes.id });
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'change.deleted',
      entityKind: 'change',
      entityId: current.id,
      summary: `Modificación desactivada: ${current.title}`,
      metadata: {},
      ip: ip ?? null,
    });
    return { deleted: Boolean(deleted) };
  }

  /** Ejecuta: proposed → executed + cierra atómicamente las INC con `resolves`. */
  async executeChange(
    product: ResolvedProduct,
    idOrCode: string,
    input: ExecuteChangeInput,
    actorId: string,
    ip?: string,
  ): Promise<ChangeDto & { resolvedIncidents: string[] }> {
    return this.db.transaction(async (tx) => {
      const current = await this.findActiveOrThrow(tx, product.id, idOrCode);
      if (current.status === 'executed') {
        throw new ProblemException(
          Problems.conflict('La modificación ya fue ejecutada', 'change.already_executed'),
        );
      }
      const updates: Record<string, unknown> = {
        status: 'executed',
        executedAt: new Date(),
        updatedAt: new Date(),
      };
      if (input.gitRepo !== undefined) updates['gitRepo'] = input.gitRepo;
      if (input.gitBranch !== undefined) updates['gitBranch'] = input.gitBranch;
      if (input.gitSha !== undefined) updates['gitSha'] = input.gitSha;
      if (input.gitPrUrl !== undefined) updates['gitPrUrl'] = input.gitPrUrl;
      if (input.gitFiles !== undefined) updates['gitFiles'] = input.gitFiles;
      const [updated] = await tx
        .update(changes)
        .set(updates)
        .where(eq(changes.id, current.id))
        .returning();

      // Incidencias vinculadas con `resolves`: cierre atómico en la misma tx.
      const resolvedRows = await tx
        .select({ targetId: relations.targetId })
        .from(relations)
        .where(
          and(
            eq(relations.productId, product.id),
            eq(relations.sourceKind, 'change'),
            eq(relations.sourceId, current.id),
            eq(relations.targetKind, 'issue'),
            eq(relations.relationType, 'resolves'),
          ),
        );

      const resolvedIncidents: string[] = [];
      for (const { targetId } of resolvedRows) {
        const closed = await this.closeIssueTx(
          tx,
          product.id,
          targetId,
          actorId,
          current.id,
          current.code,
          ip,
        );
        if (closed) resolvedIncidents.push(targetId);
      }

      await this.activity.emit(
        {
          productId: product.id,
          actorUserId: actorId,
          action: 'change.executed',
          entityKind: 'change',
          entityId: current.id,
          summary: `Modificación ejecutada: ${current.code ? `${current.code} · ` : ''}${current.title}`,
          metadata: {
            gitSha: updates['gitSha'] ?? current.gitSha ?? null,
            resolvedIncidents,
          },
          ip: ip ?? null,
        },
        tx,
      );

      const dto = await this.toDto(tx, updated!);
      return { ...dto, resolvedIncidents };
    });
  }

  /** Cierre de incidencia dentro de la tx de ejecución (open → in_progress → resolved). */
  private async closeIssueTx(
    tx: DbExecutor,
    productId: string,
    issueId: string,
    actorId: string,
    changeId: string,
    changeCode: string | null,
    ip?: string,
  ): Promise<boolean> {
    const [issue] = await tx
      .select()
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.productId, productId), isNull(issues.deletedAt)))
      .limit(1);
    if (!issue) return false;
    const [fromState] = await tx
      .select()
      .from(workflowStates)
      .where(eq(workflowStates.id, issue.stateId))
      .limit(1);
    const fromKey = fromState?.key ?? '';
    if (fromKey === 'resolved' || fromKey === 'closed') return false;
    const [resolvedState] = await tx
      .select()
      .from(workflowStates)
      .where(
        and(
          eq(workflowStates.productId, productId),
          eq(workflowStates.scope, 'issue'),
          eq(workflowStates.key, 'resolved'),
        ),
      )
      .limit(1);
    if (!resolvedState) {
      throw new ProblemException(Problems.internal('Producto sin estado issue/resolved (seed)'));
    }
    await tx
      .update(issues)
      .set({
        stateId: resolvedState.id,
        updatedAt: new Date(),
        resolvedAt: new Date(),
      })
      .where(eq(issues.id, issueId));
    await this.activity.emit(
      {
        productId,
        actorUserId: actorId,
        action: 'issue.resolved_by_change',
        entityKind: 'issue',
        entityId: issueId,
        summary: `Incidencia resuelta por modificación ${changeCode ?? changeId.slice(0, 8)}: ${issue.title.slice(0, 80)}`,
        metadata: { changeId, from: fromKey, to: 'resolved' },
        ip: ip ?? null,
      },
      tx,
    );
    return true;
  }

  // -- Vínculos change↔{node,task,issue,item,test_case} genéricos (F4-T03) ---

  async linkNode(
    product: ResolvedProduct,
    idOrCode: string,
    nodeCode: string,
    actorId: string,
    ip?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const change = await this.findActiveOrThrow(tx, product.id, idOrCode);
      await this.linkNodeInternal(tx, change.id, product.id, nodeCode, actorId, ip);
      return { changeId: change.id, nodeCode };
    });
  }

  async linkTask(
    product: ResolvedProduct,
    idOrCode: string,
    taskId: string,
    actorId: string,
    ip?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const change = await this.findActiveOrThrow(tx, product.id, idOrCode);
      await this.linkTaskInternal(tx, change.id, product.id, taskId, actorId, ip);
      return { changeId: change.id, taskId };
    });
  }

  async linkResolve(
    product: ResolvedProduct,
    idOrCode: string,
    issueId: string,
    actorId: string,
    ip?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const change = await this.findActiveOrThrow(tx, product.id, idOrCode);
      const created = await this.linkIssueInternal(
        tx,
        change.id,
        product.id,
        issueId,
        'resolves',
        actorId,
        ip,
      );
      return created;
    });
  }

  async linkIssueRelate(
    product: ResolvedProduct,
    idOrCode: string,
    issueId: string,
    actorId: string,
    ip?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const change = await this.findActiveOrThrow(tx, product.id, idOrCode);
      return this.linkIssueInternal(tx, change.id, product.id, issueId, 'relates_to', actorId, ip);
    });
  }

  /** Relación genérica change→{node,item,task,issue,change,test_case} por id o por código. */
  async createRelation(
    product: ResolvedProduct,
    idOrCode: string,
    input: CreateChangeRelationInput,
    actorId: string,
    ip?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const change = await this.findActiveOrThrow(tx, product.id, idOrCode);
      let targetId: string;
      let targetKind: string = input.targetKind ?? 'node';

      if (input.targetCode && !input.targetId) {
        const code = input.targetCode;
        if (/^PANT-|^MOD-|^COMP-|^PROC-|^SVC-|^PES-|^CU-|^RN-|^DOC-|^TAR-|^INC-|^TC-/.test(code)) {
          // Intentar resolución por código según prefijo.
          if (code.startsWith('TAR-')) {
            targetKind = 'task';
            const [row] = await tx
              .select({ id: tasks.id })
              .from(tasks)
              .where(
                and(eq(tasks.code, code), eq(tasks.productId, product.id), isNull(tasks.deletedAt)),
              )
              .limit(1);
            targetId = row?.id ?? '';
          } else if (code.startsWith('INC-')) {
            targetKind = 'issue';
            const [row] = await tx
              .select({ id: issues.id })
              .from(issues)
              .where(
                and(
                  eq(issues.code, code),
                  eq(issues.productId, product.id),
                  isNull(issues.deletedAt),
                ),
              )
              .limit(1);
            targetId = row?.id ?? '';
          } else if (code.startsWith('MOD-')) {
            targetKind = 'change';
            const [row] = await tx
              .select({ id: changes.id })
              .from(changes)
              .where(
                and(
                  eq(changes.code, code),
                  eq(changes.productId, product.id),
                  isNull(changes.deletedAt),
                ),
              )
              .limit(1);
            targetId = row?.id ?? '';
          } else if (code.startsWith('TC-')) {
            targetKind = 'test_case';
            const [row] = await tx
              .select({ id: testCases.id })
              .from(testCases)
              .where(
                and(
                  eq(testCases.code, code),
                  eq(testCases.productId, product.id),
                  isNull(testCases.deletedAt),
                ),
              )
              .limit(1);
            targetId = row?.id ?? '';
          } else if (code.startsWith('DOC-') || code.startsWith('CU-') || code.startsWith('RN-')) {
            targetKind = 'item';
            const [row] = await tx
              .select({ id: contentItems.id })
              .from(contentItems)
              .where(
                and(
                  eq(contentItems.code, code),
                  eq(contentItems.productId, product.id),
                  isNull(contentItems.deletedAt),
                ),
              )
              .limit(1);
            targetId = row?.id ?? '';
          } else {
            targetKind = 'node';
            const [row] = await tx
              .select({ id: productNodes.id })
              .from(productNodes)
              .where(
                and(
                  eq(productNodes.code, code),
                  eq(productNodes.productId, product.id),
                  isNull(productNodes.deletedAt),
                ),
              )
              .limit(1);
            targetId = row?.id ?? '';
          }
          if (!targetId)
            throw new ProblemException(Problems.unprocessable(`Destino '${code}' no existe`));
        } else {
          // Nodo por código (cualquier prefijo) o item por código.
          const [node] = await tx
            .select({ id: productNodes.id })
            .from(productNodes)
            .where(
              and(
                eq(productNodes.productId, product.id),
                eq(productNodes.code, code),
                isNull(productNodes.deletedAt),
              ),
            )
            .limit(1);
          if (node) {
            targetId = node.id;
            targetKind = 'node';
          } else {
            const [item] = await tx
              .select({ id: contentItems.id })
              .from(contentItems)
              .where(
                and(
                  eq(contentItems.productId, product.id),
                  eq(contentItems.code, code),
                  isNull(contentItems.deletedAt),
                ),
              )
              .limit(1);
            if (!item)
              throw new ProblemException(Problems.unprocessable(`Destino '${code}' no existe`));
            targetId = item.id;
            targetKind = 'item';
          }
        }
      } else if (input.targetId) {
        targetId = input.targetId;
        targetKind = input.targetKind ?? 'node';
      } else {
        throw new ProblemException(Problems.unprocessable('Falta targetId o targetCode'));
      }

      if (change.id === targetId && targetKind === 'change') {
        throw new ProblemException(
          Problems.unprocessable('Una modificación no puede relacionarse consigo misma'),
        );
      }
      try {
        const [created] = await tx
          .insert(relations)
          .values({
            productId: product.id,
            sourceKind: 'change',
            sourceId: change.id,
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
            entityKind: 'change',
            entityId: change.id,
            summary: `Relación ${input.relationType} creada desde la modificación`,
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
    const change = await this.findActiveOrThrow(this.db, productId, idOrCode);
    const base = eq(relations.productId, productId);
    if (direction === 'out') {
      return this.db
        .select()
        .from(relations)
        .where(and(base, eq(relations.sourceKind, 'change'), eq(relations.sourceId, change.id)))
        .orderBy(desc(relations.createdAt));
    }
    if (direction === 'in') {
      return this.db
        .select()
        .from(relations)
        .where(and(base, eq(relations.targetKind, 'change'), eq(relations.targetId, change.id)))
        .orderBy(desc(relations.createdAt));
    }
    return this.db
      .select()
      .from(relations)
      .where(
        and(
          base,
          sql`((source_kind = 'change' AND source_id = ${change.id}) OR (target_kind = 'change' AND target_id = ${change.id}))`,
        ),
      )
      .orderBy(desc(relations.createdAt));
  }
}
