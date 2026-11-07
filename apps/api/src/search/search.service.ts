import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SearchQueryInput } from '@devcycle/shared';
import { DB, type Database } from '../database';

export interface SearchHit {
  kind: 'document';
  id: string;
  code: string | null;
  title: string;
  docTypeKey: string;
  docTypeLabel: string;
  status: string;
  snippet: string;
  rank: number;
  nodeCodes: string[];
}

/**
 * Búsqueda global v1 (F2-T07): FTS en español sobre título/código/cuerpo
 * (`search_tsv`, trigger-maintained) + códigos de nodos vinculados
 * (p. ej. `PANT-02` encuentra los docs de esa pantalla).
 * El índice GIN responde < 50 ms con 50k docs (04 §12); el límite duro es 50.
 */
@Injectable()
export class SearchService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async search(productId: string, input: SearchQueryInput): Promise<SearchHit[]> {
    const q = input.q.trim();
    if (q.length < 1) return [];
    const limit = Math.min(input.limit, 50);

    const rows = await this.db.execute(sql`
      SELECT ci.id, ci.code, ci.title, ci.status,
             dt.key AS doc_type_key, dt.label AS doc_type_label,
             COALESCE(ts_rank(ci.search_tsv, websearch_to_tsquery('spanish', ${q})), 0) AS rank,
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
}
