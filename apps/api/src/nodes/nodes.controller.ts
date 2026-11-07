import { Body, Controller, Get, HttpCode, Ip, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createNodeSchema, moveNodeSchema, updateNodeSchema } from '@devcycle/shared';
import { Permissions } from '../common/permissions.decorator';
import { ProductGuard } from '../iam/product.guard';
import { PermissionsGuard } from '../iam/permissions.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CurrentProduct } from '../common/current-product.decorator';
import { zodPipe } from '../common/zod.pipe';
import type { AuthUser, ResolvedProduct } from '../common/authenticated-request';
import { NodesService } from './nodes.service';

@ApiTags('nodes')
@ApiCookieAuth()
@Controller('products/:slug/nodes')
@UseGuards(ProductGuard, PermissionsGuard)
export class NodesController {
  constructor(private readonly nodes: NodesService) {}

  @Get()
  @ApiOperation({ summary: 'Árbol plano del producto, ordenado por path (ltree)' })
  list(@CurrentProduct() product: ResolvedProduct) {
    return this.nodes.listNodes(product.id);
  }

  @Post()
  @HttpCode(201)
  @Permissions('nodes:write')
  @ApiOperation({ summary: 'Crea un nodo (código inmutable, único por producto)' })
  create(
    @CurrentProduct() product: ResolvedProduct,
    @Body(zodPipe(createNodeSchema)) input: Parameters<NodesService['createNode']>[1],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.nodes.createNode(product, input, user.id, ip);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Detalle de un nodo' })
  detail(@CurrentProduct() product: ResolvedProduct, @Param('code') code: string) {
    return this.nodes.getNode(product.id, code);
  }

  @Patch(':code')
  @Permissions('nodes:write')
  @ApiOperation({
    summary: 'Actualiza nombre/descripción/objetivo/estado/owner/posición (el código es inmutable)',
  })
  update(
    @CurrentProduct() product: ResolvedProduct,
    @Param('code') code: string,
    @Body(zodPipe(updateNodeSchema)) input: Parameters<NodesService['updateNode']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.nodes.updateNode(product, code, input, user.id, ip);
  }

  @Post(':code/move')
  @HttpCode(200)
  @Permissions('nodes:write')
  @ApiOperation({
    summary:
      'Mueve un nodo (y su subárbol) bajo otro padre; transacción serializable; valida ciclos',
  })
  move(
    @CurrentProduct() product: ResolvedProduct,
    @Param('code') code: string,
    @Body(zodPipe(moveNodeSchema)) input: Parameters<NodesService['moveNode']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.nodes.moveNode(product, code, input, user.id, ip);
  }

  @Post(':code/duplicate')
  @HttpCode(201)
  @Permissions('nodes:write')
  @ApiOperation({
    summary: 'Duplica el subárbol completo con códigos nuevos (siguiente número libre por prefijo)',
  })
  duplicate(
    @CurrentProduct() product: ResolvedProduct,
    @Param('code') code: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.nodes.duplicateNode(product, code, user.id, ip);
  }

  @Post(':code/deactivate')
  @HttpCode(200)
  @Permissions('nodes:write')
  @ApiOperation({ summary: 'Soft-delete del subárbol completo (deleted_at)' })
  deactivate(
    @CurrentProduct() product: ResolvedProduct,
    @Param('code') code: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.nodes.deactivateNode(product, code, user.id, ip);
  }
}
