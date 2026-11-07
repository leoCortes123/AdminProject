import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { comments } from '@devcycle/db';
import { Problems, type CreateCommentInput } from '@devcycle/shared';
import { ProblemException } from '../common/problem.exception';
import { DB, type Database } from '../database';
import { ActivityService } from '../common/activity.service';
import type { ResolvedProduct } from '../common/authenticated-request';

@Injectable()
export class CommentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly activity: ActivityService,
  ) {}

  async listForParent(productId: string, parentKind: string, parentId: string) {
    return this.db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.productId, productId),
          eq(comments.parentKind, parentKind),
          eq(comments.parentId, parentId),
        ),
      )
      .orderBy(desc(comments.createdAt));
  }

  /** Compatibilidad: comentarios de una tarea/incidencia/documento. */
  async listForEntity(productId: string, kind: string, id: string) {
    return this.listForParent(productId, kind, id);
  }

  async create(product: ResolvedProduct, input: CreateCommentInput, actorId: string, ip?: string) {
    // El trigger de BD valida que el padre exista en el mismo producto.
    // Aquí solo se valida el cuerpo y se audita.
    let created;
    try {
      [created] = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(comments)
          .values({
            productId: product.id,
            parentKind: input.parentKind,
            parentId: input.parentId,
            authorId: actorId,
            body: input.body,
          })
          .returning();
        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'comment.created',
            entityKind: input.parentKind,
            entityId: input.parentId,
            summary: `Comentario en ${input.parentKind} ${input.parentId.slice(0, 8)}`,
            metadata: { parentKind: input.parentKind, parentId: input.parentId },
            ip: ip ?? null,
          },
          tx,
        );
        return [row];
      });
    } catch (error) {
      const msg = (error as Error).message ?? '';
      if (msg.includes('comments: padre')) {
        throw new ProblemException(
          Problems.unprocessable('El elemento comentado no existe en este producto'),
        );
      }
      throw error;
    }
    return created!;
  }

  async delete(product: ResolvedProduct, commentId: string, actorId: string, ip?: string) {
    const deleted = await this.db
      .delete(comments)
      .where(and(eq(comments.id, commentId), eq(comments.productId, product.id)))
      .returning({ id: comments.id });
    if (deleted.length === 0)
      throw new ProblemException(Problems.notFound('Comentario', commentId));
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'comment.deleted',
      entityKind: null,
      entityId: null,
      summary: `Comentario eliminado: ${commentId}`,
      metadata: { commentId },
      ip: ip ?? null,
    });
    return { deleted: true };
  }
}
