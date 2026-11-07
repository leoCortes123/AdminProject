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
  createDependencySchema,
  createTaskRelationSchema,
  createTaskSchema,
  listTasksQuerySchema,
  transitionTaskSchema,
  updateTaskSchema,
} from '@devcycle/shared';
import { Permissions } from '../common/permissions.decorator';
import { ProductGuard } from '../iam/product.guard';
import { PermissionsGuard } from '../iam/permissions.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CurrentProduct } from '../common/current-product.decorator';
import { zodPipe } from '../common/zod.pipe';
import type { AuthUser, ResolvedProduct } from '../common/authenticated-request';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiCookieAuth()
@Controller('products/:slug/tasks')
@UseGuards(ProductGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly svc: TasksService) {}

  @Get('states')
  @ApiOperation({ summary: 'Estados de tarea del producto (workflow task)' })
  states(@CurrentProduct() product: ResolvedProduct) {
    return this.svc.listStates(product.id);
  }

  @Get('transitions')
  @ApiOperation({ summary: 'Transiciones permitidas de tarea (matriz workflow)' })
  transitions(@CurrentProduct() product: ResolvedProduct) {
    return this.svc.listTransitions(product.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Tareas del producto (filtros: tipo/estado/prioridad/responsable/nodo/texto)',
  })
  list(
    @CurrentProduct() product: ResolvedProduct,
    @Query(zodPipe(listTasksQuerySchema)) filters: Parameters<TasksService['listTasks']>[1],
  ) {
    return this.svc.listTasks(product.id, filters);
  }

  @Post()
  @HttpCode(201)
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Crea una tarea (crit. aceptación, estimación, assignee, nodos)' })
  create(
    @CurrentProduct() product: ResolvedProduct,
    @Body(zodPipe(createTaskSchema)) input: Parameters<TasksService['createTask']>[1],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.createTask(product, input, user.id, ip);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una tarea (por uuid o código TAR-…)' })
  detail(@CurrentProduct() product: ResolvedProduct, @Param('id') id: string) {
    return this.svc.getTask(product.id, id);
  }

  @Patch(':id')
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Edita una tarea' })
  update(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(updateTaskSchema)) input: Parameters<TasksService['updateTask']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.updateTask(product, id, input, user.id, ip);
  }

  @Delete(':id')
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Desactiva (soft-delete) una tarea' })
  remove(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.deleteTask(product, id, user.id, ip);
  }

  @Post(':id/status')
  @HttpCode(200)
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Transición de estado controlada (409 si no declarada)' })
  status(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(transitionTaskSchema)) input: Parameters<TasksService['transitionTask']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.transitionTask(product, id, input, user.id, ip);
  }

  /** Compatibilidad con la ruta del plan: /tasks/:id/status == transition. */

  @Post(':id/dependencies')
  @HttpCode(201)
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Dependencia task↔task (blocks/is_blocked_by; ciclo → 422)' })
  addDep(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(createDependencySchema)) input: Parameters<TasksService['addDependency']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.addDependency(product, id, input, user.id, ip);
  }

  @Get(':id/dependencies')
  @ApiOperation({ summary: 'Dependencias entrantes/salientes de una tarea' })
  deps(@CurrentProduct() product: ResolvedProduct, @Param('id') id: string) {
    return this.svc.listDependencies(product.id, id);
  }

  @Delete(':id/dependencies/:relationId')
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Elimina una dependencia' })
  removeDep(
    @CurrentProduct() product: ResolvedProduct,
    @Param('relationId') relationId: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.removeDependency(product, relationId, user.id, ip);
  }

  @Post(':id/nodes')
  @HttpCode(201)
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Vincula la tarea a un nodo (nodo inexistente → 422)' })
  linkNode(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body() body: { nodeCode: string },
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.linkNode(product, id, body.nodeCode, user.id, ip);
  }

  @Delete(':id/nodes/:nodeCode')
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Desvincula la tarea de un nodo' })
  unlinkNode(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Param('nodeCode') nodeCode: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.unlinkNode(product, id, nodeCode, user.id, ip);
  }

  @Post(':id/relations')
  @HttpCode(201)
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Relación genérica task↔{node,item,issue,task}' })
  createRelation(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(createTaskRelationSchema)) input: Parameters<TasksService['createRelation']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.createRelation(product, id, input, user.id, ip);
  }

  @Get(':id/relations')
  @ApiOperation({ summary: 'Relaciones de la tarea (direction: out|in|both)' })
  relations(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Query('direction') direction?: string,
  ) {
    const dir = direction === 'in' || direction === 'out' ? direction : 'both';
    return this.svc.listRelations(product.id, id, dir);
  }
}

/** Tareas de un nodo — pestaña Tareas de la ficha (F3-T05). */
@ApiTags('tasks')
@ApiCookieAuth()
@Controller('products/:slug/nodes')
@UseGuards(ProductGuard, PermissionsGuard)
export class NodeTasksController {
  constructor(private readonly svc: TasksService) {}

  @Get(':code/tasks')
  @ApiOperation({ summary: 'Tareas vinculadas a un nodo (visible en ambos lados)' })
  list(@CurrentProduct() product: ResolvedProduct, @Param('code') code: string) {
    return this.svc.listForNode(product.id, code);
  }
}
