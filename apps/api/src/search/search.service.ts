import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SearchQueryInput } from '@devcycle/shared';
import { DB, type Database } from '../database';

export interface SearchHit {
  kind: 'document' | 'node' | 'task' | 'issue' | 'change' | 'test_case';
  id: string;
  code: string | null;
  title: string;
  docTypeKey?: string;
  docTypeLabel?: string;
  nodeTypeKey?: string;
  nodeTypeLabel?: string;
  status: string;
  snippet: string;
  rank: number;
  nodeCodes: string[];
}

/**
 * Búsqueda global (F2-T07 + F5-T05): FTS español (`websearch_to_tsquery` +
 * `ts_rank`, GIN) sobre los 6 kinds + coincidencia exacta de código
 * (`PANT-02`) + ILIKE de respaldo. `kinds` es coma-separated:
 * document,node,task,issue,change,test_case (def. document para compat).
 * El índice GIN responde < 100 ms en la escala v1; límite duro 50.
 * El ranking combina ts_rank + boost por código exacto (5) para que
 * «PANT-02» devuelva primero el nodo/documento/tarea con ese código.
 */
@Injectable()
export class SearchService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async search(productId: string, input: SearchQueryInput): Promise<SearchHit[]> {
    const q = input.q.trim();
    if (q.length < 1) return [];
    const limit = Math.min(input.limit, 50);
    const kinds = new Set(
      (input.kinds ?? 'document')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    );
    const wantsDoc = kinds.has('document');
    const wantsNode = kinds.has('node');
    const wantsTask = kinds.has('task');
    const wantsIssue = kinds.has('issue');
    const wantsChange = kinds.has('change');
    const wantsTest = kinds.has('test_case');
    if (!wantsDoc && !wantsNode && !wantsTask && !wantsIssue && !wantsChange && !wantsTest) {
      return [];
    }

    const results: SearchHit[] = [];

    if (wantsDoc) {
      results.push(...(await this.searchDocuments(productId, q, limit)));
    }
    if (wantsNode) {
      results.push(...(await this.searchNodes(productId, q, limit)));
    }
    if (wantsTask) {
      results.push(...(await this.searchTasks(productId, q, limit)));
    }
    if (wantsIssue) {
      results.push(...(await this.searchIssues(productId, q, limit)));
    }
    if (wantsChange) {
      results.push(...(await this.searchChanges(productId, q, limit)));
    }
    if (wantsTest) {
      results.push(...(await this.searchTests(productId, q, limit)));
    }

    results.sort((a, b) => b.rank - a.rank);
    return results.slice(0, limit);
  }

  private async searchDocuments(productId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.db.execute(sql`
        SELECT ci.id, ci.code, ci.title, ci.status,
               dt.key AS doc_type_key, dt.label AS doc_type_label,
               COALESCE(ts_rank(ci.search_tsv, websearch_to_tsquery('spanish', ${q})), 0)
                 + CASE WHEN lower(coalesce(ci.code, '')) = lower(${q}) THEN 5 ELSE 0 END AS rank,
               left(ci.body_markdown, 220) AS snippet
        FROM content_items ci
        JOIN document_types dt ON dt.id = ci.doc_type_id
        WHERE ci.product_id = ${productId}
          AND ci.deleted_at IS NULL
          AND (
            ci.search_tsv @@ websearch_to_tsquery('spanish', ${q})
            OR lower(ci.code) LIKE ${`%${q.toLowerCase()}%`}
            OR lower(ci.title) LIKE ${`%${q.toLowerCase()}%`}
            OR EXISTS (
              SELECT 1
              FROM item_node_links l
              JOIN product_nodes n ON n.id = l.node_id
              WHERE l.item_id = ci.id AND lower(n.code) = lower(${q})
            )
          )
        ORDER BY rank DESC, ci.updated_at DESC
        LIMIT ${limit}
      `);
    const items = rows as unknown as Array<{
      id: string;
      code: string | null;
      title: string;
      status: string;
      doc_type_key: string;
      doc_type_label: string;
      rank: number | string;
      snippet: string;
    }>;
    if (items.length === 0) return [];
    const nodeCodes = await this.db.execute(sql`
          SELECT l.item_id, n.code
          FROM item_node_links l
          JOIN product_nodes n ON n.id = l.node_id
          WHERE l.item_id IN (
            ${sql.join(
              items.map((item) => sql`${item.id}::uuid`),
              sql`, `,
            )}
          )
          ORDER BY n.code
        `);
    const byItem = new Map<string, string[]>();
    for (const row of nodeCodes as unknown as Array<{ item_id: string; code: string }>) {
      const list = byItem.get(row.item_id) ?? [];
      list.push(row.code);
      byItem.set(row.item_id, list);
    }
    return items.map((item) => ({
      kind: 'document' as const,
      id: item.id,
      code: item.code,
      title: item.title,
      docTypeKey: item.doc_type_key,
      docTypeLabel: item.doc_type_label,
      status: item.status,
      snippet: item.snippet ?? '',
      rank: Number(item.rank),
      nodeCodes: byItem.get(item.id) ?? [],
    }));
  }

  private async searchNodes(productId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.db.execute(sql`
        SELECT pn.id, pn.code, pn.name, pn.status, pn.path::text AS path,
               nt.key AS node_type_key, nt.label AS node_type_label,
               COALESCE(ts_rank(pn.search_tsv, websearch_to_tsquery('spanish', ${q})), 0)
                 + CASE WHEN lower(pn.code) = lower(${q}) THEN 5 ELSE 0 END AS rank
        FROM product_nodes pn
        JOIN node_types nt ON nt.id = pn.node_type_id
        WHERE pn.product_id = ${productId}
          AND pn.deleted_at IS NULL
          AND (
            pn.search_tsv @@ websearch_to_tsquery('spanish', ${q})
            OR lower(pn.code) LIKE ${`%${q.toLowerCase()}%`}
            OR lower(pn.name) LIKE ${`%${q.toLowerCase()}%`}
            OR lower(coalesce(pn.description, '')) LIKE ${`%${q.toLowerCase()}%`}
            OR lower(coalesce(pn.objective, '')) LIKE ${`%${q.toLowerCase()}%`}
          )
        ORDER BY rank DESC, pn.updated_at DESC
        LIMIT ${limit}
      `);
    const items = rows as unknown as Array<{
      id: string;
      code: string | null;
      name: string;
      status: string;
      path: string;
      node_type_key: string;
      node_type_label: string;
      rank: number | string;
    }>;
    return items.map((item) => ({
      kind: 'node' as const,
      id: item.id,
      code: item.code,
      title: item.name,
      nodeTypeKey: item.node_type_key,
      nodeTypeLabel: item.node_type_label,
      status: item.status,
      snippet: item.path ?? '',
      rank: Number(item.rank),
      nodeCodes: item.code ? [item.code] : [],
    }));
  }

  private async searchTasks(productId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.db.execute(sql`
        SELECT t.id, t.code, t.title, ws.key AS status,
               COALESCE(ts_rank(t.search_tsv, websearch_to_tsquery('spanish', ${q})), 0)
                 + CASE WHEN lower(coalesce(t.code, '')) = lower(${q}) THEN 5 ELSE 0 END AS rank,
               left(t.description, 220) AS snippet
        FROM tasks t
        JOIN workflow_states ws ON ws.id = t.state_id
        WHERE t.product_id = ${productId}
          AND t.deleted_at IS NULL
          AND (
            t.search_tsv @@ websearch_to_tsquery('spanish', ${q})
            OR lower(coalesce(t.code, '')) LIKE ${`%${q.toLowerCase()}%`}
            OR lower(t.title) LIKE ${`%${q.toLowerCase()}%`}
            OR lower(t.description) LIKE ${`%${q.toLowerCase()}%`}
            OR EXISTS (
              SELECT 1 FROM relations r
              JOIN product_nodes n ON n.id = r.target_id
              WHERE r.source_kind = 'task' AND r.target_kind = 'node'
                AND r.source_id = t.id AND lower(n.code) = lower(${q})
            )
            OR EXISTS (
              SELECT 1 FROM relations r
              JOIN product_nodes n ON n.id = r.source_id
              WHERE r.target_kind = 'task' AND r.source_kind = 'node'
                AND r.target_id = t.id AND lower(n.code) = lower(${q})
            )
          )
        ORDER BY rank DESC, t.updated_at DESC
        LIMIT ${limit}
      `);
    const items = rows as unknown as Array<{
      id: string;
      code: string | null;
      title: string;
      status: string;
      rank: number | string;
      snippet: string;
    }>;
    const out: SearchHit[] = [];
    for (const item of items) {
      const nodeCodes = await this.db.execute(sql`
          SELECT n.code
          FROM relations r
          JOIN product_nodes n ON n.id = r.target_id
          WHERE r.source_kind = 'task' AND r.source_id = ${item.id} AND r.target_kind = 'node'
          UNION
          SELECT n.code
          FROM relations r
          JOIN product_nodes n ON n.id = r.source_id
          WHERE r.target_kind = 'task' AND r.target_id = ${item.id} AND r.source_kind = 'node'
          ORDER BY 1
        `);
      out.push({
        kind: 'task',
        id: item.id,
        code: item.code,
        title: item.title,
        status: item.status,
        snippet: item.snippet ?? '',
        rank: Number(item.rank),
        nodeCodes: (nodeCodes as unknown as Array<{ code: string }>).map((r) => r.code),
      });
    }
    return out;
  }

  private async searchIssues(productId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.db.execute(sql`
        SELECT i.id, i.code, i.title, ws.key AS status,
               COALESCE(ts_rank(i.search_tsv, websearch_to_tsquery('spanish', ${q})), 0)
                 + CASE WHEN lower(coalesce(i.code, '')) = lower(${q}) THEN 5 ELSE 0 END AS rank,
               left(coalesce(i.description, '') || ' ' || coalesce(i.observed_behavior, ''), 220) AS snippet
        FROM issues i
        JOIN workflow_states ws ON ws.id = i.state_id
        WHERE i.product_id = ${productId}
          AND i.deleted_at IS NULL
          AND (
            i.search_tsv @@ websearch_to_tsquery('spanish', ${q})
            OR lower(coalesce(i.code, '')) LIKE ${`%${q.toLowerCase()}%`}
            OR lower(i.title) LIKE ${`%${q.toLowerCase()}%`}
            OR lower(i.description) LIKE ${`%${q.toLowerCase()}%`}
            OR lower(i.observed_behavior) LIKE ${`%${q.toLowerCase()}%`}
            OR EXISTS (
              SELECT 1 FROM relations r
              JOIN product_nodes n ON n.id = r.target_id
              WHERE r.source_kind = 'issue' AND r.target_kind = 'node'
                AND r.source_id = i.id AND lower(n.code) = lower(${q})
            )
          )
        ORDER BY rank DESC, i.updated_at DESC
        LIMIT ${limit}
      `);
    const items = rows as unknown as Array<{
      id: string;
      code: string | null;
      title: string;
      status: string;
      rank: number | string;
      snippet: string;
    }>;
    const out: SearchHit[] = [];
    for (const item of items) {
      const nodeCodes = await this.db.execute(sql`
          SELECT n.code
          FROM relations r
          JOIN product_nodes n ON n.id = r.target_id
          WHERE r.source_kind = 'issue' AND r.source_id = ${item.id} AND r.target_kind = 'node'
          ORDER BY n.code
        `);
      out.push({
        kind: 'issue',
        id: item.id,
        code: item.code,
        title: item.title,
        status: item.status,
        snippet: item.snippet ?? '',
        rank: Number(item.rank),
        nodeCodes: (nodeCodes as unknown as Array<{ code: string }>).map((r) => r.code),
      });
    }
    return out;
  }

  private async searchChanges(productId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.db.execute(sql`
        SELECT c.id, c.code, c.title, c.status,
               COALESCE(ts_rank(c.search_tsv, websearch_to_tsquery('spanish', ${q})), 0)
                 + CASE WHEN lower(coalesce(c.code, '')) = lower(${q}) THEN 5 ELSE 0 END AS rank,
               left(c.description, 220) AS snippet
        FROM changes c
        WHERE c.product_id = ${productId}
          AND c.deleted_at IS NULL
          AND (
            c.search_tsv @@ websearch_to_tsquery('spanish', ${q})
            OR lower(coalesce(c.code, '')) LIKE ${`%${q.toLowerCase()}%`}
            OR lower(c.title) LIKE ${`%${q.toLowerCase()}%`}
            OR lower(c.description) LIKE ${`%${q.toLowerCase()}%`}
            OR EXISTS (
              SELECT 1 FROM relations r
              JOIN product_nodes n ON n.id = r.target_id
              WHERE r.source_kind = 'change' AND r.target_kind = 'node'
                AND r.source_id = c.id AND lower(n.code) = lower(${q})
            )
          )
        ORDER BY rank DESC, c.updated_at DESC
        LIMIT ${limit}
      `);
    const items = rows as unknown as Array<{
      id: string;
      code: string | null;
      title: string;
      status: string;
      rank: number | string;
      snippet: string;
    }>;
    const out: SearchHit[] = [];
    for (const item of items) {
      const nodeCodes = await this.db.execute(sql`
          SELECT n.code
          FROM relations r
          JOIN product_nodes n ON n.id = r.target_id
          WHERE r.source_kind = 'change' AND r.source_id = ${item.id} AND r.target_kind = 'node'
          ORDER BY n.code
        `);
      out.push({
        kind: 'change',
        id: item.id,
        code: item.code,
        title: item.title,
        status: item.status,
        snippet: item.snippet ?? '',
        rank: Number(item.rank),
        nodeCodes: (nodeCodes as unknown as Array<{ code: string }>).map((r) => r.code),
      });
    }
    return out;
  }

  private async searchTests(productId: string, q: string, limit: number): Promise<SearchHit[]> {
    const rows = await this.db.execute(sql`
        SELECT tc.id, tc.code, tc.title, tc.status,
               COALESCE(ts_rank(tc.search_tsv, websearch_to_tsquery('spanish', ${q})), 0)
                 + CASE WHEN lower(coalesce(tc.code, '')) = lower(${q}) THEN 5 ELSE 0 END AS rank,
               left(tc.title, 220) AS snippet
        FROM test_cases tc
        WHERE tc.product_id = ${productId}
          AND tc.deleted_at IS NULL
          AND (
            tc.search_tsv @@ websearch_to_tsquery('spanish', ${q})
            OR lower(coalesce(tc.code, '')) LIKE ${`%${q.toLowerCase()}%`}
            OR lower(tc.title) LIKE ${`%${q.toLowerCase()}%`}
          )
        ORDER BY rank DESC, tc.updated_at DESC
        LIMIT ${limit}
      `);
    const items = rows as unknown as Array<{
      id: string;
      code: string | null;
      title: string;
      status: string;
      rank: number | string;
      snippet: string;
    }>;
    const out: SearchHit[] = [];
    for (const item of items) {
      const nodeCodes = await this.db.execute(sql`
          SELECT n.code
          FROM relations r
          JOIN product_nodes n ON n.id = r.target_id
          WHERE r.source_kind = 'test_case' AND r.source_id = ${item.id} AND r.target_kind = 'node'
          UNION
          SELECT n.code
          FROM relations r
          JOIN content_items ci ON ci.id = r.target_id
          JOIN item_node_links l ON l.item_id = ci.id
          JOIN product_nodes n ON n.id = l.node_id
          WHERE r.source_kind = 'test_case' AND r.source_id = ${item.id} AND r.target_kind = 'item'
          ORDER BY 1
        `);
      out.push({
        kind: 'test_case',
        id: item.id,
        code: item.code,
        title: item.title,
        status: item.status,
        snippet: item.snippet ?? '',
        rank: Number(item.rank),
        nodeCodes: (nodeCodes as unknown as Array<{ code: string }>).map((r) => r.code),
      });
    }
    return out;
  }
}
