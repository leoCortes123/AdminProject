import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { ActivityQueryInput, ExportKind } from '@devcycle/shared';
import { DB, type Database } from '../database';

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

export interface OverviewOpenIssue {
  id: string;
  code: string | null;
  title: string;
  severity: string;
  priority: string;
  stateKey: string;
}

export interface OverviewBlockedTask {
  id: string;
  code: string | null;
  title: string;
  priority: string;
  stateKey: string;
}

export interface OverviewRecentChange {
  id: string;
  code: string | null;
  title: string;
  status: string;
  executedAt: Date | null;
  createdAt: Date;
}

export interface CoverageNode {
  id: string;
  code: string;
  name: string;
  nodeTypeKey: string;
  path: string;
}

export interface ActivityEntry {
  id: string;
  actorType: string;
  actorUserId: string | null;
  action: string;
  entityKind: string | null;
  entityId: string | null;
  summary: string;
  createdAt: Date;
}

export interface ActivityPage {
  items: ActivityEntry[];
  nextCursor: string | null;
}

/** Cursor opaco base64({createdAt ISO, id}) para orden estable desc. */
function encodeCursor(createdAt: Date | string, id: string): string {
  const normalized = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return Buffer.from(JSON.stringify({ createdAt: normalized.toISOString(), id }), 'utf8').toString(
    'base64url',
  );
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      createdAt: string;
      id: string;
    };
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime()) || typeof parsed.id !== 'string') return null;
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

function csvEscape(value: string): string {
  if (/[";\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function toCsv(header: string[], rows: string[][]): string {
  // BOM para Excel-ES + separador ; (Excel español usa , decimal).
  const lines = [header.join(';'), ...rows.map((row) => row.map(csvEscape).join(';'))];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/**
 * Seguimiento (Fase 5 · M-08): lecturas agregadas sin dashboards saturados.
 * - Avance = conteo simple de tareas completadas (R-09: documentado, sin
 *   ponderación subjetiva); por módulo = tareas vinculadas al subárbol ltree.
 *   Módulos sin tareas caen al % de nodos `done` del subárbol (paridad Resumen).
 * - Cobertura = ausencia de relations/links (item_node_links o relations).
 * - Activity = activity_log cursor-paginado (humano/agente) con filtros.
 * - Export = CSV con BOM y ; para Excel-ES.
 */
@Injectable()
export class FollowupService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async getOverview(productId: string) {
    // Conteos de tareas e incidencias (1 sola query con subselects).
    const countsRows = await this.db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM tasks t
         WHERE t.product_id = ${productId} AND t.deleted_at IS NULL) AS tasks_total,
        (SELECT count(*)::int FROM tasks t
         JOIN workflow_states ws ON ws.id = t.state_id
         WHERE t.product_id = ${productId} AND t.deleted_at IS NULL AND ws.is_terminal) AS tasks_done,
        (SELECT count(*)::int FROM issues i
         WHERE i.product_id = ${productId} AND i.deleted_at IS NULL) AS issues_total,
        (SELECT count(*)::int FROM issues i
         JOIN workflow_states ws ON ws.id = i.state_id
         WHERE i.product_id = ${productId} AND i.deleted_at IS NULL AND NOT ws.is_terminal) AS issues_open,
        (SELECT count(*)::int FROM changes c
         WHERE c.product_id = ${productId} AND c.deleted_at IS NULL AND c.status = 'proposed') AS changes_proposed,
        (SELECT count(*)::int FROM changes c
         WHERE c.product_id = ${productId} AND c.deleted_at IS NULL AND c.status = 'executed') AS changes_executed
    `);
    const counts = (
      countsRows as unknown as Array<{
        tasks_total: number;
        tasks_done: number;
        issues_total: number;
        issues_open: number;
        changes_proposed: number;
        changes_executed: number;
      }>
    )[0] ?? {
      tasks_total: 0,
      tasks_done: 0,
      issues_total: 0,
      issues_open: 0,
      changes_proposed: 0,
      changes_executed: 0,
    };

    const tasksTotal = Number(counts.tasks_total);
    const tasksDone = Number(counts.tasks_done);
    const issuesTotal = Number(counts.issues_total);
    const issuesOpen = Number(counts.issues_open);

    // Tareas bloqueadas (is_blocked_by, no terminales).
    const blockedRows = await this.db.execute(sql`
      SELECT t.id, t.code, t.title, t.priority, ws.key AS state_key
      FROM tasks t
      JOIN workflow_states ws ON ws.id = t.state_id
      WHERE t.product_id = ${productId}
        AND t.deleted_at IS NULL
        AND NOT ws.is_terminal
        AND EXISTS (
          SELECT 1 FROM relations r
          WHERE r.product_id = ${productId}
            AND r.source_kind = 'task' AND r.source_id = t.id
            AND r.target_kind = 'task' AND r.relation_type = 'is_blocked_by'
        )
      ORDER BY
        CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.updated_at DESC
      LIMIT 20
    `);
    const blockedTasks = (
      blockedRows as unknown as Array<{
        id: string;
        code: string | null;
        title: string;
        priority: string;
        state_key: string;
      }>
    ).map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      priority: row.priority,
      stateKey: row.state_key,
    }));

    // Incidencias abiertas por severidad (críticas primero).
    const openIssuesRows = await this.db.execute(sql`
      SELECT i.id, i.code, i.title, i.severity, i.priority, ws.key AS state_key
      FROM issues i
      JOIN workflow_states ws ON ws.id = i.state_id
      WHERE i.product_id = ${productId}
        AND i.deleted_at IS NULL
        AND NOT ws.is_terminal
      ORDER BY
        CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        i.updated_at DESC
      LIMIT 20
    `);
    const openIssues = (
      openIssuesRows as unknown as Array<{
        id: string;
        code: string | null;
        title: string;
        severity: string;
        priority: string;
        state_key: string;
      }>
    ).map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      severity: row.severity,
      priority: row.priority,
      stateKey: row.state_key,
    }));

    // Desglose de severidades de incidencias abiertas.
    const severityRows = await this.db.execute(sql`
      SELECT i.severity, count(*)::int AS n
      FROM issues i
      JOIN workflow_states ws ON ws.id = i.state_id
      WHERE i.product_id = ${productId}
        AND i.deleted_at IS NULL
        AND NOT ws.is_terminal
      GROUP BY i.severity
    `);
    const issuesBySeverity: Record<string, number> = {};
    for (const row of severityRows as unknown as Array<{ severity: string; n: number }>) {
      issuesBySeverity[row.severity] = Number(row.n);
    }

    // Modificaciones recientes (cualquier estado).
    const recentRows = await this.db.execute(sql`
      SELECT c.id, c.code, c.title, c.status, c.executed_at, c.created_at
      FROM changes c
      WHERE c.product_id = ${productId} AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT 10
    `);
    // `db.execute` devuelve timestamptz como string; normalizamos a Date para JSON ISO.
    const recentChanges = (
      recentRows as unknown as Array<{
        id: string;
        code: string | null;
        title: string;
        status: string;
        executed_at: string | Date | null;
        created_at: string | Date;
      }>
    ).map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      status: row.status,
      executedAt: row.executed_at ? new Date(row.executed_at) : null,
      createdAt: new Date(row.created_at),
    }));

    // Avance por módulo (tareas del subárbol; fallback a nodos si no hay tareas).
    const modules = await this.computeModuleProgress(productId);

    return {
      avancePct: tasksTotal === 0 ? 0 : Math.round((tasksDone / tasksTotal) * 100),
      counts: {
        tasksTotal,
        tasksDone,
        tasksOpen: tasksTotal - tasksDone,
        tasksBlocked: blockedTasks.length,
        issuesTotal,
        issuesOpen,
        issuesBySeverity,
        changesProposed: Number(counts.changes_proposed),
        changesExecuted: Number(counts.changes_executed),
      },
      modules,
      openIssues,
      blockedTasks,
      recentChanges,
    };
  }

  private async computeModuleProgress(productId: string): Promise<OverviewModule[]> {
    const modRows = await this.db.execute(sql`
      SELECT pn.id, pn.code, pn.name, pn.path
      FROM product_nodes pn
      JOIN node_types nt ON nt.id = pn.node_type_id
      WHERE pn.product_id = ${productId}
        AND pn.deleted_at IS NULL
        AND nt.key = 'modulo'
      ORDER BY pn.code
    `);
    const modules = modRows as unknown as Array<{
      id: string;
      code: string;
      name: string;
      path: string;
    }>;
    const out: OverviewModule[] = [];
    for (const mod of modules) {
      const stats = await this.db.execute(sql`
        SELECT
          (SELECT count(*)::int FROM product_nodes d
           WHERE d.product_id = ${productId} AND d.deleted_at IS NULL
             AND d.path <@ ${mod.path}::ltree AND d.id <> ${mod.id}) AS nodes_total,
          (SELECT count(*)::int FROM product_nodes d
           WHERE d.product_id = ${productId} AND d.deleted_at IS NULL
             AND d.path <@ ${mod.path}::ltree AND d.id <> ${mod.id}
             AND d.status = 'done') AS nodes_done,
          (SELECT count(DISTINCT t.id)::int FROM tasks t
           JOIN relations r ON r.source_kind = 'task' AND r.source_id = t.id AND r.target_kind = 'node'
           JOIN product_nodes d ON d.id = r.target_id
           WHERE t.product_id = ${productId} AND t.deleted_at IS NULL
             AND d.path <@ ${mod.path}::ltree) AS tasks_total,
          (SELECT count(DISTINCT t.id)::int FROM tasks t
           JOIN workflow_states ws ON ws.id = t.state_id
           JOIN relations r ON r.source_kind = 'task' AND r.source_id = t.id AND r.target_kind = 'node'
           JOIN product_nodes d ON d.id = r.target_id
           WHERE t.product_id = ${productId} AND t.deleted_at IS NULL
             AND d.path <@ ${mod.path}::ltree AND ws.is_terminal) AS tasks_done
      `);
      const row = (
        stats as unknown as Array<{
          nodes_total: number;
          nodes_done: number;
          tasks_total: number;
          tasks_done: number;
        }>
      )[0] ?? { nodes_total: 0, nodes_done: 0, tasks_total: 0, tasks_done: 0 };
      const nodesTotal = Number(row.nodes_total);
      const nodesDone = Number(row.nodes_done);
      const tasksTotal = Number(row.tasks_total);
      const tasksDone = Number(row.tasks_done);
      const pct =
        tasksTotal > 0
          ? Math.round((tasksDone / tasksTotal) * 100)
          : nodesTotal === 0
            ? 0
            : Math.round((nodesDone / nodesTotal) * 100);
      out.push({
        id: mod.id,
        code: mod.code,
        name: mod.name,
        nodesTotal,
        nodesDone,
        tasksTotal,
        tasksDone,
        pct,
      });
    }
    return out;
  }

  async getCoverage(productId: string) {
    const [withoutDocs, withoutTests, totals] = await Promise.all([
      this.listNodesWithoutDocs(productId),
      this.listNodesWithoutTests(productId),
      this.db.execute(sql`
        SELECT count(*)::int AS total FROM product_nodes
        WHERE product_id = ${productId} AND deleted_at IS NULL
      `),
    ]);
    const totalNodes = Number(
      ((totals as unknown as Array<{ total: number }>)[0]?.total ?? 0) as unknown as number,
    );
    const withoutDocsCount = withoutDocs.length;
    const withoutTestsCount = withoutTests.length;
    return {
      totalNodes,
      withDocs: totalNodes - withoutDocsCount,
      withoutDocs: withoutDocsCount,
      withTests: totalNodes - withoutTestsCount,
      withoutTests: withoutTestsCount,
      pctDocs:
        totalNodes === 0 ? 0 : Math.round(((totalNodes - withoutDocsCount) / totalNodes) * 100),
      pctTests:
        totalNodes === 0 ? 0 : Math.round(((totalNodes - withoutTestsCount) / totalNodes) * 100),
      withoutDocsList: withoutDocs,
      withoutTestsList: withoutTests,
    };
  }

  private async listNodesWithoutDocs(productId: string): Promise<CoverageNode[]> {
    const rows = await this.db.execute(sql`
      SELECT pn.id, pn.code, pn.name, nt.key AS node_type_key, pn.path::text AS path
      FROM product_nodes pn
      JOIN node_types nt ON nt.id = pn.node_type_id
      WHERE pn.product_id = ${productId}
        AND pn.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM item_node_links l WHERE l.node_id = pn.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM relations r
          WHERE r.product_id = ${productId}
            AND ((r.target_kind = 'node' AND r.target_id = pn.id AND r.source_kind = 'item')
              OR (r.source_kind = 'node' AND r.source_id = pn.id AND r.target_kind = 'item'))
        )
      ORDER BY pn.code
    `);
    return (
      rows as unknown as Array<{
        id: string;
        code: string;
        name: string;
        node_type_key: string;
        path: string;
      }>
    ).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      nodeTypeKey: row.node_type_key,
      path: row.path,
    }));
  }

  private async listNodesWithoutTests(productId: string): Promise<CoverageNode[]> {
    const rows = await this.db.execute(sql`
      SELECT pn.id, pn.code, pn.name, nt.key AS node_type_key, pn.path::text AS path
      FROM product_nodes pn
      JOIN node_types nt ON nt.id = pn.node_type_id
      WHERE pn.product_id = ${productId}
        AND pn.deleted_at IS NULL
        AND NOT EXISTS (
          -- test_case → node directo
          SELECT 1 FROM relations r
          WHERE r.product_id = ${productId}
            AND ((r.source_kind = 'test_case' AND r.target_kind = 'node' AND r.target_id = pn.id)
              OR (r.source_kind = 'node' AND r.source_id = pn.id AND r.target_kind = 'test_case'))
        )
        AND NOT EXISTS (
          -- test_case → item → node (verifies a un CU documentado en el nodo)
          SELECT 1
          FROM relations r1
          JOIN item_node_links l ON l.item_id = r1.target_id
          WHERE r1.product_id = ${productId}
            AND r1.source_kind = 'test_case' AND r1.target_kind = 'item'
            AND l.node_id = pn.id
        )
      ORDER BY pn.code
    `);
    return (
      rows as unknown as Array<{
        id: string;
        code: string;
        name: string;
        node_type_key: string;
        path: string;
      }>
    ).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      nodeTypeKey: row.node_type_key,
      path: row.path,
    }));
  }

  async getActivity(productId: string, input: ActivityQueryInput): Promise<ActivityPage> {
    const limit = Math.min(input.limit, 50);
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const conditions: ReturnType<typeof sql>[] = [sql`a.product_id = ${productId}`];
    if (input.actorType) conditions.push(sql`a.actor_type = ${input.actorType}`);
    if (input.entityKind) conditions.push(sql`a.entity_kind = ${input.entityKind}`);
    if (input.actionPrefix) {
      conditions.push(sql`a.action LIKE ${`${input.actionPrefix}%`}`);
    }
    if (cursor) {
      conditions.push(
        sql`(a.created_at, a.id) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
      );
    }
    const whereClause = sql.join(conditions, sql` AND `);
    const rows = await this.db.execute(sql`
      SELECT a.id, a.actor_type, a.actor_user_id, a.action, a.entity_kind, a.entity_id, a.summary, a.created_at
      FROM activity_log a
      WHERE ${whereClause}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${limit + 1}
    `);
    const raw = rows as unknown as Array<{
      id: string;
      actor_type: string;
      actor_user_id: string | null;
      action: string;
      entity_kind: string | null;
      entity_id: string | null;
      summary: string;
      created_at: string | Date;
    }>;
    const items: ActivityEntry[] = raw.slice(0, limit).map((row) => ({
      id: row.id,
      actorType: row.actor_type,
      actorUserId: row.actor_user_id,
      action: row.action,
      entityKind: row.entity_kind,
      entityId: row.entity_id,
      summary: row.summary,
      createdAt: new Date(row.created_at),
    }));
    const hasMore = raw.length > limit;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async getExportCsv(productId: string, kind: ExportKind): Promise<string> {
    if (kind === 'tasks') {
      const rows = await this.db.execute(sql`
        SELECT t.id, t.code, t.title, t.type, ws.key AS state_key, t.priority, coalesce(t.assignee_id, '') AS assignee,
               coalesce(t.due_date::text, '') AS due, t.created_at, t.updated_at
        FROM tasks t
        JOIN workflow_states ws ON ws.id = t.state_id
        WHERE t.product_id = ${productId} AND t.deleted_at IS NULL
        ORDER BY t.created_at
      `);
      const items = rows as unknown as Array<{
        id: string;
        code: string | null;
        title: string;
        type: string;
        state_key: string;
        priority: string;
        assignee: string;
        due: string;
        created_at: string | Date;
        updated_at: string | Date;
      }>;
      const nodeMap = await this.nodeCodesForEntity(productId, 'task');
      return toCsv(
        [
          'codigo',
          'titulo',
          'tipo',
          'estado',
          'prioridad',
          'responsable',
          'vencimiento',
          'nodos',
          'creada',
          'actualizada',
        ],
        items.map((item) => [
          item.code ?? '',
          item.title,
          item.type,
          item.state_key,
          item.priority,
          item.assignee,
          item.due,
          nodeMap.get(item.id) ?? '',
          this.iso(item.created_at),
          this.iso(item.updated_at),
        ]),
      );
    }

    if (kind === 'issues') {
      const rows = await this.db.execute(sql`
        SELECT i.id, i.code, i.title, i.severity, i.priority, ws.key AS state_key,
               coalesce(i.assignee_id, '') AS assignee, i.created_at
        FROM issues i
        JOIN workflow_states ws ON ws.id = i.state_id
        WHERE i.product_id = ${productId} AND i.deleted_at IS NULL
        ORDER BY i.created_at
      `);
      const items = rows as unknown as Array<{
        id: string;
        code: string | null;
        title: string;
        severity: string;
        priority: string;
        state_key: string;
        assignee: string;
        created_at: string | Date;
      }>;
      const nodeMap = await this.nodeCodesForEntity(productId, 'issue');
      return toCsv(
        ['codigo', 'titulo', 'severidad', 'prioridad', 'estado', 'responsable', 'nodos', 'creada'],
        items.map((item) => [
          item.code ?? '',
          item.title,
          item.severity,
          item.priority,
          item.state_key,
          item.assignee,
          nodeMap.get(item.id) ?? '',
          this.iso(item.created_at),
        ]),
      );
    }

    const rows = await this.db.execute(sql`
      SELECT c.id, c.code, c.title, c.kind, c.status, coalesce(c.git_sha, '') AS git_sha,
             c.executed_at, c.created_at
      FROM changes c
      WHERE c.product_id = ${productId} AND c.deleted_at IS NULL
      ORDER BY c.created_at
    `);
    const items = rows as unknown as Array<{
      id: string;
      code: string | null;
      title: string;
      kind: string;
      status: string;
      git_sha: string;
      executed_at: string | Date | null;
      created_at: string | Date;
    }>;
    const nodeMap = await this.nodeCodesForEntity(productId, 'change');
    return toCsv(
      ['codigo', 'titulo', 'tipo', 'estado', 'git_sha', 'ejecutada', 'nodos', 'creada'],
      items.map((item) => [
        item.code ?? '',
        item.title,
        item.kind,
        item.status,
        item.git_sha,
        item.executed_at ? this.iso(item.executed_at) : '',
        nodeMap.get(item.id) ?? '',
        this.iso(item.created_at),
      ]),
    );
  }

  /** Nodos vinculados (affects) por entidad, en lote (evita N+1 en exports). */
  private async nodeCodesForEntity(
    productId: string,
    kind: 'task' | 'issue' | 'change',
  ): Promise<Map<string, string>> {
    const rows = await this.db.execute(sql`
      SELECT r.source_id AS entity_id, n.code
      FROM relations r
      JOIN product_nodes n ON n.id = r.target_id
      WHERE r.product_id = ${productId}
        AND r.source_kind = ${kind} AND r.target_kind = 'node'
      UNION
      SELECT r.target_id AS entity_id, n.code
      FROM relations r
      JOIN product_nodes n ON n.id = r.source_id
      WHERE r.product_id = ${productId}
        AND r.target_kind = ${kind} AND r.source_kind = 'node'
      ORDER BY entity_id, code
    `);
    const map = new Map<string, string[]>();
    for (const row of rows as unknown as Array<{ entity_id: string; code: string }>) {
      const list = map.get(row.entity_id) ?? [];
      list.push(row.code);
      map.set(row.entity_id, list);
    }
    const out = new Map<string, string>();
    for (const [id, codes] of map) out.set(id, codes.join(', '));
    return out;
  }

  private iso(value: string | Date): string {
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
  }
}
