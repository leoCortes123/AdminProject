import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { contentItems, productNodes, relations, testCases, testResults } from '@devcycle/db';
import { Problems, type CreateTestCaseInput, type RegisterTestResultInput } from '@devcycle/shared';
import { ProblemException } from '../common/problem.exception';
import { DB, type Database } from '../database';
import { ActivityService, type DbExecutor } from '../common/activity.service';
import type { ResolvedProduct } from '../common/authenticated-request';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TestCaseDto {
  id: string;
  productId: string;
  code: string | null;
  title: string;
  type: string;
  status: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  itemCodes: string[];
  nodeCodes: string[];
  lastResult: {
    id: string;
    status: string;
    executedAt: Date;
    executedByKind: string;
  } | null;
}

@Injectable()
export class TestCasesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly activity: ActivityService,
  ) {}

  private async findActiveOrThrow(executor: DbExecutor, productId: string, idOrCode: string) {
    const byId = UUID_RE.test(idOrCode);
    const [row] = await executor
      .select()
      .from(testCases)
      .where(
        and(
          eq(testCases.productId, productId),
          byId ? eq(testCases.id, idOrCode) : eq(testCases.code, idOrCode),
          isNull(testCases.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new ProblemException(Problems.notFound('Caso de prueba', idOrCode));
    return row;
  }

  async toDto(executor: DbExecutor, row: typeof testCases.$inferSelect): Promise<TestCaseDto> {
    const items = await executor
      .select({ code: contentItems.code })
      .from(relations)
      .innerJoin(contentItems, eq(contentItems.id, relations.targetId))
      .where(
        and(
          eq(relations.sourceKind, 'test_case'),
          eq(relations.sourceId, row.id),
          eq(relations.targetKind, 'item'),
        ),
      );
    const nodes = await executor
      .select({ code: productNodes.code })
      .from(relations)
      .innerJoin(productNodes, eq(productNodes.id, relations.targetId))
      .where(
        and(
          eq(relations.sourceKind, 'test_case'),
          eq(relations.sourceId, row.id),
          eq(relations.targetKind, 'node'),
        ),
      );
    const [last] = await executor
      .select()
      .from(testResults)
      .where(eq(testResults.testCaseId, row.id))
      .orderBy(desc(testResults.executedAt))
      .limit(1);
    return {
      id: row.id,
      productId: row.productId,
      code: row.code,
      title: row.title,
      type: row.type,
      status: row.status,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      itemCodes: [
        ...new Set(items.map((r) => r.code).filter((c): c is string => Boolean(c))),
      ].sort(),
      nodeCodes: [...new Set(nodes.map((r) => r.code))].sort(),
      lastResult: last
        ? {
            id: last.id,
            status: last.status,
            executedAt: last.executedAt,
            executedByKind: last.executedByKind,
          }
        : null,
    };
  }

  async list(productId: string): Promise<TestCaseDto[]> {
    const rows = await this.db
      .select()
      .from(testCases)
      .where(and(eq(testCases.productId, productId), isNull(testCases.deletedAt)))
      .orderBy(desc(testCases.createdAt));
    return Promise.all(rows.map((row) => this.toDto(this.db, row)));
  }

  async get(productId: string, idOrCode: string): Promise<TestCaseDto> {
    const row = await this.findActiveOrThrow(this.db, productId, idOrCode);
    return this.toDto(this.db, row);
  }

  async create(
    product: ResolvedProduct,
    input: CreateTestCaseInput,
    actorId: string,
    ip?: string,
  ): Promise<TestCaseDto> {
    try {
      return await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(testCases)
          .values({
            productId: product.id,
            code: input.code ?? null,
            title: input.title,
            type: input.type,
            status: input.status,
            createdBy: actorId,
          })
          .returning();
        if (!created) throw new Error('Insert de caso de prueba no devolvió fila');

        for (const itemCode of input.itemCodes ?? []) {
          const [item] = await tx
            .select({ id: contentItems.id })
            .from(contentItems)
            .where(
              and(
                eq(contentItems.productId, product.id),
                eq(contentItems.code, itemCode),
                isNull(contentItems.deletedAt),
              ),
            )
            .limit(1);
          if (!item)
            throw new ProblemException(
              Problems.unprocessable(`El documento '${itemCode}' no existe en este producto`),
            );
          await tx
            .insert(relations)
            .values({
              productId: product.id,
              sourceKind: 'test_case',
              sourceId: created.id,
              targetKind: 'item',
              targetId: item.id,
              relationType: 'verifies',
              metadata: {},
              createdBy: actorId,
            })
            .onConflictDoNothing();
        }
        for (const nodeCode of input.nodeCodes ?? []) {
          const [node] = await tx
            .select({ id: productNodes.id })
            .from(productNodes)
            .where(
              and(
                eq(productNodes.productId, product.id),
                eq(productNodes.code, nodeCode),
                isNull(productNodes.deletedAt),
              ),
            )
            .limit(1);
          if (!node)
            throw new ProblemException(
              Problems.unprocessable(`El nodo '${nodeCode}' no existe en este producto`),
            );
          await tx
            .insert(relations)
            .values({
              productId: product.id,
              sourceKind: 'test_case',
              sourceId: created.id,
              targetKind: 'node',
              targetId: node.id,
              relationType: 'verifies',
              metadata: {},
              createdBy: actorId,
            })
            .onConflictDoNothing();
        }

        await this.activity.emit(
          {
            productId: product.id,
            actorUserId: actorId,
            action: 'test_case.created',
            entityKind: 'test_case',
            entityId: created.id,
            summary: `Caso de prueba creado: ${created.code ? `${created.code} · ` : ''}${created.title}`,
            metadata: { type: input.type, itemCodes: input.itemCodes ?? [] },
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
            `Ya existe un caso de prueba con código '${input.code}' en este producto`,
            'test_case.code_conflict',
          ),
        );
      }
      throw error;
    }
  }

  async registerResult(
    product: ResolvedProduct,
    idOrCode: string,
    input: RegisterTestResultInput,
    actorId: string,
    ip?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const tc = await this.findActiveOrThrow(tx, product.id, idOrCode);
      const [created] = await tx
        .insert(testResults)
        .values({
          testCaseId: tc.id,
          productId: product.id,
          status: input.status,
          environment: input.environment ?? null,
          notes: input.notes,
          executedByKind: 'human',
          executedBy: actorId,
        })
        .returning();
      await this.activity.emit(
        {
          productId: product.id,
          actorUserId: actorId,
          action: 'test_result.registered',
          entityKind: 'test_case',
          entityId: tc.id,
          summary: `Resultado ${input.status} en ${tc.code ?? tc.title}`,
          metadata: { resultId: created!.id, status: input.status },
          ip: ip ?? null,
        },
        tx,
      );
      return created!;
    });
  }

  async listResults(productId: string, idOrCode: string) {
    const tc = await this.findActiveOrThrow(this.db, productId, idOrCode);
    return this.db
      .select()
      .from(testResults)
      .where(eq(testResults.testCaseId, tc.id))
      .orderBy(desc(testResults.executedAt));
  }
}
