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
  createIssueLinkTaskSchema,
  createIssueSchema,
  listIssuesQuerySchema,
  transitionIssueSchema,
  updateIssueSchema,
} from '@devcycle/shared';
import { Permissions } from '../common/permissions.decorator';
import { ProductGuard } from '../iam/product.guard';
import { PermissionsGuard } from '../iam/permissions.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CurrentProduct } from '../common/current-product.decorator';
import { zodPipe } from '../common/zod.pipe';
import type { AuthUser, ResolvedProduct } from '../common/authenticated-request';
import { IssuesService } from './issues.service';

@ApiTags('issues')
@ApiCookieAuth()
@Controller('products/:slug/issues')
@UseGuards(ProductGuard, PermissionsGuard)
export class IssuesController {
  constructor(private readonly svc: IssuesService) {}

  @Get('states')
  @ApiOperation({ summary: 'Estados de incidencia del producto (workflow issue)' })
  states(@CurrentProduct() product: ResolvedProduct) {
    return this.svc.listStates(product.id);
  }

  @Get()
  @ApiOperation({
    summary:
      'Incidencias del producto (filtros: severidad/estado/prioridad/responsable/nodo/texto)',
  })
  list(
    @CurrentProduct() product: ResolvedProduct,
    @Query(zodPipe(listIssuesQuerySchema)) filters: Parameters<IssuesService['listIssues']>[1],
  ) {
    return this.svc.listIssues(product.id, filters);
  }

  @Post()
  @HttpCode(201)
  @Permissions('issues:write')
  @ApiOperation({ summary: 'Reporta una incidencia (esperado/observado/pasos/evidencias)' })
  create(
    @CurrentProduct() product: ResolvedProduct,
    @Body(zodPipe(createIssueSchema)) input: Parameters<IssuesService['createIssue']>[1],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.createIssue(product, input, user.id, ip);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una incidencia (por uuid o código INC-…)' })
  detail(@CurrentProduct() product: ResolvedProduct, @Param('id') id: string) {
    return this.svc.getIssue(product.id, id);
  }

  @Patch(':id')
  @Permissions('issues:write')
  @ApiOperation({ summary: 'Edita una incidencia' })
  update(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(updateIssueSchema)) input: Parameters<IssuesService['updateIssue']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.updateIssue(product, id, input, user.id, ip);
  }

  @Delete(':id')
  @Permissions('issues:write')
  @ApiOperation({ summary: 'Desactiva (soft-delete) una incidencia' })
  remove(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.deleteIssue(product, id, user.id, ip);
  }

  @Post(':id/status')
  @HttpCode(200)
  @Permissions('issues:write')
  @ApiOperation({ summary: 'Transición de estado controlada' })
  status(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(transitionIssueSchema)) input: Parameters<IssuesService['transitionIssue']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.transitionIssue(product, id, input, user.id, ip);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @Permissions('issues:write')
  @ApiOperation({ summary: 'Resuelve la incidencia (atajo a resolved)' })
  resolve(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.resolveIssue(product, id, user.id, ip);
  }

  @Post(':id/nodes')
  @HttpCode(201)
  @Permissions('issues:write')
  @ApiOperation({ summary: 'Vincula la incidencia a un nodo' })
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
  @Permissions('issues:write')
  @ApiOperation({ summary: 'Desvincula la incidencia de un nodo' })
  unlinkNode(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Param('nodeCode') nodeCode: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.unlinkNode(product, id, nodeCode, user.id, ip);
  }

  @Post(':id/tasks')
  @HttpCode(201)
  @Permissions('issues:write')
  @ApiOperation({ summary: 'Vincula una tarea correctiva a la incidencia' })
  linkTask(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(createIssueLinkTaskSchema)) input: { taskId: string },
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.linkTask(product, id, input.taskId, user.id, ip);
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'Tareas correctivas vinculadas a la incidencia' })
  linkedTasks(@CurrentProduct() product: ResolvedProduct, @Param('id') id: string) {
    return this.svc.listLinkedTasks(product.id, id);
  }
}

/** Incidencias de un nodo — pestaña Incidencias de la ficha. */
@ApiTags('issues')
@ApiCookieAuth()
@Controller('products/:slug/nodes')
@UseGuards(ProductGuard, PermissionsGuard)
export class NodeIssuesController {
  constructor(private readonly svc: IssuesService) {}

  @Get(':code/issues')
  @ApiOperation({ summary: 'Incidencias vinculadas a un nodo' })
  list(@CurrentProduct() product: ResolvedProduct, @Param('code') code: string) {
    return this.svc.listForNode(product.id, code);
  }
}
