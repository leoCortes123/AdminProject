import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/public.decorator';
import { zodPipe } from '../common/zod.pipe';
import { CurrentProduct } from '../common/current-product.decorator';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { ProductsService } from '../products/products.service';
import { NodesService } from '../nodes/nodes.service';
import { DocumentsService } from '../documents/documents.service';
import { TasksService } from '../work/tasks.service';
import { IssuesService } from '../work/issues.service';
import { ChangesService } from '../trace/changes.service';
import { TestCasesService } from '../trace/testcases.service';
import { TraceService } from '../trace/trace.service';
import { FollowupService } from '../followup/followup.service';
import { SearchService } from '../search/search.service';
import {
  integrationContextQuerySchema,
  listChangesQuerySchema,
  listDocumentsQuerySchema,
  listIssuesQuerySchema,
  listTasksQuerySchema,
  searchQuerySchema,
} from '@devcycle/shared';
import { IntegrationTokenGuard } from './integration-token.guard';
import { IntegrationScopes } from './integration-scopes.decorator';
import { AgentAuditService } from './agent-audit.service';
import { IntegrationContextService } from './integration-context.service';

/**
 * Capa de integración read-only (F6a-T02): reexpone consultas en forma
 * estable para el servidor MCP. Solo lectura; sin sesión web (Bearer dvc_…).
 * Cada handler audita `agent_executions` + `activity_log` (actor agent).
 */
@ApiTags('integration')
@ApiBearerAuth()
@Public()
@UseGuards(IntegrationTokenGuard)
@Controller('integration')
export class IntegrationController {
  constructor(
    private readonly products: ProductsService,
    private readonly nodes: NodesService,
    private readonly docs: DocumentsService,
    private readonly tasks: TasksService,
    private readonly issues: IssuesService,
    private readonly changes: ChangesService,
    private readonly tests: TestCasesService,
    private readonly trace: TraceService,
    private readonly followup: FollowupService,
    private readonly search: SearchService,
    private readonly audit: AgentAuditService,
    private readonly context: IntegrationContextService,
  ) {}

  private async auditArgs(req: AuthenticatedRequest, tool: string, args: Record<string, unknown>) {
    if (!req.agent) return;
    await this.audit.record({
      productId: req.agent.productId,
      serviceAccountId: req.agent.serviceAccountId,
      agentName: req.agent.agentName,
      toolName: tool,
      args,
      status: 'ok',
      durationMs: 0,
    });
  }

  // --- 1 · Productos -------------------------------------------------------

  @Get('products')
  @IntegrationScopes('read:products')
  @ApiOperation({ summary: 'list_products — productos visibles para el token (solo el suyo)' })
  async listProducts(@Req() req: AuthenticatedRequest) {
    const product = await this.products.findBySlug(req.agent!.slug);
    await this.auditArgs(req, 'list_products', {});
    return { items: product ? [product] : [] };
  }

  @Get('products/:slug')
  @IntegrationScopes('read:products')
  @ApiOperation({ summary: 'get_product — ficha del producto del token' })
  async getProduct(@Req() req: AuthenticatedRequest) {
    await this.auditArgs(req, 'get_product', {});
    return this.products.findBySlug(req.agent!.slug);
  }

  // --- 2 · Estructura ------------------------------------------------------

  @Get('products/:slug/structure')
  @IntegrationScopes('read:structure')
  @ApiOperation({ summary: 'get_product_structure — árbol funcional plano ordenado por path' })
  async structure(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
  ) {
    await this.auditArgs(req, 'get_product_structure', {});
    return this.nodes.listNodes(product.id);
  }

  @Get('products/:slug/nodes/:code')
  @IntegrationScopes('read:structure')
  @ApiOperation({ summary: 'get_node — nodo con tipo, breadcrumb por path' })
  async node(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Param('code') code: string,
  ) {
    const node = await this.nodes.getNode(product.id, code);
    await this.auditArgs(req, 'get_node', { nodeCode: code });
    return node;
  }

  @Get('products/:slug/nodes/:code/context')
  @IntegrationScopes('read:products', 'read:structure')
  @ApiOperation({
    summary: 'get_product_context — contexto acotado (≤32 KB) para agente (06 §6)',
  })
  async productContext(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Param('code') code: string,
    @Query(zodPipe(integrationContextQuerySchema))
    query: Parameters<IntegrationContextService['getProductContext']> extends never
      ? never
      : { sections?: string; maxBytes: number },
  ) {
    const result = await this.context.getProductContext(
      product.id,
      code,
      query.sections,
      query.maxBytes,
    );
    await this.auditArgs(req, 'get_product_context', {
      nodeCode: code,
      sections: query.sections ?? 'default',
    });
    return result;
  }

  // --- 3 · Documentación -----------------------------------------------------

  @Get('products/:slug/documents')
  @IntegrationScopes('read:docs')
  @ApiOperation({
    summary: 'list_documents — documentos del producto (filtros docType/status/nodo)',
  })
  async listDocuments(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Query(zodPipe(listDocumentsQuerySchema))
    filters: Parameters<DocumentsService['listDocuments']>[1],
  ) {
    const items = await this.docs.listDocuments(product.id, filters);
    await this.auditArgs(req, 'list_documents', {
      nodeCode: filters.nodeCode ?? '',
      docType: filters.docTypeKey ?? '',
    });
    return items;
  }

  @Get('products/:slug/documents/:code')
  @IntegrationScopes('read:docs')
  @ApiOperation({ summary: 'get_document — documento completo (Markdown) + nodos vinculados' })
  async document(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Param('code') code: string,
  ) {
    const doc = await this.docs.getDocument(product.id, code);
    await this.auditArgs(req, 'get_document', { documentCode: code });
    return doc;
  }

  @Get('products/:slug/documents/:code/history')
  @IntegrationScopes('read:docs')
  @ApiOperation({ summary: 'get_document_history — versiones sin cuerpos' })
  async documentHistory(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Param('code') code: string,
  ) {
    const versions = await this.docs.listVersions(product.id, code);
    await this.auditArgs(req, 'get_document_history', { documentCode: code });
    return versions.map((v) => ({
      version: v.version,
      authorId: v.authorId,
      changeNote: v.changeNote,
      createdAt: v.createdAt,
    }));
  }

  // --- 4 · Tareas ------------------------------------------------------------

  @Get('products/:slug/tasks')
  @IntegrationScopes('read:tasks')
  @ApiOperation({ summary: 'list_tasks — tareas del producto (filtros nodo/estado/prioridad)' })
  async listTasks(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Query(zodPipe(listTasksQuerySchema)) filters: Parameters<TasksService['listTasks']>[1],
  ) {
    const items = await this.tasks.listTasks(product.id, filters);
    await this.auditArgs(req, 'list_tasks', { nodeCode: filters.nodeCode ?? '' });
    return items;
  }

  @Get('products/:slug/tasks/:code')
  @IntegrationScopes('read:tasks')
  @ApiOperation({ summary: 'get_task — ficha de tarea con criterios y relaciones' })
  async task(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Param('code') code: string,
  ) {
    const task = await this.tasks.getTask(product.id, code);
    await this.auditArgs(req, 'get_task', { taskCode: code });
    return task;
  }

  // --- 5 · Incidencias ---------------------------------------------------------

  @Get('products/:slug/issues')
  @IntegrationScopes('read:issues')
  @ApiOperation({ summary: 'list_issues — incidencias del producto (severidad/estado/nodo)' })
  async listIssues(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Query(zodPipe(listIssuesQuerySchema)) filters: Parameters<IssuesService['listIssues']>[1],
  ) {
    const items = await this.issues.listIssues(product.id, filters);
    await this.auditArgs(req, 'list_issues', { nodeCode: filters.nodeCode ?? '' });
    return items;
  }

  @Get('products/:slug/issues/:code')
  @IntegrationScopes('read:issues')
  @ApiOperation({ summary: 'get_issue — detalle completo (esperado/observado/pasos)' })
  async issue(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Param('code') code: string,
  ) {
    const issue = await this.issues.getIssue(product.id, code);
    await this.auditArgs(req, 'get_issue', { issueCode: code });
    return issue;
  }

  // --- 6 · Trazabilidad -----------------------------------------------------------

  @Get('products/:slug/nodes/:code/history')
  @IntegrationScopes('read:trace')
  @ApiOperation({ summary: 'get_node_history — timeline del nodo (activity + versiones)' })
  async nodeHistory(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Param('code') code: string,
  ) {
    const history = await this.trace.historyForNode(product.id, code);
    await this.auditArgs(req, 'get_node_history', { nodeCode: code });
    return history;
  }

  @Get('products/:slug/nodes/:code/relations')
  @IntegrationScopes('read:trace')
  @ApiOperation({ summary: 'get_node_relations — relaciones salientes/entrantes del nodo' })
  async nodeRelations(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Param('code') code: string,
    @Query('direction') direction?: string,
  ) {
    const dir = direction === 'in' || direction === 'out' ? direction : 'both';
    const relations = await this.trace.nodeRelations(product.id, code, dir);
    await this.auditArgs(req, 'get_node_relations', { nodeCode: code, direction: dir });
    return relations;
  }

  @Get('products/:slug/trace/graph')
  @IntegrationScopes('read:trace')
  @ApiOperation({ summary: 'get_dependencies — grafo acotado (depth ≤ 3) de un nodo' })
  async graph(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Query('nodeCode') nodeCode: string,
    @Query('depth') depth?: string,
  ) {
    const graph =
      nodeCode !== undefined && nodeCode !== ''
        ? await this.trace.graphForNode(product.id, nodeCode, depth ? Number(depth) : 1)
        : [];
    await this.auditArgs(req, 'get_dependencies', { nodeCode: nodeCode ?? '' });
    return graph;
  }

  // --- 7 · Modificaciones / pruebas ------------------------------------------------

  @Get('products/:slug/changes')
  @IntegrationScopes('read:changes')
  @ApiOperation({ summary: 'list_changes — modificaciones del producto (estado/tipo/nodo)' })
  async listChanges(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Query(zodPipe(listChangesQuerySchema)) filters: Parameters<ChangesService['listChanges']>[1],
  ) {
    const items = await this.changes.listChanges(product.id, filters);
    await this.auditArgs(req, 'list_changes', { nodeCode: filters.nodeCode ?? '' });
    return items;
  }

  @Get('products/:slug/changes/:code')
  @IntegrationScopes('read:changes')
  @ApiOperation({ summary: 'get_change — detalle de una modificación' })
  async change(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Param('code') code: string,
  ) {
    const change = await this.changes.getChange(product.id, code);
    await this.auditArgs(req, 'get_change', { changeCode: code });
    return change;
  }

  @Get('products/:slug/tests')
  @IntegrationScopes('read:tests')
  @ApiOperation({ summary: 'list_test_cases — casos de prueba del producto' })
  async listTests(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
  ) {
    const items = await this.tests.list(product.id);
    await this.auditArgs(req, 'list_test_cases', {});
    return items;
  }

  @Get('products/:slug/tests/:code')
  @IntegrationScopes('read:tests')
  @ApiOperation({ summary: 'get_test_case — caso + última ejecución' })
  async testCase(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Param('code') code: string,
  ) {
    const testCase = await this.tests.get(product.id, code);
    await this.auditArgs(req, 'get_test_case', { testCaseCode: code });
    return testCase;
  }

  // --- 8 · Búsqueda / seguimiento -----------------------------------------------------

  @Get('products/:slug/search')
  @IntegrationScopes('read:search')
  @ApiOperation({ summary: 'search_product_knowledge — FTS global (6 kinds), ranking ts_rank' })
  async searchKnowledge(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
    @Query(zodPipe(searchQuerySchema)) input: Parameters<SearchService['search']>[1],
  ) {
    const hits = await this.search.search(product.id, input);
    await this.auditArgs(req, 'search_product_knowledge', { q: input.q });
    return hits;
  }

  @Get('products/:slug/overview')
  @IntegrationScopes('read:products')
  @ApiOperation({ summary: 'get_product_overview — avance real por conteo de tareas' })
  async overview(
    @Req() req: AuthenticatedRequest,
    @CurrentProduct() product: { id: string; slug: string },
  ) {
    const overview = await this.followup.getOverview(product.id);
    await this.auditArgs(req, 'get_product_overview', {});
    return overview;
  }
}
