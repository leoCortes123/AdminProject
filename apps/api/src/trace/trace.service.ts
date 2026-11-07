import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  activityLog,
  changes,
  contentItems,
  issues,
  itemNodeLinks,
  itemVersions,
  productNodes,
  relations,
  tasks,
  testCases,
  testResults,
  workflowStates,
} from '@devcycle/db';
import { Problems, type CreateGenericRelationInput } from '@devcycle/shared';
import { ProblemException } from '../common/problem.exception';
import { DB, type Database } from '../database';
import { ActivityService, type DbExecutor } from '../common/activity.service';
import type { ResolvedProduct } from '../common/authenticated-request';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TraceRow {
  kind: string;
  id: string;
  code: string | null;
  title: string;
  subtitle: string;
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
  createdAt: Date;
}

export interface HistoryEntry {
  at: Date;
  actorType: string;
  action: string;
  summary: string;
  source: 'activity' | 'version';
  entityKind: string | null;
  entityId: string | null;
}

@Injectable()
export class TraceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly activity: ActivityService,
  ) {}

  // -- Resolución helpers ----------------------------------------------------

  private async resolveNode(productId: string, idOrCode: string) {
    const byId = UUID_RE.test(idOrCode);
    const [row] = await this.db
      .select()
      .from(productNodes)
      .where(
        and(
          eq(productNodes.productId, productId),
          byId ? eq(productNodes.id, idOrCode) : eq(productNodes.code, idOrCode),
          isNull(productNodes.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new ProblemException(Problems.notFound('Nodo', idOrCode));
    return row;
  }

  private async resolveItem(productId: string, idOrCode: string) {
    const byId = UUID_RE.test(idOrCode);
    const [row] = await this.db
      .select()
      .from(contentItems)
      .where(
        and(
          eq(contentItems.productId, productId),
          byId ? eq(contentItems.id, idOrCode) : eq(contentItems.code, idOrCode),
          isNull(contentItems.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new ProblemException(Problems.notFound('Documento', idOrCode));
    return row;
  }

  // -- Relaciones genéricas (F4-T05) -----------------------------------------

  async enrichRow(executor: DbExecutor, row: typeof relations.$inferSelect): Promise<RelationDto> {
    const [source, target] = await Promise.all([
      this.display(executor, row.sourceKind, row.sourceId),
      this.display(executor, row.targetKind, row.targetId),
    ]);
    return {
      id: row.id,
      productId: row.productId,
      sourceKind: row.sourceKind,
      sourceId: row.sourceId,
      sourceCode: source?.code ?? null,
      sourceTitle: source?.title ?? null,
      targetKind: row.targetKind,
      targetId: row.targetId,
      targetCode: target?.code ?? null,
      targetTitle: target?.title ?? null,
      relationType: row.relationType,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
  }

  private async display(
    executor: DbExecutor,
    kind: string,
    id: string,
  ): Promise<{ code: string | null; title: string | null } | null> {
    if (kind === 'node') {
      const [r] = await executor
        .select({ code: productNodes.code, title: productNodes.name })
        .from(productNodes)
        .where(eq(productNodes.id, id))
        .limit(1);
      return r ?? null;
    }
    if (kind === 'item') {
      const [r] = await executor
        .select({ code: contentItems.code, title: contentItems.title })
        .from(contentItems)
        .where(eq(contentItems.id, id))
        .limit(1);
      return r ?? null;
    }
    if (kind === 'task') {
      const [r] = await executor
        .select({ code: tasks.code, title: tasks.title })
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      return r ?? null;
    }
    if (kind === 'issue') {
      const [r] = await executor
        .select({ code: issues.code, title: issues.title })
        .from(issues)
        .where(eq(issues.id, id))
        .limit(1);
      return r ?? null;
    }
    if (kind === 'change') {
      const [r] = await executor
        .select({ code: changes.code, title: changes.title })
        .from(changes)
        .where(eq(changes.id, id))
        .limit(1);
      return r ?? null;
    }
    if (kind === 'test_case') {
      const [r] = await executor
        .select({ code: testCases.code, title: testCases.title })
        .from(testCases)
        .where(eq(testCases.id, id))
        .limit(1);
      return r ?? null;
    }
    return null;
  }

  async listRelations(
    productId: string,
    filter: {
      entityKind?: string;
      entityId?: string;
      direction?: 'out' | 'in' | 'both';
      sourceKind?: string;
      targetKind?: string;
      relationType?: string;
    },
  ): Promise<RelationDto[]> {
    const conditions = [eq(relations.productId, productId)];
    if (filter.sourceKind) conditions.push(eq(relations.sourceKind, filter.sourceKind));
    if (filter.targetKind) conditions.push(eq(relations.targetKind, filter.targetKind));
    if (filter.relationType) conditions.push(eq(relations.relationType, filter.relationType));
    if (filter.entityKind && filter.entityId) {
      const direction = filter.direction ?? 'both';
      if (direction === 'out') {
        conditions.push(eq(relations.sourceKind, filter.entityKind));
        conditions.push(eq(relations.sourceId, filter.entityId));
      } else if (direction === 'in') {
        conditions.push(eq(relations.targetKind, filter.entityKind));
        conditions.push(eq(relations.targetId, filter.entityId));
      } else {
        conditions.push(
          sql`((source_kind = ${filter.entityKind} AND source_id = ${filter.entityId}::uuid) OR (target_kind = ${filter.entityKind} AND target_id = ${filter.entityId}::uuid))`,
        );
      }
    }
    const rows = await this.db
      .select()
      .from(relations)
      .where(and(...conditions))
      .orderBy(desc(relations.createdAt));
    return Promise.all(rows.map((r) => this.enrichRow(this.db, r)));
  }

  async createGenericRelation(
    product: ResolvedProduct,
    input: CreateGenericRelationInput,
    actorId: string,
    ip?: string,
  ): Promise<RelationDto> {
    let created;
    try {
      created = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(relations)
          .values({
            productId: product.id,
            sourceKind: input.sourceKind,
            sourceId: input.sourceId,
            targetKind: input.targetKind,
            targetId: input.targetId,
            relationType: input.relationType,
            metadata: input.metadata ?? {},
            createdBy: actorId,
          })
          .returning();
        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'relation.added',
            entityKind: input.sourceKind,
            entityId: input.sourceId,
            summary: `Relación ${input.relationType} creada (${input.sourceKind} → ${input.targetKind})`,
            metadata: {
              targetId: input.targetId,
              targetKind: input.targetKind,
              relationType: input.relationType,
            },
            ip: ip ?? null,
          },
          tx,
        );
        return row!;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProblemException(
          Problems.conflict('Esa relación ya existe', 'relation.duplicate'),
        );
      }
      const msg = (error as Error).message ?? '';
      if (msg.includes('relations:')) {
        throw new ProblemException(Problems.unprocessable(msg.split('relations: ')[1] ?? msg));
      }
      throw error;
    }
    return this.enrichRow(this.db, created);
  }

  async deleteRelation(product: ResolvedProduct, relationId: string, actorId: string, ip?: string) {
    const deleted = await this.db
      .delete(relations)
      .where(and(eq(relations.id, relationId), eq(relations.productId, product.id)))
      .returning({ id: relations.id });
    if (deleted.length === 0) throw new ProblemException(Problems.notFound('Relación', relationId));
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'relation.removed',
      entityKind: null,
      entityId: null,
      summary: `Relación eliminada: ${relationId}`,
      metadata: { relationId },
      ip: ip ?? null,
    });
    return { deleted: true };
  }

  async nodeRelations(productId: string, nodeCode: string, direction: 'out' | 'in' | 'both') {
    const node = await this.resolveNode(productId, nodeCode);
    return this.listRelations(productId, {
      entityKind: 'node',
      entityId: node.id,
      direction,
    });
  }

  // -- Las 7 consultas canónicas (F4-T05) ------------------------------------
  //
  // Todas devuelven filas genéricas { kind, id, code, title, subtitle } para
  // pintar tabla homogénea en la UI; `subtitle` lleva estado/detalle humano.

  /** Q1 · ¿Qué tareas afectan esta pantalla? (task → node: affects/implements/modifies) */
  async tasksAffectingNode(productId: string, nodeRef: string): Promise<TraceRow[]> {
    const node = await this.resolveNode(productId, nodeRef);
    const out = await this.db
      .select({ task: tasks })
      .from(relations)
      .innerJoin(tasks, eq(tasks.id, relations.sourceId))
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'task'),
          eq(relations.targetKind, 'node'),
          eq(relations.targetId, node.id),
          inArray(relations.relationType, ['affects', 'implements', 'modifies']),
          isNull(tasks.deletedAt),
        ),
      );
    const inbound = await this.db
      .select({ task: tasks })
      .from(relations)
      .innerJoin(tasks, eq(tasks.id, relations.targetId))
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'node'),
          eq(relations.sourceId, node.id),
          eq(relations.targetKind, 'task'),
          isNull(tasks.deletedAt),
        ),
      );
    const byId = new Map<string, typeof tasks.$inferSelect>();
    for (const { task } of [...out, ...inbound]) byId.set(task.id, task);
    return Promise.all(
      [...byId.values()].map(async (t) => {
        const [state] = await this.db
          .select({ label: workflowStates.label })
          .from(workflowStates)
          .where(eq(workflowStates.id, t.stateId))
          .limit(1);
        return {
          kind: 'task',
          id: t.id,
          code: t.code,
          title: t.title,
          subtitle: `${state?.label ?? ''} · ${t.priority}`,
        };
      }),
    );
  }

  /** Q2 · ¿Qué pantallas utilizan esta regla? (item regla → nodes vía relations + item_node_links) */
  async screensUsingRule(productId: string, itemRef: string): Promise<TraceRow[]> {
    const item = await this.resolveItem(productId, itemRef);
    const viaRelations = await this.db
      .select({ node: productNodes })
      .from(relations)
      .innerJoin(productNodes, eq(productNodes.id, relations.targetId))
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'item'),
          eq(relations.sourceId, item.id),
          eq(relations.targetKind, 'node'),
          isNull(productNodes.deletedAt),
        ),
      );
    const viaLinks = await this.db
      .select({ node: productNodes })
      .from(itemNodeLinks)
      .innerJoin(productNodes, eq(productNodes.id, itemNodeLinks.nodeId))
      .where(and(eq(itemNodeLinks.itemId, item.id), isNull(productNodes.deletedAt)));
    const byId = new Map<string, typeof productNodes.$inferSelect>();
    for (const { node } of [...viaRelations, ...viaLinks]) byId.set(node.id, node);
    return [...byId.values()].map((n) => ({
      kind: 'node',
      id: n.id,
      code: n.code,
      title: n.name,
      subtitle: n.path,
    }));
  }

  /** Q3 · ¿Qué documentos describen este proceso? (node → items) */
  async documentsForNode(productId: string, nodeRef: string): Promise<TraceRow[]> {
    const node = await this.resolveNode(productId, nodeRef);
    const viaLinks = await this.db
      .select({ item: contentItems })
      .from(itemNodeLinks)
      .innerJoin(contentItems, eq(contentItems.id, itemNodeLinks.itemId))
      .where(and(eq(itemNodeLinks.nodeId, node.id), isNull(contentItems.deletedAt)));
    const viaRelationsOut = await this.db
      .select({ item: contentItems })
      .from(relations)
      .innerJoin(contentItems, eq(contentItems.id, relations.targetId))
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'node'),
          eq(relations.sourceId, node.id),
          eq(relations.targetKind, 'item'),
          isNull(contentItems.deletedAt),
        ),
      );
    const viaRelationsIn = await this.db
      .select({ item: contentItems })
      .from(relations)
      .innerJoin(contentItems, eq(contentItems.id, relations.sourceId))
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'item'),
          eq(relations.targetKind, 'node'),
          eq(relations.targetId, node.id),
          inArray(relations.relationType, ['documents', 'specifies', 'applies_rule']),
          isNull(contentItems.deletedAt),
        ),
      );
    const byId = new Map<string, typeof contentItems.$inferSelect>();
    for (const { item } of [...viaLinks, ...viaRelationsOut, ...viaRelationsIn])
      byId.set(item.id, item);
    return [...byId.values()].map((d) => ({
      kind: 'item',
      id: d.id,
      code: d.code,
      title: d.title,
      subtitle: `v${d.version} · ${d.status}`,
    }));
  }

  /** Q4 · ¿Qué modificaciones implementaron esta funcionalidad? (change → node) */
  async changesForNode(productId: string, nodeRef: string): Promise<TraceRow[]> {
    const node = await this.resolveNode(productId, nodeRef);
    const out = await this.db
      .select({ ch: changes })
      .from(relations)
      .innerJoin(changes, eq(changes.id, relations.sourceId))
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'change'),
          eq(relations.targetKind, 'node'),
          eq(relations.targetId, node.id),
          isNull(changes.deletedAt),
        ),
      )
      .orderBy(desc(changes.createdAt));
    const inbound = await this.db
      .select({ ch: changes })
      .from(relations)
      .innerJoin(changes, eq(changes.id, relations.targetId))
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'node'),
          eq(relations.sourceId, node.id),
          eq(relations.targetKind, 'change'),
          isNull(changes.deletedAt),
        ),
      )
      .orderBy(desc(changes.createdAt));
    const byId = new Map<string, typeof changes.$inferSelect>();
    for (const { ch } of [...out, ...inbound]) byId.set(ch.id, ch);
    return [...byId.values()].map((c) => ({
      kind: 'change',
      id: c.id,
      code: c.code,
      title: c.title,
      subtitle: `${c.status} · ${c.kind}${c.gitSha ? ` · ${c.gitSha}` : ''}`,
    }));
  }

  /** Q5 · ¿Qué pruebas validan este caso de uso? (test_case → item: verifies) */
  async testsForDocument(productId: string, itemRef: string): Promise<TraceRow[]> {
    const item = await this.resolveItem(productId, itemRef);
    const rows = await this.db
      .select({ tc: testCases })
      .from(relations)
      .innerJoin(testCases, eq(testCases.id, relations.sourceId))
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'test_case'),
          eq(relations.targetKind, 'item'),
          eq(relations.targetId, item.id),
          isNull(testCases.deletedAt),
        ),
      );
    return Promise.all(
      rows.map(async ({ tc }) => {
        const [last] = await this.db
          .select()
          .from(testResults)
          .where(eq(testResults.testCaseId, tc.id))
          .orderBy(desc(testResults.executedAt))
          .limit(1);
        return {
          kind: 'test_case',
          id: tc.id,
          code: tc.code,
          title: tc.title,
          subtitle: last
            ? `${last.status} · ${last.executedAt.toISOString().slice(0, 10)}`
            : 'sin ejecución',
        };
      }),
    );
  }

  /** Q6 · ¿Qué incidencias afectan este módulo? (issue → node en el subárbol ltree) */
  async issuesForModule(productId: string, nodeRef: string): Promise<TraceRow[]> {
    const node = await this.resolveNode(productId, nodeRef);
    const subtree = await this.db
      .select({ id: productNodes.id })
      .from(productNodes)
      .where(
        and(
          eq(productNodes.productId, productId),
          sql`${productNodes.path} <@ ${node.path}::ltree`,
          isNull(productNodes.deletedAt),
        ),
      );
    if (subtree.length === 0) return [];
    const ids = subtree.map((r) => r.id);
    const rows = await this.db
      .select({ issue: issues })
      .from(relations)
      .innerJoin(issues, eq(issues.id, relations.sourceId))
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'issue'),
          eq(relations.targetKind, 'node'),
          sql`${relations.targetId} IN (${sql.join(
            ids.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
          isNull(issues.deletedAt),
        ),
      );
    return Promise.all(
      rows.map(async ({ issue }) => {
        const [state] = await this.db
          .select({ label: workflowStates.label })
          .from(workflowStates)
          .where(eq(workflowStates.id, issue.stateId))
          .limit(1);
        return {
          kind: 'issue',
          id: issue.id,
          code: issue.code,
          title: issue.title,
          subtitle: `${state?.label ?? ''} · ${issue.severity}`,
        };
      }),
    );
  }

  /** Q7 · ¿Qué funcionalidades dependen de este componente? (node → node: depends_on, BFS ≤ 3) */
  async dependentsForNode(productId: string, nodeRef: string, depth = 1): Promise<TraceRow[]> {
    const node = await this.resolveNode(productId, nodeRef);
    const maxDepth = Math.min(Math.max(depth, 1), 3);
    const seen = new Set<string>([node.id]);
    const result = new Map<string, typeof productNodes.$inferSelect>();
    let frontier = [node.id];
    for (let level = 0; level < maxDepth && frontier.length > 0; level++) {
      const next: string[] = [];
      for (const currentId of frontier) {
        // Dependientes: nodos que apuntan a `current` con depends_on/depends.
        const deps = await this.db
          .select({ n: productNodes })
          .from(relations)
          .innerJoin(productNodes, eq(productNodes.id, relations.sourceId))
          .where(
            and(
              eq(relations.productId, productId),
              eq(relations.sourceKind, 'node'),
              eq(relations.targetKind, 'node'),
              eq(relations.targetId, currentId),
              inArray(relations.relationType, ['depends_on', 'depends']),
              isNull(productNodes.deletedAt),
            ),
          );
        for (const { n } of deps) {
          if (!seen.has(n.id)) {
            seen.add(n.id);
            result.set(n.id, n);
            next.push(n.id);
          }
        }
        // Dependencias: nodos a los que `current` apunta (también son "dependen de" en sentido amplio).
        if (level === 0) {
          const fwd = await this.db
            .select({ n: productNodes })
            .from(relations)
            .innerJoin(productNodes, eq(productNodes.id, relations.targetId))
            .where(
              and(
                eq(relations.productId, productId),
                eq(relations.sourceKind, 'node'),
                eq(relations.sourceId, currentId),
                eq(relations.targetKind, 'node'),
                inArray(relations.relationType, ['depends_on', 'depends']),
                isNull(productNodes.deletedAt),
              ),
            );
          for (const { n } of fwd) {
            if (!seen.has(n.id)) {
              seen.add(n.id);
              result.set(n.id, n);
              next.push(n.id);
            }
          }
        }
      }
      frontier = next;
    }
    return [...result.values()].map((n) => ({
      kind: 'node',
      id: n.id,
      code: n.code,
      title: n.name,
      subtitle: n.path,
    }));
  }

  // -- Grafo local (centro + vecinos, profundidad ≤ 3) ------------------------

  async graphForNode(productId: string, nodeRef: string, depth: number) {
    const node = await this.resolveNode(productId, nodeRef);
    const maxDepth = Math.min(Math.max(depth, 1), 3);
    const center = { kind: 'node', id: node.id, code: node.code, title: node.name };
    const nodesMap = new Map<
      string,
      { kind: string; id: string; code: string | null; title: string | null }
    >();
    const edges: Array<{ source: string; target: string; type: string }> = [];
    const seenEdges = new Set<string>();
    const key = (kind: string, id: string) => `${kind}:${id}`;
    nodesMap.set(key('node', node.id), center);
    // BFS transitivo hasta `depth` saltos (F5: cierra la deuda F4 de 1 salto).
    let frontier: Array<{ kind: string; id: string }> = [{ kind: 'node', id: node.id }];
    for (let level = 0; level < maxDepth && frontier.length > 0; level++) {
      const next: Array<{ kind: string; id: string }> = [];
      for (const current of frontier) {
        const rels = await this.db
          .select()
          .from(relations)
          .where(
            and(
              eq(relations.productId, productId),
              sql`((source_kind = ${current.kind} AND source_id = ${current.id}::uuid) OR (target_kind = ${current.kind} AND target_id = ${current.id}::uuid))`,
            ),
          )
          .orderBy(relations.createdAt);
        for (const r of rels) {
          const edgeKey = `${key(r.sourceKind, r.sourceId)}|${key(r.targetKind, r.targetId)}|${r.relationType}`;
          if (!seenEdges.has(edgeKey)) {
            seenEdges.add(edgeKey);
            edges.push({
              source: key(r.sourceKind, r.sourceId),
              target: key(r.targetKind, r.targetId),
              type: r.relationType,
            });
          }
          for (const candidate of [
            { kind: r.sourceKind, id: r.sourceId },
            { kind: r.targetKind, id: r.targetId },
          ]) {
            const k = key(candidate.kind, candidate.id);
            if (!nodesMap.has(k)) {
              const disp = await this.display(this.db, candidate.kind, candidate.id);
              nodesMap.set(k, {
                kind: candidate.kind,
                id: candidate.id,
                code: disp?.code ?? null,
                title: disp?.title ?? candidate.id.slice(0, 8),
              });
              next.push(candidate);
            }
          }
        }
      }
      frontier = next;
    }
    return {
      center,
      nodes: [...nodesMap.values()],
      edges,
    };
  }

  // -- Historia unificada por nodo (F4-T04) ----------------------------------

  /** Unión ordenada (desc) de activity_log + item_versions de lo vinculado al nodo. */
  async historyForNode(productId: string, nodeRef: string): Promise<HistoryEntry[]> {
    const node = await this.resolveNode(productId, nodeRef);
    // Entidades vinculadas al nodo (tareas/incidencias/cambios/docs con relations).
    const linked = await this.db
      .select({
        sourceKind: relations.sourceKind,
        sourceId: relations.sourceId,
        targetKind: relations.targetKind,
        targetId: relations.targetId,
      })
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          sql`((target_kind = 'node' AND target_id = ${node.id}::uuid) OR (source_kind = 'node' AND source_id = ${node.id}::uuid))`,
        ),
      );
    const entityIds = new Set<string>([node.id]);
    for (const r of linked) {
      if (r.sourceKind === 'node' || r.targetKind === 'node') {
        entityIds.add(r.sourceKind === 'node' ? r.sourceId : r.targetId);
        entityIds.add(r.targetKind === 'node' ? r.targetId : r.sourceId);
      }
    }
    // Docs vinculados vía item_node_links también entran en el historial.
    const docLinks = await this.db
      .select({ itemId: itemNodeLinks.itemId })
      .from(itemNodeLinks)
      .where(eq(itemNodeLinks.nodeId, node.id));
    for (const d of docLinks) entityIds.add(d.itemId);

    const ids = [...entityIds].filter((id): id is string => Boolean(id));
    const entries: HistoryEntry[] = [];

    if (ids.length > 0) {
      const acts = await this.db
        .select()
        .from(activityLog)
        .where(
          and(
            eq(activityLog.productId, productId),
            sql`${activityLog.entityId} IN (${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`,
          ),
        )
        .orderBy(desc(activityLog.createdAt))
        .limit(100);
      for (const a of acts) {
        entries.push({
          at: a.createdAt,
          actorType: a.actorType,
          action: a.action,
          summary: a.summary,
          source: 'activity',
          entityKind: a.entityKind,
          entityId: a.entityId,
        });
      }
      // Versiones de los documentos vinculados (timeline documental).
      if (docLinks.length > 0) {
        const docIds = docLinks.map((d) => d.itemId);
        const versions = await this.db
          .select({
            itemId: itemVersions.itemId,
            version: itemVersions.version,
            title: itemVersions.title,
            createdAt: itemVersions.createdAt,
          })
          .from(itemVersions)
          .where(
            sql`${itemVersions.itemId} IN (${sql.join(
              docIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`,
          )
          .orderBy(desc(itemVersions.createdAt))
          .limit(20);
        for (const v of versions) {
          entries.push({
            at: v.createdAt,
            actorType: 'human',
            action: 'doc.version',
            summary: `v${v.version}: ${v.title}`,
            source: 'version',
            entityKind: 'item',
            entityId: v.itemId,
          });
        }
      }
    }

    entries.sort((a, b) => b.at.getTime() - a.at.getTime());
    return entries;
  }

  // -- Barrido de integridad (F4-T07) -----------------------------------------

  /** Endpoint admin: 0 huérfanos garantiza que los triggers cumplieron. */
  async sweep(productId: string) {
    const checks = await Promise.all([
      this.countOrphans(productId, 'node', 'product_nodes'),
      this.countOrphans(productId, 'item', 'content_items'),
      this.countOrphans(productId, 'task', 'tasks'),
      this.countOrphans(productId, 'issue', 'issues'),
      this.countOrphans(productId, 'change', 'changes'),
      this.countOrphans(productId, 'test_case', 'test_cases'),
    ]);
    const orphanCount = checks.reduce((acc, n) => acc + n, 0);
    const cycles = await this.countDependencyCycles(productId);
    return {
      checkedAt: new Date().toISOString(),
      orphans: orphanCount,
      orphanByKind: {
        node: checks[0] ?? 0,
        item: checks[1] ?? 0,
        task: checks[2] ?? 0,
        issue: checks[3] ?? 0,
        change: checks[4] ?? 0,
        test_case: checks[5] ?? 0,
      },
      cycles,
    };
  }

  private async countOrphans(productId: string, kind: string, _table: string): Promise<number> {
    // orphan = relation whose source OR target entity no longer exists.
    // Se implementa por kind con SQL estático (sin interpolación dinámica).
    const tableName =
      kind === 'node'
        ? 'product_nodes'
        : kind === 'item'
          ? 'content_items'
          : kind === 'task'
            ? 'tasks'
            : kind === 'issue'
              ? 'issues'
              : kind === 'change'
                ? 'changes'
                : 'test_cases';
    // sql.raw solo con identificadores internos fijos de la lista cerrada.
    const raw = await this.db.execute(sql`
      SELECT count(*)::int AS n
      FROM relations r
      WHERE r.product_id = ${productId}
        AND (
          (r.source_kind = ${kind} AND NOT EXISTS (
            SELECT 1 FROM ${sql.raw(tableName)} e
            WHERE e.id = r.source_id AND e.product_id = r.product_id
          ))
          OR
          (r.target_kind = ${kind} AND NOT EXISTS (
            SELECT 1 FROM ${sql.raw(tableName)} e
            WHERE e.id = r.target_id AND e.product_id = r.product_id
          ))
        )
    `);
    const list = (Array.isArray(raw) ? raw : []) as Array<{ n: number }>;
    return Number(list[0]?.n ?? 0);
  }

  /** Ciclos en el grafo de dependencias task→task (blocks). DFS acotado por producto. */
  private async countDependencyCycles(productId: string): Promise<number> {
    const edges = await this.db
      .select({ sourceId: relations.sourceId, targetId: relations.targetId })
      .from(relations)
      .where(
        and(
          eq(relations.productId, productId),
          eq(relations.sourceKind, 'task'),
          eq(relations.targetKind, 'task'),
          eq(relations.relationType, 'blocks'),
        ),
      );
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      const list = adj.get(e.sourceId) ?? [];
      list.push(e.targetId);
      adj.set(e.sourceId, list);
    }
    let cycles = 0;
    const visited = new Set<string>();
    const stack = new Set<string>();
    const dfs = (node: string): boolean => {
      if (stack.has(node)) {
        cycles += 1;
        return true;
      }
      if (visited.has(node)) return false;
      visited.add(node);
      stack.add(node);
      for (const next of adj.get(node) ?? []) dfs(next);
      stack.delete(node);
      return false;
    };
    for (const node of adj.keys()) {
      if (!visited.has(node)) dfs(node);
    }
    return cycles;
  }
}
