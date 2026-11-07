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
  createDocumentSchema,
  createRelationSchema,
  createVersionSchema,
  linkNodeSchema,
  listDocumentsQuerySchema,
  publishDocumentSchema,
  transitionDocumentSchema,
  updateDocumentSchema,
} from '@devcycle/shared';
import { Permissions } from '../common/permissions.decorator';
import { ProductGuard } from '../iam/product.guard';
import { PermissionsGuard } from '../iam/permissions.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CurrentProduct } from '../common/current-product.decorator';
import { zodPipe } from '../common/zod.pipe';
import type { AuthUser, ResolvedProduct } from '../common/authenticated-request';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiCookieAuth()
@Controller('products/:slug/documents')
@UseGuards(ProductGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get('types')
  @ApiOperation({ summary: 'Catálogo de tipos documentales (document_types, ordenado)' })
  types() {
    return this.docs.listTypes();
  }

  @Get()
  @ApiOperation({
    summary: 'Documentos del producto (filtros: tipo/estado/ámbito/nodo/texto)',
  })
  list(
    @CurrentProduct() product: ResolvedProduct,
    @Query(zodPipe(listDocumentsQuerySchema))
    filters: Parameters<DocumentsService['listDocuments']>[1],
  ) {
    return this.docs.listDocuments(product.id, filters);
  }

  @Post()
  @HttpCode(201)
  @Permissions('docs:write')
  @ApiOperation({ summary: 'Crea un documento en borrador (snapshot v1 + vínculos a nodos)' })
  create(
    @CurrentProduct() product: ResolvedProduct,
    @Body(zodPipe(createDocumentSchema)) input: Parameters<DocumentsService['createDocument']>[1],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.docs.createDocument(product, input, user.id, ip);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un documento (por uuid o código DOC-…)' })
  detail(@CurrentProduct() product: ResolvedProduct, @Param('id') id: string) {
    return this.docs.getDocument(product.id, id);
  }

  @Patch(':id')
  @Permissions('docs:write')
  @ApiOperation({
    summary: 'Edita título/cuerpo/tipo/ámbito del trabajo en curso (sin crear versión)',
  })
  update(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(updateDocumentSchema)) input: Parameters<DocumentsService['updateDocument']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.docs.updateDocument(product, id, input, user.id, ip);
  }

  @Delete(':id')
  @Permissions('docs:write')
  @ApiOperation({ summary: 'Desactiva (soft-delete) un documento; historia conservada' })
  remove(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.docs.deleteDocument(product, id, user.id, ip);
  }

  @Post(':id/transition')
  @HttpCode(200)
  @Permissions('docs:write')
  @ApiOperation({
    summary: 'Transición controlada (draft→in_review→…); publicar por aquí exige docs:publish',
  })
  transition(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(transitionDocumentSchema))
    input: Parameters<DocumentsService['transitionDocument']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.docs.transitionDocument(product, id, input, user.id, ip);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @Permissions('docs:publish')
  @ApiOperation({
    summary:
      'Publica: congela el estado actual como siguiente versión y marca published (desde draft cruza in_review en la misma transacción)',
  })
  publish(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(publishDocumentSchema)) input: { changeNote?: string },
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.docs.publishDocument(product, id, input.changeNote, user.id, ip);
  }

  @Post(':id/versions')
  @HttpCode(201)
  @Permissions('docs:write')
  @ApiOperation({
    summary: 'Crea un snapshot versionado (append-only); expectedVersion obsoleto → 409',
  })
  createVersion(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(createVersionSchema)) input: Parameters<DocumentsService['createVersion']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.docs.createVersion(product, id, input, user.id, ip);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Historial de versiones (desc)' })
  versions(@CurrentProduct() product: ResolvedProduct, @Param('id') id: string) {
    return this.docs.listVersions(product.id, id);
  }

  @Get(':id/versions/:n')
  @ApiOperation({ summary: 'Detalle de una versión' })
  version(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Param('n') n: string,
  ) {
    const version = Number(n);
    return this.docs.getVersion(product.id, id, version);
  }

  @Post(':id/nodes')
  @HttpCode(201)
  @Permissions('docs:write')
  @ApiOperation({ summary: 'Vincula el documento a un nodo (nodo inexistente → 422)' })
  linkNode(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(linkNodeSchema)) input: { nodeCode: string },
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.docs.linkNode(product, id, input.nodeCode, user.id, ip);
  }

  @Get(':id/nodes')
  @ApiOperation({ summary: 'Nodos vinculados al documento' })
  linkedNodes(@CurrentProduct() product: ResolvedProduct, @Param('id') id: string) {
    return this.docs.listLinkedNodes(product.id, id);
  }

  @Delete(':id/nodes/:nodeCode')
  @Permissions('docs:write')
  @ApiOperation({ summary: 'Desvincula el documento de un nodo' })
  unlinkNode(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Param('nodeCode') nodeCode: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.docs.unlinkNode(product, id, nodeCode, user.id, ip);
  }

  @Post(':id/relations')
  @HttpCode(201)
  @Permissions('docs:write')
  @ApiOperation({ summary: 'Relación doc↔doc (relations, kinds item; trigger de integridad)' })
  createRelation(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Body(zodPipe(createRelationSchema))
    input: Parameters<DocumentsService['createRelation']>[2],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.docs.createRelation(product, id, input, user.id, ip);
  }

  @Get(':id/relations')
  @ApiOperation({ summary: 'Relaciones doc↔doc (direction: out|in|both)' })
  relations(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Query('direction') direction?: string,
  ) {
    const dir = direction === 'in' || direction === 'out' ? direction : 'both';
    return this.docs.listRelations(product.id, id, dir);
  }

  @Delete(':id/relations/:relationId')
  @Permissions('docs:write')
  @ApiOperation({ summary: 'Elimina una relación doc↔doc' })
  deleteRelation(
    @CurrentProduct() product: ResolvedProduct,
    @Param('relationId') relationId: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.docs.deleteRelation(product, relationId, user.id, ip);
  }
}

/** Documentos de un nodo — pestaña Documentación de la ficha (F2-T08). */
@ApiTags('documents')
@ApiCookieAuth()
@Controller('products/:slug/nodes')
@UseGuards(ProductGuard, PermissionsGuard)
export class NodeDocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get(':code/documents')
  @ApiOperation({ summary: 'Documentos vinculados a un nodo (visible en ambos lados)' })
  list(@CurrentProduct() product: ResolvedProduct, @Param('code') code: string) {
    return this.docs.listForNode(product.id, code);
  }
}
