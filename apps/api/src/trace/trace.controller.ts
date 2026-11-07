import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createChangeRelationSchema,
  createChangeSchema,
  createGenericRelationSchema,
  createTestCaseSchema,
  executeChangeSchema,
  listChangesQuerySchema,
  registerTestResultSchema,
  updateChangeSchema,
} from '@devcycle/shared';
import { Permissions } from '../common/permissions.decorator';
import { ProductGuard } from '../iam/product.guard';
import { PermissionsGuard } from '../iam/permissions.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CurrentProduct } from '../common/current-product.decorator';
import { zodPipe } from '../common/zod.pipe';
import type { AuthUser, ResolvedProduct } from '../common/authenticated-request';
import { ChangesService } from './changes.service';
import { TestCasesService } from './testcases.service';
import { TraceService } from './trace.service';

// -- Modificaciones (M-06) ---------------------------------------------------

@ApiTags('changes')
@ApiCookieAuth()
@Controller('products/:slug/changes')
@UseGuards(ProductGuard, PermissionsGuard)
export class ChangesController {
  constructor(private readonly svc: ChangesService) {}

  @Get()
  @ApiOperation({
    summary: 'Modificaciones del producto (filtros: estado/tipo/nodo/texto)',
  })
  list(
    @CurrentProduct() product: ResolvedProduct,
    @Query(zodPipe(listChangesQuerySchema)) filters: Parameters<ChangesService['listChanges']>[1],
  ) {
    return this.svc.listChanges(product.id, filters);
  }

  @Post()
  @HttpCode(201)
  @Permissions('changes:propose')
  @ApiOperation({ summary: 'Propone una modificación (estado proposed + vínculos a nodos)' })
  create(
    @CurrentProduct() product: ResolvedProduct,
    @Body(zodPipe(createChangeSchema)) input: Parameters<ChangesService['createChange']>[1],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.createChange(product, input, user.id, ip);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una modificación (por uuid o código MOD-…)' })
  detail(@CurrentProduct() product: ResolvedProduct, @Param('id') id: string) {
    return this.svc.getChange(product.id, id);
  }

  @Patch(':id')
  @Permissions('changes:propose')
  @ApiOperation({ summary: 'Edita título/descripción/tipo y refs Git' })
  update(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(updateChangeSchema)) input: Parameters<ChangesService['updateChange']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.updateChange(product, id, input, user.id, ip);
  }

  @Delete(':id')
  @Permissions('changes:propose')
  @ApiOperation({ summary: 'Desactiva (soft-delete) una modificación' })
  remove(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.deleteChange(product, id, user.id, ip);
  }

  @Post(':id/execute')
  @HttpCode(200)
  @Permissions('changes:execute')
  @ApiOperation({
    summary:
      'Ejecuta la modificación (executed) y resuelve atómicamente las INC vinculadas con resolves',
  })
  execute(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(executeChangeSchema)) input: Parameters<ChangesService['executeChange']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.executeChange(product, id, input, user.id, ip);
  }

  @Post(':id/nodes')
  @HttpCode(201)
  @Permissions('changes:propose')
  @ApiOperation({ summary: 'Vincula la modificación a un nodo (affects)' })
  linkNode(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body() body: { nodeCode: string },
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.linkNode(product, id, body.nodeCode, user.id, ip);
  }

  @Post(':id/tasks')
  @HttpCode(201)
  @Permissions('changes:propose')
  @ApiOperation({ summary: 'Vincula la modificación a una tarea (implements)' })
  linkTask(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body() body: { taskId: string },
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.linkTask(product, id, body.taskId, user.id, ip);
  }

  @Post(':id/resolves')
  @HttpCode(201)
  @Permissions('changes:propose')
  @ApiOperation({ summary: 'Vincula la modificación como correctiva de una incidencia (resolves)' })
  linkResolve(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body() body: { issueId: string },
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.linkResolve(product, id, body.issueId, user.id, ip);
  }

  @Post(':id/issues')
  @HttpCode(201)
  @Permissions('changes:propose')
  @ApiOperation({ summary: 'Vincula la modificación a una incidencia (relates_to, sin cierre)' })
  linkIssue(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body() body: { issueId: string },
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.linkIssueRelate(product, id, body.issueId, user.id, ip);
  }

  @Post(':id/relations')
  @HttpCode(201)
  @Permissions('changes:propose')
  @ApiOperation({ summary: 'Relación genérica change→{node,item,task,issue,change,test_case}' })
  createRelation(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(createChangeRelationSchema))
    input: Parameters<ChangesService['createRelation']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.createRelation(product, id, input, user.id, ip);
  }

  @Get(':id/relations')
  @ApiOperation({ summary: 'Relaciones de la modificación (direction: out|in|both)' })
  relations(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Query('direction') direction?: string,
  ) {
    const dir = direction === 'in' || direction === 'out' ? direction : 'both';
    return this.svc.listRelations(product.id, id, dir);
  }
}

// -- Casos de prueba (M-07) ---------------------------------------------------

@ApiTags('test-cases')
@ApiCookieAuth()
@Controller('products/:slug/tests')
@UseGuards(ProductGuard, PermissionsGuard)
export class TestCasesController {
  constructor(private readonly svc: TestCasesService) {}

  @Get()
  @ApiOperation({ summary: 'Casos de prueba del producto' })
  list(@CurrentProduct() product: ResolvedProduct) {
    return this.svc.list(product.id);
  }

  @Post()
  @HttpCode(201)
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Crea un caso de prueba (verifies a documentos/nodos)' })
  create(
    @CurrentProduct() product: ResolvedProduct,
    @Body(zodPipe(createTestCaseSchema)) input: Parameters<TestCasesService['create']>[1],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.create(product, input, user.id, ip);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un caso de prueba (por uuid o código TC-…)' })
  detail(@CurrentProduct() product: ResolvedProduct, @Param('id') id: string) {
    return this.svc.get(product.id, id);
  }

  @Post(':id/results')
  @HttpCode(201)
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Registra el resultado de una ejecución (passed/failed/skipped)' })
  register(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(registerTestResultSchema))
    input: Parameters<TestCasesService['registerResult']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.registerResult(product, id, input, user.id, ip);
  }

  @Get(':id/results')
  @ApiOperation({ summary: 'Resultados de un caso de prueba (desc)' })
  results(@CurrentProduct() product: ResolvedProduct, @Param('id') id: string) {
    return this.svc.listResults(product.id, id);
  }
}

// -- Relaciones genéricas + traza (M-07) ---------------------------------------

@ApiTags('trace')
@ApiCookieAuth()
@Controller('products/:slug/relations')
@UseGuards(ProductGuard, PermissionsGuard)
export class RelationsController {
  constructor(private readonly trace: TraceService) {}

  @Get()
  @ApiOperation({
    summary: 'Relaciones sin proyectar (filtros: entityKind/entityId/direction/tipos)',
  })
  list(
    @CurrentProduct() product: ResolvedProduct,
    @Query('entityKind') entityKind?: string,
    @Query('entityId') entityId?: string,
    @Query('direction') direction?: string,
    @Query('sourceKind') sourceKind?: string,
    @Query('targetKind') targetKind?: string,
    @Query('relationType') relationType?: string,
  ) {
    const dir = direction === 'in' || direction === 'out' ? direction : 'both';
    return this.trace.listRelations(product.id, {
      ...(entityKind ? { entityKind } : {}),
      ...(entityId ? { entityId } : {}),
      direction: dir,
      ...(sourceKind ? { sourceKind } : {}),
      ...(targetKind ? { targetKind } : {}),
      ...(relationType ? { relationType } : {}),
    });
  }

  @Post()
  @HttpCode(201)
  @Permissions('changes:propose')
  @ApiOperation({ summary: 'Crea una relación genérica (kinds change/test_case ya endurecidos)' })
  create(
    @CurrentProduct() product: ResolvedProduct,
    @Body(zodPipe(createGenericRelationSchema))
    input: Parameters<TraceService['createGenericRelation']>[1],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.trace.createGenericRelation(product, input, user.id, ip);
  }

  @Delete(':id')
  @Permissions('changes:propose')
  @ApiOperation({ summary: 'Elimina una relación genérica' })
  remove(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.trace.deleteRelation(product, id, user.id, ip);
  }
}

@ApiTags('trace')
@ApiCookieAuth()
@Controller('products/:slug/trace')
@UseGuards(ProductGuard, PermissionsGuard)
export class TraceController {
  constructor(private readonly trace: TraceService) {}

  @Get('tasks-affecting-node')
  @ApiOperation({ summary: 'Q1 · ¿Qué tareas afectan esta pantalla? (nodeCode) ' })
  q1(@CurrentProduct() product: ResolvedProduct, @Query('nodeCode') nodeCode: string) {
    return this.trace.tasksAffectingNode(product.id, nodeCode);
  }

  @Get('screens-using-rule')
  @ApiOperation({ summary: 'Q2 · ¿Qué pantallas utilizan esta regla? (itemCode/itemId) ' })
  q2(
    @CurrentProduct() product: ResolvedProduct,
    @Query('itemCode') itemCode?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.trace.screensUsingRule(product.id, itemCode ?? itemId ?? '');
  }

  @Get('documents-for-node')
  @ApiOperation({ summary: 'Q3 · ¿Qué documentos describen este proceso? (nodeCode) ' })
  q3(@CurrentProduct() product: ResolvedProduct, @Query('nodeCode') nodeCode: string) {
    return this.trace.documentsForNode(product.id, nodeCode);
  }

  @Get('changes-for-node')
  @ApiOperation({
    summary: 'Q4 · ¿Qué modificaciones implementaron esta funcionalidad? (nodeCode) ',
  })
  q4(@CurrentProduct() product: ResolvedProduct, @Query('nodeCode') nodeCode: string) {
    return this.trace.changesForNode(product.id, nodeCode);
  }

  @Get('tests-for-document')
  @ApiOperation({ summary: 'Q5 · ¿Qué pruebas validan este caso de uso? (itemCode/itemId) ' })
  q5(
    @CurrentProduct() product: ResolvedProduct,
    @Query('itemCode') itemCode?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.trace.testsForDocument(product.id, itemCode ?? itemId ?? '');
  }

  @Get('issues-for-module')
  @ApiOperation({
    summary: 'Q6 · ¿Qué incidencias afectan este módulo (subárbol ltree)? (nodeCode) ',
  })
  q6(@CurrentProduct() product: ResolvedProduct, @Query('nodeCode') nodeCode: string) {
    return this.trace.issuesForModule(product.id, nodeCode);
  }

  @Get('dependents-for-node')
  @ApiOperation({
    summary: 'Q7 · ¿Qué funcionalidades dependen de este componente? (nodeCode, depth ≤ 3) ',
  })
  q7(
    @CurrentProduct() product: ResolvedProduct,
    @Query('nodeCode') nodeCode: string,
    @Query('depth') depth?: string,
  ) {
    return this.trace.dependentsForNode(product.id, nodeCode, depth ? Number(depth) : 1);
  }

  @Get('graph')
  @ApiOperation({ summary: 'Grafo local de un nodo (centro + vecinos, depth ≤ 3) ' })
  graph(
    @CurrentProduct() product: ResolvedProduct,
    @Query('nodeCode') nodeCode: string,
    @Query('depth') depth?: string,
  ) {
    return this.trace.graphForNode(product.id, nodeCode, depth ? Number(depth) : 1);
  }

  @Post('sweep')
  @HttpCode(200)
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Barrido de integridad: 0 huérfanos garantiza los triggers (F4-T07) ' })
  sweep(@CurrentProduct() product: ResolvedProduct) {
    return this.trace.sweep(product.id);
  }
}

// -- Vista de ficha: cambios, relaciones e historial por nodo -------------------

@ApiTags('trace')
@ApiCookieAuth()
@Controller('products/:slug/nodes')
@UseGuards(ProductGuard, PermissionsGuard)
export class NodeTraceController {
  constructor(
    private readonly changes: ChangesService,
    private readonly trace: TraceService,
  ) {}

  @Get(':code/changes')
  @ApiOperation({ summary: 'Modificaciones de un nodo (historia de evolución por pantalla) ' })
  changesForNode(@CurrentProduct() product: ResolvedProduct, @Param('code') code: string) {
    return this.changes.listForNode(product.id, code);
  }

  @Get(':code/relations')
  @ApiOperation({ summary: 'Relaciones salientes/entrantes de un nodo (ficha → Relaciones) ' })
  relationsForNode(
    @CurrentProduct() product: ResolvedProduct,
    @Param('code') code: string,
    @Query('direction') direction?: string,
  ) {
    const dir = direction === 'in' || direction === 'out' ? direction : 'both';
    return this.trace.nodeRelations(product.id, code, dir);
  }

  @Get(':code/history')
  @ApiOperation({
    summary: 'Historia unificada del nodo: activity_log + item_versions (ficha → Historial)',
  })
  historyForNode(@CurrentProduct() product: ResolvedProduct, @Param('code') code: string) {
    return this.trace.historyForNode(product.id, code);
  }
}
