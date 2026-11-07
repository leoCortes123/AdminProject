/**
 * Herramientas MCP read-only (Fase 6b · F6b-T02 / 06 §3.7).
 *
 * 23 tools: cada endpoint `GET /integration/*` (21) + 2 compuestas sin
 * endpoint propio (`search_documents` vía `list_documents?q=`,
 * `get_task_relations` vía `get_task`). Todas con `readOnlyHint=true`,
 * validadas con zod y con presupuesto de 32 KB.
 *
 * Convenciones: `productSlug` opcional en cada tool (defecto: el de
 * arranque); la API impone tenant-escape por token (403 si el slug no es
 * el del token).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CONTEXT_SECTIONS } from '@devcycle/shared';
import { z } from 'zod';
import { DevcycleApiClient, buildQuery, toToolResult } from './api-client.js';
import type { McpConfig } from './config.js';

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const slugSchema = z.string().trim().min(1).max(64);
const productSlugSchema = slugSchema
  .optional()
  .describe('Slug del producto. Por defecto, el de arranque del servidor.');
const codeSchema = z.string().trim().min(1).max(64);
const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .optional()
  .describe('Máximo de elementos devueltos (recorte en cliente).');

function needProduct(config: McpConfig, args: { productSlug?: string | undefined }): string {
  const slug = args.productSlug ?? config.productSlug;
  if (!slug) {
    throw new Error(
      'Falta `productSlug`: el servidor arrancó sin `--product`; pásalo explícitamente.',
    );
  }
  return slug;
}

/** Recorte `limit` en cliente (la API no pagina estas listas). */
function applyLimit<T>(items: T[], limit: number | undefined): T[] {
  if (items.length === 0 || limit === undefined) return items;
  return items.slice(0, limit);
}

/** Filtros en cliente para endpoints sin filtro del lado servidor. */
interface TestCaseLike {
  type?: string;
  status?: string;
  nodeCodes?: string[];
}

function filterTestCases(
  items: TestCaseLike[],
  filters: {
    nodeCode?: string | undefined;
    type?: string | undefined;
    status?: string | undefined;
    limit?: number | undefined;
  },
): TestCaseLike[] {
  let out = items;
  if (filters.type) out = out.filter((t) => t.type === filters.type);
  if (filters.status) out = out.filter((t) => t.status === filters.status);
  if (filters.nodeCode) {
    out = out.filter((t) => (t.nodeCodes ?? []).includes(filters.nodeCode as string));
  }
  return applyLimit(out, filters.limit);
}

export function registerTools(
  server: McpServer,
  client: DevcycleApiClient,
  config: McpConfig,
): void {
  // --- 1 · Consulta de producto (6) -------------------------------------

  server.registerTool(
    'list_products',
    {
      description:
        'Lista los productos visibles para el token de servicio (normalmente uno). ' +
        'Punto de entrada: confirma contra qué producto trabajas antes de consultar.',
      annotations: READ_ONLY,
    },
    async () => {
      const data = await client.get('/integration/products');
      return toToolResult(data);
    },
  );

  server.registerTool(
    'get_product',
    {
      description: 'Ficha del producto: descripción, objetivos, stack, estado y repo.',
      inputSchema: { productSlug: productSlugSchema },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      return toToolResult(await client.get(`/integration/products/${slug}`));
    },
  );

  server.registerTool(
    'get_product_structure',
    {
      description:
        'Árbol funcional plano del producto (nodos ordenados por path). ' +
        'Para contexto de una sola pantalla usa `get_product_context`.',
      inputSchema: {
        productSlug: productSlugSchema,
        depth: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe('Profundidad máxima (1–4, recorte en cliente). Defecto: sin recorte.'),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      const nodes = await client.get<Array<{ depth?: number }>>(
        `/integration/products/${slug}/structure`,
      );
      const items = Array.isArray(nodes) ? nodes : [];
      const filtered =
        args.depth === undefined ? items : items.filter((n) => (n.depth ?? 0) < args.depth!);
      return toToolResult(filtered);
    },
  );

  server.registerTool(
    'get_node',
    {
      description: 'Un nodo del árbol con tipo, estado, descripción y objetivo funcionales.',
      inputSchema: { productSlug: productSlugSchema, nodeCode: codeSchema },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      return toToolResult(
        await client.get(
          `/integration/products/${slug}/nodes/${encodeURIComponent(args.nodeCode)}`,
        ),
      );
    },
  );

  server.registerTool(
    'search_product_knowledge',
    {
      description:
        'Búsqueda FTS en español + códigos sobre documentos, nodos, tareas, incidencias, ' +
        'modificaciones y casos de prueba. Ranking por `ts_rank` + código exacto.',
      inputSchema: {
        productSlug: productSlugSchema,
        query: z.string().trim().min(1).max(300),
        kinds: z
          .string()
          .trim()
          .max(100)
          .optional()
          .describe(
            'Kinds coma-separated: document,node,task,issue,change,test_case. Defecto: document.',
          ),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      return toToolResult(
        await client.get(
          `/integration/products/${slug}/search`,
          buildQuery({ q: args.query, kinds: args.kinds, limit: args.limit }),
        ),
      );
    },
  );

  server.registerTool(
    'get_product_context',
    {
      description:
        'Contexto empaquetado de un nodo/módulo para un agente: objetivo y descripción ' +
        'funcionales, documentos, reglas, casos de uso, tareas pendientes, incidencias ' +
        'abiertas, dependencias e historial. Presupuesto 32 KB (ver 06 §6). ' +
        'Empezar por aquí antes de modificar cualquier pantalla.',
      inputSchema: {
        productSlug: productSlugSchema,
        nodeCode: codeSchema,
        sections: z
          .array(z.enum(CONTEXT_SECTIONS as unknown as [string, ...string[]]))
          .optional()
          .describe(
            `Secciones: ${CONTEXT_SECTIONS.join(', ')}. Defecto: todas excepto history completo.`,
          ),
        maxBytes: z
          .number()
          .int()
          .min(4096)
          .max(32_000)
          .optional()
          .describe('Presupuesto total en bytes. Defecto: 32000.'),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      return toToolResult(
        await client.get(
          `/integration/products/${slug}/nodes/${encodeURIComponent(args.nodeCode)}/context`,
          buildQuery({
            sections: args.sections?.join(','),
            maxBytes: args.maxBytes,
          }),
        ),
      );
    },
  );

  // --- 2 · Documentación (4) ---------------------------------------------

  server.registerTool(
    'list_documents',
    {
      description:
        'Documentos del producto (especificaciones, casos de uso, reglas, contratos…). ' +
        'Devuelve metadatos sin cuerpos para no agotar el presupuesto.',
      inputSchema: {
        productSlug: productSlugSchema,
        nodeCode: codeSchema.optional(),
        docType: z.string().trim().min(1).max(60).optional(),
        status: z.enum(['draft', 'in_review', 'published', 'archived']).optional(),
        limit: limitSchema,
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      const docs = await client.get<Array<Record<string, unknown>>>(
        `/integration/products/${slug}/documents`,
        buildQuery({
          nodeCode: args.nodeCode,
          docTypeKey: args.docType,
          status: args.status,
        }),
      );
      const slim = (Array.isArray(docs) ? docs : []).map((d) => ({
        code: d['code'] ?? null,
        title: d['title'] ?? null,
        docTypeKey: d['docTypeKey'] ?? null,
        docTypeLabel: d['docTypeLabel'] ?? null,
        status: d['status'] ?? null,
        version: d['version'] ?? null,
        nodeCodes: d['nodeCodes'] ?? [],
        updatedAt: d['updatedAt'] ?? null,
      }));
      return toToolResult(applyLimit(slim, args.limit));
    },
  );

  server.registerTool(
    'search_documents',
    {
      description:
        'Busca documentos por texto libre (título, código, cuerpo, nodo) usando el filtro ' +
        '`q` de la lista de documentos. Para buscar también tareas/incidencias/nodos usa ' +
        '`search_product_knowledge`.',
      inputSchema: {
        productSlug: productSlugSchema,
        query: z.string().trim().min(1).max(300),
        docType: z.string().trim().min(1).max(60).optional(),
        limit: limitSchema,
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      const docs = await client.get<Array<Record<string, unknown>>>(
        `/integration/products/${slug}/documents`,
        buildQuery({ q: args.query, docTypeKey: args.docType }),
      );
      const slim = (Array.isArray(docs) ? docs : []).map((d) => ({
        code: d['code'] ?? null,
        title: d['title'] ?? null,
        docTypeKey: d['docTypeKey'] ?? null,
        docTypeLabel: d['docTypeLabel'] ?? null,
        status: d['status'] ?? null,
        version: d['version'] ?? null,
        nodeCodes: d['nodeCodes'] ?? [],
        updatedAt: d['updatedAt'] ?? null,
      }));
      return toToolResult(applyLimit(slim, args.limit));
    },
  );

  server.registerTool(
    'get_document',
    {
      description: 'Documento completo (Markdown) con metadatos y nodos vinculados.',
      inputSchema: { productSlug: productSlugSchema, documentCode: codeSchema },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      return toToolResult(
        await client.get(
          `/integration/products/${slug}/documents/${encodeURIComponent(args.documentCode)}`,
        ),
      );
    },
  );

  server.registerTool(
    'get_document_history',
    {
      description:
        'Versiones del documento sin cuerpos (número, autor, fecha, mensaje). ' +
        'Para el cuerpo usa `get_document`.',
      inputSchema: { productSlug: productSlugSchema, documentCode: codeSchema },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      return toToolResult(
        await client.get(
          `/integration/products/${slug}/documents/${encodeURIComponent(args.documentCode)}/history`,
        ),
      );
    },
  );

  // --- 3 · Tareas (2) ------------------------------------------------------

  server.registerTool(
    'list_tasks',
    {
      description:
        'Tareas del producto con filtros opcionales (nodo, estado, prioridad, responsable).',
      inputSchema: {
        productSlug: productSlugSchema,
        nodeCode: codeSchema.optional(),
        state: z.string().trim().min(1).max(60).optional(),
        priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
        assignee: z.string().trim().min(1).max(128).optional(),
        limit: limitSchema,
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      const tasks = await client.get<unknown[]>(
        `/integration/products/${slug}/tasks`,
        buildQuery({
          nodeCode: args.nodeCode,
          stateKey: args.state,
          priority: args.priority,
          assigneeId: args.assignee,
        }),
      );
      return toToolResult(applyLimit(Array.isArray(tasks) ? tasks : [], args.limit));
    },
  );

  server.registerTool(
    'get_task',
    {
      description:
        'Ficha de tarea: descripción, estado, prioridad, criterios de aceptación, ' +
        'nodos vinculados y dependencias (`blocks`/`blockedBy`).',
      inputSchema: { productSlug: productSlugSchema, taskCode: codeSchema },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      return toToolResult(
        await client.get(
          `/integration/products/${slug}/tasks/${encodeURIComponent(args.taskCode)}`,
        ),
      );
    },
  );

  // --- 4 · Incidencias (2) --------------------------------------------------

  server.registerTool(
    'list_issues',
    {
      description: 'Incidencias del producto con filtros (nodo, severidad, estado).',
      inputSchema: {
        productSlug: productSlugSchema,
        nodeCode: codeSchema.optional(),
        severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
        state: z.string().trim().min(1).max(60).optional(),
        limit: limitSchema,
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      const issues = await client.get<unknown[]>(
        `/integration/products/${slug}/issues`,
        buildQuery({
          nodeCode: args.nodeCode,
          severity: args.severity,
          stateKey: args.state,
        }),
      );
      return toToolResult(applyLimit(Array.isArray(issues) ? issues : [], args.limit));
    },
  );

  server.registerTool(
    'get_issue',
    {
      description:
        'Detalle de incidencia: esperado/observado, pasos de reproducción, severidad y estado.',
      inputSchema: { productSlug: productSlugSchema, issueCode: codeSchema },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      return toToolResult(
        await client.get(
          `/integration/products/${slug}/issues/${encodeURIComponent(args.issueCode)}`,
        ),
      );
    },
  );

  // --- 5 · Trazabilidad (4) -------------------------------------------------

  server.registerTool(
    'get_node_history',
    {
      description: 'Timeline unificada del nodo (actividad humano/agente + versiones).',
      inputSchema: {
        productSlug: productSlugSchema,
        nodeCode: codeSchema,
        limit: limitSchema,
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      const history = await client.get<unknown[]>(
        `/integration/products/${slug}/nodes/${encodeURIComponent(args.nodeCode)}/history`,
      );
      return toToolResult(applyLimit(Array.isArray(history) ? history : [], args.limit));
    },
  );

  server.registerTool(
    'get_node_relations',
    {
      description:
        'Relaciones tipadas salientes/entrantes de un nodo (tareas, docs, cambios, dependencias…).',
      inputSchema: {
        productSlug: productSlugSchema,
        nodeCode: codeSchema,
        direction: z.enum(['in', 'out', 'both']).optional(),
        relationTypes: z
          .array(z.string().trim().min(1).max(60))
          .max(20)
          .optional()
          .describe('Filtra por tipos de relación (recorte en cliente).'),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      const rels = await client.get<Array<Record<string, unknown>>>(
        `/integration/products/${slug}/nodes/${encodeURIComponent(args.nodeCode)}/relations`,
        buildQuery({ direction: args.direction ?? 'both' }),
      );
      const items = Array.isArray(rels) ? rels : [];
      const filtered =
        args.relationTypes && args.relationTypes.length > 0
          ? items.filter((r) => args.relationTypes!.includes(String(r['relationType'] ?? '')))
          : items;
      return toToolResult(filtered);
    },
  );

  server.registerTool(
    'get_task_relations',
    {
      description:
        'Nodos, dependencias y criterios de una tarea (compuesta sobre `get_task`). ' +
        'Usa `blockedBy`/`blocks` (UUIDs) y `nodeCodes` (códigos legibles).',
      inputSchema: { productSlug: productSlugSchema, taskCode: codeSchema },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      const task = (await client.get<Record<string, unknown>>(
        `/integration/products/${slug}/tasks/${encodeURIComponent(args.taskCode)}`,
      )) as Record<string, unknown>;
      return toToolResult({
        taskCode: task['code'] ?? null,
        title: task['title'] ?? null,
        stateKey: task['stateKey'] ?? null,
        nodeCodes: task['nodeCodes'] ?? [],
        blockedBy: task['blockedBy'] ?? [],
        blocks: task['blocks'] ?? [],
        acceptanceCriteria: task['acceptanceCriteria'] ?? [],
      });
    },
  );

  server.registerTool(
    'get_dependencies',
    {
      description:
        'Grafo acotado (depth ≤ 3) de dependencias de un **nodo** vía BFS sobre `relations`. ' +
        'Devuelve centro, nodos y aristas. Para tareas usa `get_task_relations`.',
      inputSchema: {
        productSlug: productSlugSchema,
        nodeCode: codeSchema,
        depth: z.number().int().min(1).max(3).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      return toToolResult(
        await client.get(`/integration/products/${slug}/trace/graph`, {
          nodeCode: args.nodeCode,
          depth: args.depth ?? 1,
        }),
      );
    },
  );

  // --- 6 · Modificaciones y pruebas (2 + 2, reexp. Fase 6a) -----------------

  server.registerTool(
    'list_changes',
    {
      description:
        'Modificaciones (propuestas/ejecutadas, funcionales/técnicas) con filtros opcionales.',
      inputSchema: {
        productSlug: productSlugSchema,
        status: z.enum(['proposed', 'executed']).optional(),
        kind: z.enum(['functional', 'technical']).optional(),
        nodeCode: codeSchema.optional(),
        limit: limitSchema,
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      const changes = await client.get<unknown[]>(
        `/integration/products/${slug}/changes`,
        buildQuery({
          status: args.status,
          kind: args.kind,
          nodeCode: args.nodeCode,
        }),
      );
      return toToolResult(applyLimit(Array.isArray(changes) ? changes : [], args.limit));
    },
  );

  server.registerTool(
    'get_change',
    {
      description: 'Detalle de una modificación (alcance, estado, refs Git y vínculos).',
      inputSchema: { productSlug: productSlugSchema, changeCode: codeSchema },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      return toToolResult(
        await client.get(
          `/integration/products/${slug}/changes/${encodeURIComponent(args.changeCode)}`,
        ),
      );
    },
  );

  server.registerTool(
    'list_test_cases',
    {
      description:
        'Casos de prueba del producto (filtros `type`/`status`/`nodeCode` en cliente: ' +
        'la API lista sin filtros).',
      inputSchema: {
        productSlug: productSlugSchema,
        nodeCode: codeSchema.optional(),
        type: z.enum(['manual', 'automated', 'e2e']).optional(),
        status: z.enum(['active', 'draft', 'archived']).optional(),
        limit: limitSchema,
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      const tests = await client.get<Array<TestCaseLike>>(`/integration/products/${slug}/tests`);
      return toToolResult(
        filterTestCases(Array.isArray(tests) ? tests : [], {
          nodeCode: args.nodeCode,
          type: args.type,
          status: args.status,
          limit: args.limit,
        }),
      );
    },
  );

  server.registerTool(
    'get_test_case',
    {
      description: 'Caso de prueba con última ejecución y cobertura del caso de uso.',
      inputSchema: { productSlug: productSlugSchema, testCaseCode: codeSchema },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      return toToolResult(
        await client.get(
          `/integration/products/${slug}/tests/${encodeURIComponent(args.testCaseCode)}`,
        ),
      );
    },
  );

  // --- 7 · Seguimiento (1, reexp. Fase 6a) ----------------------------------

  server.registerTool(
    'get_product_overview',
    {
      description:
        'Avance real del producto por conteo simple (tareas hechas/total por módulo) ' +
        'más incidencias abiertas, tareas bloqueadas y modificaciones recientes.',
      inputSchema: { productSlug: productSlugSchema },
      annotations: READ_ONLY,
    },
    async (args) => {
      const slug = needProduct(config, args);
      return toToolResult(await client.get(`/integration/products/${slug}/overview`));
    },
  );
}
