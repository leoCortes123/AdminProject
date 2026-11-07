import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permissions } from '../common/permissions.decorator';
import { ProductGuard } from '../iam/product.guard';
import { PermissionsGuard } from '../iam/permissions.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CurrentProduct } from '../common/current-product.decorator';
import type { AuthUser, ResolvedProduct } from '../common/authenticated-request';
import { AttachmentsService, type UploadedFile as UploadedFileDto } from './attachments.service';

const MAX_BYTES = 15_000_000;

@ApiTags('attachments')
@ApiCookieAuth()
@Controller('products/:slug/attachments')
@UseGuards(ProductGuard, PermissionsGuard)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @HttpCode(201)
  @Permissions('docs:write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  @ApiOperation({
    summary:
      'Sube un adjunto a un documento (MIME allowlist + magic-bytes + SVG sanitizado; 15 MB)',
  })
  upload(
    @CurrentProduct() product: ResolvedProduct,
    @Query('ownerId') ownerId: string,
    @UploadedFile() file: UploadedFileDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.attachments.upload(product, file, ownerId, user.id, ip);
  }

  @Get()
  @ApiOperation({ summary: 'Adjuntos de un documento (?ownerId=)' })
  list(@CurrentProduct() product: ResolvedProduct, @Query('ownerId') ownerId: string) {
    return this.attachments.listForOwner(product.id, ownerId);
  }

  /**
   * Descarga segura: SIEMPRE `Content-Disposition: attachment` (ni siquiera
   * imágenes se sirven inline) + CSP `default-src 'none'; sandbox` (03 §6).
   */
  @Get(':id/download')
  @ApiOperation({ summary: 'Descarga un adjunto (siempre como attachment)' })
  async download(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { row, object } = await this.attachments.download(product.id, id);
    const safeName = row.filename.replace(/["\r\n]/g, '_');
    res.status(200);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Type', row.mimeType);
    res.setHeader('Content-Length', String(object.buffer.length));
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(object.buffer);
  }

  @Delete(':id')
  @Permissions('docs:write')
  @ApiOperation({ summary: 'Elimina un adjunto (fila + binario)' })
  remove(
    @CurrentProduct() product: ResolvedProduct,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.attachments.remove(product, id, user.id, ip);
  }
}
