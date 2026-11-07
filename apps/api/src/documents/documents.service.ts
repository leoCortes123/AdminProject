import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  contentItems,
  documentTypes,
  itemNodeLinks,
  itemVersions,
  productNodes,
  relations,
} from '@devcycle/db';
import {
  Problems,
  type CreateDocumentInput,
  type CreateRelationInput,
  type CreateVersionInput,
  type DocumentStatus,
  type ListDocumentsQueryInput,
  type TransitionDocumentInput,
  type UpdateDocumentInput,
  FUNCTIONAL_DOCUMENT_METADATA_SCHEMAS,
} from '@devcycle/shared';
import { ProblemException } from '../common/problem.exception';
import { DB, type Database } from '../database';
import { ActivityService, type DbExecutor } from '../common/activity.service';
import type { ResolvedProduct } from '../common/authenticated-request';
import { IamService } from '../iam/iam.service';
import { canTransition, isPublishTransition } from './document-transitions';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DocumentDto {
  id: string;
  productId: string;
  docTypeId: string;
  docTypeKey: string;
  docTypeLabel: string;
  code: string | null;
  title: string;
  bodyMarkdown: string;
  status: DocumentStatus;
  scope: string;
  version: number;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  nodeCodes: string[];
}

export interface DocumentVersionDto {
  id: string;
  itemId: string;
  version: number;
  title: string;
  bodyMarkdown: string;
  metadata: Record<string, unknown>;
  authorId: string | null;
  changeNote: string | null;
  createdAt: Date;
}

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly activity: ActivityService,
    private readonly iam: IamService,
  ) {}

  private async findActiveOrThrow(executor: DbExecutor, productId: string, idOrCode: string) {
    const byId = UUID_RE.test(idOrCode);
    const [row] = await executor
      .select()
      .from(contentItems)
      .where(
        and(
          eq(contentItems.productId, productId),
          byId ? eq(contentItems.id, idOrCode) : eq(contentItems.code, idOrCode),
          isNull(contentItems.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new ProblemException(Problems.notFound('Documento', idOrCode));
    return row;
  }

  private async toDto(
    executor: DbExecutor,
    row: typeof contentItems.$inferSelect,
  ): Promise<DocumentDto> {
    const [type] = await executor
      .select()
      .from(documentTypes)
      .where(eq(documentTypes.id, row.docTypeId))
      .limit(1);
    const links = await executor
      .select({ code: productNodes.code })
      .from(itemNodeLinks)
      .innerJoin(productNodes, eq(productNodes.id, itemNodeLinks.nodeId))
      .where(eq(itemNodeLinks.itemId, row.id));
    return {
      id: row.id,
      productId: row.productId,
      docTypeId: row.docTypeId,
      docTypeKey: type?.key ?? '',
      docTypeLabel: type?.label ?? '',
      code: row.code,
      title: row.title,
      bodyMarkdown: row.bodyMarkdown,
      status: row.status as DocumentStatus,
      scope: row.scope,
      version: row.version,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      nodeCodes: links.map((link) => link.code),
    };
  }

  async listTypes() {
    return this.db.select().from(documentTypes).orderBy(documentTypes.position);
  }

  /** Lista de documentos del producto con filtros opcionales (tipo/estado/ámbito/nodo/texto). */
  async listDocuments(productId: string, filters: ListDocumentsQueryInput): Promise<DocumentDto[]> {
    const conditions = [eq(contentItems.productId, productId), isNull(contentItems.deletedAt)];
    if (filters.docTypeKey) {
      conditions.push(
        sql`${contentItems.docTypeId} IN (SELECT id FROM document_types WHERE key = ${filters.docTypeKey})`,
      );
    }
    if (filters.status) conditions.push(eq(contentItems.status, filters.status));
    if (filters.scope) conditions.push(eq(contentItems.scope, filters.scope));
    if (filters.nodeCode) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM item_node_links l
          JOIN product_nodes n ON n.id = l.node_id
          WHERE l.item_id = ${contentItems.id} AND n.code = ${filters.nodeCode}
        )`,
      );
    }
    if (filters.q) {
      const q = `%${filters.q.toLowerCase()}%`;
      conditions.push(
        sql`(
          lower(${contentItems.title}) LIKE ${q}
          OR lower(coalesce(${contentItems.code}, '')) LIKE ${q}
          OR lower(${contentItems.bodyMarkdown}) LIKE ${q}
          OR EXISTS (
            SELECT 1 FROM item_node_links l
            JOIN product_nodes n ON n.id = l.node_id
            WHERE l.item_id = ${contentItems.id} AND lower(n.code) LIKE ${q}
          )
        )`,
      );
    }
    const rows = await this.db
      .select()
      .from(contentItems)
      .where(and(...conditions))
      .orderBy(desc(contentItems.updatedAt));
    return Promise.all(rows.map((row) => this.toDto(this.db, row)));
  }

  async getDocument(productId: string, idOrCode: string): Promise<DocumentDto> {
    const row = await this.findActiveOrThrow(this.db, productId, idOrCode);
    return this.toDto(this.db, row);
  }

  /** Documentos vinculados a un nodo (pestaña Documentación de la ficha, F2-T08). */
  async listForNode(productId: string, nodeCode: string): Promise<DocumentDto[]> {
    const [node] = await this.db
      .select({ id: productNodes.id })
      .from(productNodes)
      .where(
        and(
          eq(productNodes.productId, productId),
          eq(productNodes.code, nodeCode),
          isNull(productNodes.deletedAt),
        ),
      )
      .limit(1);
    if (!node) throw new ProblemException(Problems.notFound('Nodo', nodeCode));
    const rows = await this.db
      .select({ item: contentItems })
      .from(itemNodeLinks)
      .innerJoin(contentItems, eq(contentItems.id, itemNodeLinks.itemId))
      .where(and(eq(itemNodeLinks.nodeId, node.id), isNull(contentItems.deletedAt)))
      .orderBy(desc(contentItems.updatedAt));
    return Promise.all(rows.map(({ item }) => this.toDto(this.db, item)));
  }

  async createDocument(
    product: ResolvedProduct,
    input: CreateDocumentInput,
    actorId: string,
    ip?: string,
  ): Promise<DocumentDto> {
    this.validateFunctionalMetadata(input.docTypeKey, input.metadata);
    try {
      return await this.db.transaction(async (tx) => {
        const [type] = await tx
          .select()
          .from(documentTypes)
          .where(eq(documentTypes.key, input.docTypeKey))
          .limit(1);
        if (!type) {
          throw new ProblemException(
            Problems.unprocessable(`Tipo documental desconocido: '${input.docTypeKey}'`),
          );
        }

        const [created] = await tx
          .insert(contentItems)
          .values({
            productId: product.id,
            docTypeId: type.id,
            code: input.code ?? null,
            title: input.title,
            bodyMarkdown: input.bodyMarkdown,
            metadata: (input.metadata ?? {}) as Record<string, unknown>,
            scope: input.scope,
            status: 'draft',
            version: 1,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();
        if (!created) throw new Error('Insert de documento no devolvió fila');

        // Snapshot inicial v1 (item_versions es append-only; nunca UPDATE/DELETE).
        await tx.insert(itemVersions).values({
          itemId: created.id,
          version: 1,
          title: created.title,
          bodyMarkdown: created.bodyMarkdown,
          metadata: (created.metadata ?? {}) as Record<string, unknown>,
          authorId: actorId,
          changeNote: 'Creación inicial',
        });

        for (const nodeCode of input.nodeCodes) {
          const nodeId = await this.resolveActiveNodeId(tx, product.id, nodeCode);
          await tx
            .insert(itemNodeLinks)
            .values({ itemId: created.id, nodeId, productId: product.id })
            .onConflictDoNothing();
        }

        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'doc.created',
            entityKind: 'item',
            entityId: created.id,
            summary: `Documento creado: ${created.code ? `${created.code} · ` : ''}${created.title}`,
            metadata: { docTypeKey: input.docTypeKey, version: 1, nodeCodes: input.nodeCodes },
            ip: ip ?? null,
          },
          tx,
        );

        return this.toDto(tx, created);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProblemException(
          Problems.conflict(
            `Ya existe un documento con código '${input.code}' en este producto`,
            'document.code_conflict',
          ),
        );
      }
      throw error;
    }
  }

  private validateFunctionalMetadata(docTypeKey: string, metadata: unknown): void {
    const schema =
      FUNCTIONAL_DOCUMENT_METADATA_SCHEMAS[
        docTypeKey as keyof typeof FUNCTIONAL_DOCUMENT_METADATA_SCHEMAS
      ];
    if (!schema) return;
    const result = schema.safeParse(metadata ?? {});
    if (!result.success) {
      const detail = result.error.issues
        .map(
          (issue: { path: (string | number)[]; message: string }) =>
            `${issue.path.join('.') || '(raíz)'}: ${issue.message}`,
        )
        .join('; ');
      throw new ProblemException(
        Problems.unprocessable(`Metadatos estructurados inválidos para '${docTypeKey}': ${detail}`),
      );
    }
  }

  private async resolveActiveNodeId(
    executor: DbExecutor,
    productId: string,
    nodeCode: string,
  ): Promise<string> {
    const [node] = await executor
      .select({ id: productNodes.id })
      .from(productNodes)
      .where(
        and(
          eq(productNodes.productId, productId),
          eq(productNodes.code, nodeCode),
          isNull(productNodes.deletedAt),
        ),
      )
      .limit(1);
    if (!node) {
      throw new ProblemException(
        Problems.unprocessable(`El nodo '${nodeCode}' no existe en este producto`),
      );
    }
    return node.id;
  }

  /** Edita el trabajo en curso. No crea versión (las versiones son snapshots explícitos). */
  async updateDocument(
    product: ResolvedProduct,
    idOrCode: string,
    input: UpdateDocumentInput,
    actorId: string,
    ip?: string,
  ): Promise<DocumentDto> {
    try {
      return await this.db.transaction(async (tx) => {
        const current = await this.findActiveOrThrow(tx, product.id, idOrCode);
        if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) {
          throw new ProblemException(
            Problems.conflict(
              `Conflicto de versión: el documento está en v${current.version} (esperabas v${input.expectedVersion})`,
              'document.version_conflict',
            ),
          );
        }

        let docTypeId = current.docTypeId;
        if (input.docTypeKey) {
          const [type] = await tx
            .select()
            .from(documentTypes)
            .where(eq(documentTypes.key, input.docTypeKey))
            .limit(1);
          if (!type) {
            throw new ProblemException(
              Problems.unprocessable(`Tipo documental desconocido: '${input.docTypeKey}'`),
            );
          }
          docTypeId = type.id;
        }

        const updates: Record<string, unknown> = { updatedAt: new Date(), updatedBy: actorId };
        if (input.docTypeKey) updates['docTypeId'] = docTypeId;

        if (input.metadata !== undefined) {
          let effectiveTypeKey = input.docTypeKey;
          if (!effectiveTypeKey) {
            const [currentType] = await tx
              .select()
              .from(documentTypes)
              .where(eq(documentTypes.id, current.docTypeId))
              .limit(1);
            effectiveTypeKey = currentType?.key ?? '';
          }
          this.validateFunctionalMetadata(effectiveTypeKey, input.metadata);
          updates['metadata'] = input.metadata;
        }
        if (input.title !== undefined) updates['title'] = input.title;
        if (input.bodyMarkdown !== undefined) updates['bodyMarkdown'] = input.bodyMarkdown;
        if (input.scope !== undefined) updates['scope'] = input.scope;

        const baseWhere = and(
          eq(contentItems.id, current.id),
          input.expectedVersion !== undefined
            ? eq(contentItems.version, input.expectedVersion)
            : sql`true`,
        );
        const [updated] = await tx.update(contentItems).set(updates).where(baseWhere).returning();
        if (!updated) {
          throw new ProblemException(
            Problems.conflict(
              'El documento cambió mientras editabas; recarga y reintenta',
              'document.version_conflict',
            ),
          );
        }

        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'doc.updated',
            entityKind: 'item',
            entityId: current.id,
            summary: `Documento editado: ${updated.title}`,
            metadata: {
              fields: Object.keys(updates).filter((key) => key !== 'updatedAt'),
              version: updated.version,
            },
            ip: ip ?? null,
          },
          tx,
        );

        return this.toDto(tx, updated);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProblemException(
          Problems.conflict('Colisión al guardar el documento', 'document.code_conflict'),
        );
      }
      throw error;
    }
  }

  /** Transición controlada del flujo (F2-T02). Publicar exige `docs:publish`. */
  async transitionDocument(
    product: ResolvedProduct,
    idOrCode: string,
    input: TransitionDocumentInput,
    actorId: string,
    ip?: string,
  ): Promise<DocumentDto> {
    const current = await this.findActiveOrThrow(this.db, product.id, idOrCode);
    const from = current.status as DocumentStatus;
    const to = input.toStatus;
    if (isPublishTransition(from, to)) {
      const effective = await this.iam.getEffectivePermissions(actorId, product.id);
      if (!effective.includes('docs:publish')) {
        throw new ProblemException(
          Problems.forbidden('Publicar documentos requiere el permiso docs:publish'),
        );
      }
    }
    if (!canTransition(from, to)) {
      throw new ProblemException({
        ...Problems.conflict(
          `Transición no permitida: ${from} → ${to}`,
          'document.invalid_transition',
        ),
      });
    }
    if (from === to) return this.toDto(this.db, current);

    const [updated] = await this.db
      .update(contentItems)
      .set({ status: to, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(contentItems.id, current.id))
      .returning();
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: to === 'published' ? 'doc.published' : 'doc.transitioned',
      entityKind: 'item',
      entityId: current.id,
      summary: `Documento ${to === 'published' ? 'publicado' : `movido a ${to}`}: ${current.title}`,
      metadata: { from, to },
      ip: ip ?? null,
    });
    return this.toDto(this.db, updated!);
  }

  /**
   * Publica: congela el estado actual como siguiente versión y marca `published`.
   * Desde `published` re-publica creando la siguiente versión (el flujo v1→v2
   * del criterio de aceptación). El guard ya exige `docs:publish`.
   */
  async publishDocument(
    product: ResolvedProduct,
    idOrCode: string,
    changeNote: string | undefined,
    actorId: string,
    ip?: string,
  ): Promise<DocumentDto> {
    try {
      return await this.db.transaction(async (tx) => {
        const current = await this.findActiveOrThrow(tx, product.id, idOrCode);
        if (current.status === 'archived') {
          throw new ProblemException(
            Problems.conflict(
              'Un documento archivado debe reabrirse a borrador antes de publicarse',
              'document.invalid_transition',
            ),
          );
        }
        const nextVersion = current.version + 1;
        // Publicar desde `draft` cruza `in_review` en la misma transacción
        // (documentado en OpenAPI); la máquina estricta vive en `transition`.
        await tx.insert(itemVersions).values({
          itemId: current.id,
          version: nextVersion,
          title: current.title,
          bodyMarkdown: current.bodyMarkdown,
          metadata: (current.metadata ?? {}) as Record<string, unknown>,
          authorId: actorId,
          changeNote: changeNote ?? `Publicación v${nextVersion}`,
        });
        const [updated] = await tx
          .update(contentItems)
          .set({
            status: 'published',
            version: nextVersion,
            updatedAt: new Date(),
            updatedBy: actorId,
          })
          .where(eq(contentItems.id, current.id))
          .returning();
        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'doc.version_published',
            entityKind: 'item',
            entityId: current.id,
            summary: `Versión publicada: ${current.title} (v${nextVersion})`,
            metadata: { version: nextVersion, changeNote: changeNote ?? null },
            ip: ip ?? null,
          },
          tx,
        );
        return this.toDto(tx, updated!);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProblemException(
          Problems.conflict(
            'Conflicto de concurrencia al publicar; recarga y reintenta',
            'document.version_conflict',
          ),
        );
      }
      throw error;
    }
  }

  /**
   * Crea un snapshot versionado (F2-T03). `expectedVersion` opcional: si no
   * coincide con la versión actual del documento → 409 `document.version_conflict`.
   */
  async createVersion(
    product: ResolvedProduct,
    idOrCode: string,
    input: CreateVersionInput,
    actorId: string,
    ip?: string,
  ): Promise<DocumentVersionDto> {
    try {
      return await this.db.transaction(async (tx) => {
        const current = await this.findActiveOrThrow(tx, product.id, idOrCode);
        if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) {
          throw new ProblemException(
            Problems.conflict(
              `Conflicto de versión: el documento está en v${current.version} (esperabas v${input.expectedVersion})`,
              'document.version_conflict',
            ),
          );
        }
        if (input.metadata !== undefined) {
          const [currentType] = await tx
            .select()
            .from(documentTypes)
            .where(eq(documentTypes.id, current.docTypeId))
            .limit(1);
          this.validateFunctionalMetadata(currentType?.key ?? '', input.metadata);
        }
        const nextVersion = current.version + 1;
        const [versionRow] = await tx
          .insert(itemVersions)
          .values({
            itemId: current.id,
            version: nextVersion,
            title: input.title ?? current.title,
            bodyMarkdown: input.bodyMarkdown ?? current.bodyMarkdown,
            metadata: (input.metadata ?? current.metadata ?? {}) as Record<string, unknown>,
            authorId: actorId,
            changeNote: input.changeNote ?? null,
          })
          .returning();
        await tx
          .update(contentItems)
          .set({ version: nextVersion, updatedAt: new Date(), updatedBy: actorId })
          .where(eq(contentItems.id, current.id));
        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'doc.version_created',
            entityKind: 'item',
            entityId: current.id,
            summary: `Versión creada: ${current.title} (v${nextVersion})`,
            metadata: { version: nextVersion, changeNote: input.changeNote ?? null },
            ip: ip ?? null,
          },
          tx,
        );
        return {
          ...versionRow!,
          metadata: (versionRow!.metadata ?? {}) as Record<string, unknown>,
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProblemException(
          Problems.conflict(
            'Conflicto de concurrencia al versionar; recarga y reintenta',
            'document.version_conflict',
          ),
        );
      }
      throw error;
    }
  }

  async listVersions(productId: string, idOrCode: string): Promise<DocumentVersionDto[]> {
    const item = await this.findActiveOrThrow(this.db, productId, idOrCode);
    const rows = await this.db
      .select()
      .from(itemVersions)
      .where(eq(itemVersions.itemId, item.id))
      .orderBy(desc(itemVersions.version));
    return rows.map((r) => ({ ...r, metadata: (r.metadata ?? {}) as Record<string, unknown> }));
  }

  async getVersion(
    productId: string,
    idOrCode: string,
    version: number,
  ): Promise<DocumentVersionDto> {
    const item = await this.findActiveOrThrow(this.db, productId, idOrCode);
    const [row] = await this.db
      .select()
      .from(itemVersions)
      .where(and(eq(itemVersions.itemId, item.id), eq(itemVersions.version, version)))
      .limit(1);
    if (!row) throw new ProblemException(Problems.notFound('Versión', `v${version}`));
    return { ...row, metadata: (row.metadata ?? {}) as Record<string, unknown> };
  }

  /** Soft-delete (deleted_at); las versiones y relaciones se conservan. */
  async deleteDocument(
    product: ResolvedProduct,
    idOrCode: string,
    actorId: string,
    ip?: string,
  ): Promise<{ deleted: boolean }> {
    const current = await this.findActiveOrThrow(this.db, product.id, idOrCode);
    const [deleted] = await this.db
      .update(contentItems)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actorId })
      .where(eq(contentItems.id, current.id))
      .returning({ id: contentItems.id });
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'doc.deleted',
      entityKind: 'item',
      entityId: current.id,
      summary: `Documento desactivado: ${current.title}`,
      metadata: {},
      ip: ip ?? null,
    });
    return { deleted: Boolean(deleted) };
  }

  // -- Vínculos doc↔nodo (item_node_links) y doc↔doc (relations) — F2-T06 ---

  async linkNode(
    product: ResolvedProduct,
    idOrCode: string,
    nodeCode: string,
    actorId: string,
    ip?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const item = await this.findActiveOrThrow(tx, product.id, idOrCode);
      const nodeId = await this.resolveActiveNodeId(tx, product.id, nodeCode);
      await tx
        .insert(itemNodeLinks)
        .values({ itemId: item.id, nodeId, productId: product.id })
        .onConflictDoNothing();
      await this.activity.emit(
        {
          productId: product.id,
          actorUserId: actorId,
          action: 'doc.node_linked',
          entityKind: 'item',
          entityId: item.id,
          summary: `Documento vinculado al nodo ${nodeCode}: ${item.title}`,
          metadata: { nodeId, nodeCode },
          ip: ip ?? null,
        },
        tx,
      );
      return { itemId: item.id, nodeId, nodeCode };
    });
  }

  async unlinkNode(
    product: ResolvedProduct,
    idOrCode: string,
    nodeCode: string,
    actorId: string,
    ip?: string,
  ): Promise<{ unlinked: boolean }> {
    const item = await this.findActiveOrThrow(this.db, product.id, idOrCode);
    const nodeId = await this.resolveActiveNodeId(this.db, product.id, nodeCode);
    const deleted = await this.db
      .delete(itemNodeLinks)
      .where(and(eq(itemNodeLinks.itemId, item.id), eq(itemNodeLinks.nodeId, nodeId)))
      .returning({ itemId: itemNodeLinks.itemId });
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'doc.node_unlinked',
      entityKind: 'item',
      entityId: item.id,
      summary: `Documento desvinculado del nodo ${nodeCode}`,
      metadata: { nodeId, nodeCode },
      ip: ip ?? null,
    });
    return { unlinked: deleted.length > 0 };
  }

  async listLinkedNodes(productId: string, idOrCode: string) {
    const item = await this.findActiveOrThrow(this.db, productId, idOrCode);
    return this.db
      .select({
        nodeId: productNodes.id,
        code: productNodes.code,
        name: productNodes.name,
      })
      .from(itemNodeLinks)
      .innerJoin(productNodes, eq(productNodes.id, itemNodeLinks.nodeId))
      .where(eq(itemNodeLinks.itemId, item.id))
      .orderBy(productNodes.code);
  }

  async createRelation(
    product: ResolvedProduct,
    idOrCode: string,
    input: CreateRelationInput,
    actorId: string,
    ip?: string,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        const source = await this.findActiveOrThrow(tx, product.id, idOrCode);
        if (source.id === input.targetId) {
          throw new ProblemException(
            Problems.unprocessable('Un documento no puede relacionarse consigo mismo'),
          );
        }
        const [target] = await tx
          .select({ id: contentItems.id })
          .from(contentItems)
          .where(
            and(
              eq(contentItems.id, input.targetId),
              eq(contentItems.productId, product.id),
              isNull(contentItems.deletedAt),
            ),
          )
          .limit(1);
        if (!target) {
          throw new ProblemException(
            Problems.unprocessable('El documento destino no existe en este producto'),
          );
        }
        const [created] = await tx
          .insert(relations)
          .values({
            productId: product.id,
            sourceKind: 'item',
            sourceId: source.id,
            targetKind: 'item',
            targetId: input.targetId,
            relationType: input.relationType,
            metadata: input.metadata ?? {},
            createdBy: actorId,
          })
          .returning();
        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'relation.added',
            entityKind: 'item',
            entityId: source.id,
            summary: `Relación ${input.relationType} creada desde ${source.title}`,
            metadata: { targetId: input.targetId, relationType: input.relationType },
            ip: ip ?? null,
          },
          tx,
        );
        return created!;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProblemException(
          Problems.conflict('Esa relación ya existe', 'relation.duplicate'),
        );
      }
      throw error;
    }
  }

  async listRelations(productId: string, idOrCode: string, direction: 'out' | 'in' | 'both') {
    const item = await this.findActiveOrThrow(this.db, productId, idOrCode);
    const base = eq(relations.productId, productId);
    let rows;
    if (direction === 'out') {
      rows = await this.db
        .select()
        .from(relations)
        .where(and(base, eq(relations.sourceKind, 'item'), eq(relations.sourceId, item.id)))
        .orderBy(desc(relations.createdAt));
    } else if (direction === 'in') {
      rows = await this.db
        .select()
        .from(relations)
        .where(and(base, eq(relations.targetKind, 'item'), eq(relations.targetId, item.id)))
        .orderBy(desc(relations.createdAt));
    } else {
      rows = await this.db
        .select()
        .from(relations)
        .where(
          and(
            base,
            sql`(
              (${relations.sourceKind} = 'item' AND ${relations.sourceId} = ${item.id})
              OR (${relations.targetKind} = 'item' AND ${relations.targetId} = ${item.id})
            )`,
          ),
        )
        .orderBy(desc(relations.createdAt));
    }
    return rows;
  }

  async deleteRelation(
    product: ResolvedProduct,
    relationId: string,
    actorId: string,
    ip?: string,
  ): Promise<{ deleted: boolean }> {
    const deleted = await this.db
      .delete(relations)
      .where(and(eq(relations.id, relationId), eq(relations.productId, product.id)))
      .returning({ id: relations.id });
    if (deleted.length === 0) throw new ProblemException(Problems.notFound('Relación', relationId));
    await this.activity.emit({
      productId: product.id,
      actorUserId: actorId,
      action: 'relation.removed',
      entityKind: 'item',
      entityId: null,
      summary: `Relación eliminada: ${relationId}`,
      metadata: { relationId },
      ip: ip ?? null,
    });
    return { deleted: true };
  }
}
