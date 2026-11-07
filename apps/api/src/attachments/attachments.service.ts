import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { attachments, contentItems } from '@devcycle/db';
import { ATTACHMENT_ALLOWED_MIME, ATTACHMENT_MAX_BYTES, Problems } from '@devcycle/shared';
import { ProblemException } from '../common/problem.exception';
import { DB, type Database } from '../database';
import { ActivityService } from '../common/activity.service';
import type { ResolvedProduct } from '../common/authenticated-request';
import { STORAGE_PORT, type StoragePort } from './storage.port';
import { isSvgSafe } from './svg-sanitize';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface AttachmentDto {
  id: string;
  productId: string;
  ownerKind: string;
  ownerId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string | null;
  createdAt: Date;
}

/** Nombre seguro para la clave de storage: minúsculas, sin traversal ni unicode raro. */
export function safeStorageFilename(filename: string): string {
  const base = filename.split('/').pop()?.split('\\').pop() ?? 'file';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'file';
}

/** Magic-bytes básico (03 §6): el header debe coincidir con el MIME declarado. */
function magicMatches(buffer: Buffer, mime: string): boolean {
  if (mime === 'image/png')
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  if (mime === 'image/jpeg')
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/webp')
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP'
    );
  if (mime === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
  if (mime === 'image/svg+xml') return isSvgSafe(buffer.toString('utf8'));
  // Texto (plain/markdown/csv/json/log): sin NUL ni binario obvio.
  return !buffer.includes(0);
}

@Injectable()
export class AttachmentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly activity: ActivityService,
  ) {}

  private async requireOwner(productId: string, ownerId: string) {
    const [owner] = await this.db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.id, ownerId),
          eq(contentItems.productId, productId),
          isNull(contentItems.deletedAt),
        ),
      )
      .limit(1);
    if (!owner) {
      throw new ProblemException(
        Problems.unprocessable('El documento dueño no existe en este producto'),
      );
    }
    return owner;
  }

  /** F2-T05: subida con validación MIME + magic-bytes + SVG sanitizado. */
  async upload(
    product: ResolvedProduct,
    file: UploadedFile,
    ownerId: string,
    actorId: string,
    ip?: string,
  ): Promise<AttachmentDto> {
    if (!file) {
      throw new ProblemException(Problems.validation('Falta el archivo (campo «file»)'));
    }
    if (!(ATTACHMENT_ALLOWED_MIME as readonly string[]).includes(file.mimetype)) {
      throw new ProblemException({
        ...Problems.unprocessable(
          `MIME no permitido: ${file.mimetype || 'desconocido'} · permitidos: ${ATTACHMENT_ALLOWED_MIME.join(', ')}`,
        ),
        code: 'attachment.mime_not_allowed',
      });
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
      throw new ProblemException({
        ...Problems.unprocessable(
          `Archivo demasiado grande: ${(file.size / 1_000_000).toFixed(1)} MB (máx. 15 MB)`,
        ),
        code: 'attachment.too_large',
      });
    }
    if (!magicMatches(file.buffer, file.mimetype)) {
      throw new ProblemException({
        ...Problems.unprocessable(
          'El contenido no coincide con el tipo declarado (magic-bytes) o el SVG es inseguro',
        ),
        code: 'attachment.magic_mismatch',
      });
    }

    await this.requireOwner(product.id, ownerId);

    const id = randomUUID();
    const storageKey = `${product.id}/${id}-${safeStorageFilename(file.originalname)}`;
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    await this.storage.put(storageKey, file.buffer, file.mimetype);
    try {
      const [created] = await this.db
        .insert(attachments)
        .values({
          id,
          productId: product.id,
          ownerKind: 'item',
          ownerId,
          storageKey,
          filename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          sha256,
          uploadedBy: actorId,
        })
        .returning();
      if (!created) throw new Error('Insert de adjunto no devolvió fila');
      await this.activity.emit({
        productId: product.id,
        actorUserId: actorId,
        action: 'attachment.uploaded',
        entityKind: 'item',
        entityId: ownerId,
        summary: `Adjunto subido: ${file.originalname} (${Math.round(file.size / 1024)} KB)`,
        metadata: { attachmentId: id, mime: file.mimetype, sha256 },
        ip: ip ?? null,
      });
      return created;
    } catch (error) {
      // Compensación: si la fila no se guarda, no dejar el binario huérfano.
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async listForOwner(productId: string, ownerId: string): Promise<AttachmentDto[]> {
    await this.requireOwner(productId, ownerId);
    return this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.productId, productId), eq(attachments.ownerId, ownerId)))
      .orderBy(attachments.createdAt);
  }

  async download(productId: string, attachmentId: string) {
    const [row] = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, attachmentId), eq(attachments.productId, productId)))
      .limit(1);
    if (!row) throw new ProblemException(Problems.notFound('Adjunto', attachmentId));
    const object = await this.storage.get(row.storageKey);
    if (!object) throw new ProblemException(Problems.notFound('Archivo', row.filename));
    return { row, object };
  }

  async remove(
    product: ResolvedProduct,
    attachmentId: string,
    actorId: string,
    ip?: string,
  ): Promise<{ deleted: boolean }> {
    const [row] = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, attachmentId), eq(attachments.productId, product.id)))
      .limit(1);
    if (!row) throw new ProblemException(Problems.notFound('Adjunto', attachmentId));
    await this.storage.delete(row.storageKey).catch(() => undefined);
    const deleted = await this.db
      .delete(attachments)
      .where(eq(attachments.id, attachmentId))
      .returning({ id: attachments.id });
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'attachment.deleted',
      entityKind: 'item',
      entityId: row.ownerId,
      summary: `Adjunto eliminado: ${row.filename}`,
      metadata: { attachmentId },
      ip: ip ?? null,
    });
    return { deleted: deleted.length > 0 };
  }
}
