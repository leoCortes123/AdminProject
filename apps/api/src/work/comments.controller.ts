import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createCommentSchema } from '@devcycle/shared';
import { Permissions } from '../common/permissions.decorator';
import { ProductGuard } from '../iam/product.guard';
import { PermissionsGuard } from '../iam/permissions.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CurrentProduct } from '../common/current-product.decorator';
import { zodPipe } from '../common/zod.pipe';
import type { AuthUser, ResolvedProduct } from '../common/authenticated-request';
import { CommentsService } from './comments.service';

@ApiTags('comments')
@ApiCookieAuth()
@Controller('products/:slug/comments')
@UseGuards(ProductGuard, PermissionsGuard)
export class CommentsController {
  constructor(private readonly svc: CommentsService) {}

  @Get(':parentKind/:parentId')
  @ApiOperation({ summary: 'Comentarios de una tarea/incidencia/documento' })
  list(
    @CurrentProduct() product: ResolvedProduct,
    @Param('parentKind') parentKind: string,
    @Param('parentId') parentId: string,
  ) {
    return this.svc.listForParent(product.id, parentKind, parentId);
  }

  @Post()
  @HttpCode(201)
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Crea un comentario (menciones @usuario visibles en activity)' })
  create(
    @CurrentProduct() product: ResolvedProduct,
    @Body(zodPipe(createCommentSchema)) input: Parameters<CommentsService['create']>[1],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.create(product, input, user.id, ip);
  }

  @Delete(':id')
  @Permissions('tasks:write')
  @ApiOperation({ summary: 'Elimina un comentario' })
  remove(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.svc.delete(product, id, user.id, ip);
  }
}
