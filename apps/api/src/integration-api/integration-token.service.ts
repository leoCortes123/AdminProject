import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { products, serviceAccounts, apiTokens } from '@devcycle/db';
import { Problems, READ_SCOPES, type IntegrationScope } from '@devcycle/shared';
import { DB, type Database } from '../database';
import { ProblemException } from '../common/problem.exception';
import { generateApiToken, hashApiToken, tokenPrefixOf } from './integration-tokens';

export interface ValidatedToken {
  tokenId: string;
  serviceAccountId: string;
  productId: string;
  slug: string;
  name: string;
  agentName: string;
  scopes: string[];
}

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_READ = 120;

/**
 * Tokens de servicio (F6a-T01): creación con scopes, expiración, revocación
 * inmediata y rate-limit en memoria por token (120 req/min lectura).
 * El token en claro se devuelve una única vez; en BD solo vive el hash sha256.
 */
@Injectable()
export class IntegrationTokenService {
  private readonly logger = new Logger(IntegrationTokenService.name);
  private readonly buckets = new Map<string, { count: number; windowStart: number }>();

  constructor(@Inject(DB) private readonly db: Database) {}

  /** Scopes por defecto: solo lectura (principio de mínimo privilegio). */
  defaultReadScopes(): IntegrationScope[] {
    return [...READ_SCOPES] as IntegrationScope[];
  }

  async createServiceAccount(
    productId: string,
    input: { name: string; agentKind: string; description?: string },
    creatorUserId: string,
  ) {
    try {
      const [row] = await this.db
        .insert(serviceAccounts)
        .values({
          productId,
          name: input.name,
          agentKind: input.agentKind,
          description: input.description ?? null,
          createdBy: creatorUserId,
        })
        .returning();
      return row;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ProblemException(
          Problems.conflict(
            `Ya existe una cuenta de servicio '${input.name}' en este producto`,
            'integration.service_account_conflict',
          ),
        );
      }
      throw error;
    }
  }

  async listServiceAccounts(productId: string) {
    return this.db
      .select({
        id: serviceAccounts.id,
        productId: serviceAccounts.productId,
        name: serviceAccounts.name,
        agentKind: serviceAccounts.agentKind,
        description: serviceAccounts.description,
        createdAt: serviceAccounts.createdAt,
        updatedAt: serviceAccounts.updatedAt,
        disabledAt: serviceAccounts.disabledAt,
      })
      .from(serviceAccounts)
      .where(eq(serviceAccounts.productId, productId))
      .orderBy(serviceAccounts.createdAt);
  }

  async disableServiceAccount(productId: string, accountId: string) {
    const [row] = await this.db
      .update(serviceAccounts)
      .set({ disabledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(serviceAccounts.id, accountId), eq(serviceAccounts.productId, productId)))
      .returning();
    if (!row) {
      throw new ProblemException(Problems.notFound('Cuenta de servicio', accountId));
    }
    return row;
  }

  /**
   * Crea un token y devuelve el token EN CLARO una sola vez.
   * El caller debe mostrarlo y no volver a pedirlo (patrón GitHub).
   */
  async createToken(
    productId: string,
    input: {
      serviceAccountId: string;
      scopes: IntegrationScope[];
      expiresInDays?: number;
      label?: string;
    },
    creatorUserId: string,
  ): Promise<{
    id: string;
    token: string;
    tokenPrefix: string;
    scopes: string[];
    expiresAt: Date | null;
    createdAt: Date;
  }> {
    const [account] = await this.db
      .select({ id: serviceAccounts.id, disabledAt: serviceAccounts.disabledAt })
      .from(serviceAccounts)
      .where(
        and(
          eq(serviceAccounts.id, input.serviceAccountId),
          eq(serviceAccounts.productId, productId),
        ),
      )
      .limit(1);
    if (!account) {
      throw new ProblemException(Problems.notFound('Cuenta de servicio', input.serviceAccountId));
    }
    if (account.disabledAt) {
      throw new ProblemException(
        Problems.conflict(
          'La cuenta de servicio está deshabilitada',
          'integration.service_account_disabled',
        ),
      );
    }

    const scopes = input.scopes.length > 0 ? input.scopes : this.defaultReadScopes();
    // agent:confirm jamás puede otorgarse por token (solo humanos lo poseen).
    if (scopes.includes('agent:confirm')) {
      throw new ProblemException(
        Problems.validation('El scope `agent:confirm` no puede otorgarse a un token de servicio'),
      );
    }

    const plain = generateApiToken();
    const hash = hashApiToken(plain);
    const expiresAt =
      input.expiresInDays && input.expiresInDays > 0
        ? new Date(Date.now() + input.expiresInDays * 86_400_000)
        : null;

    const [row] = await this.db
      .insert(apiTokens)
      .values({
        serviceAccountId: account.id,
        tokenHash: hash,
        tokenPrefix: tokenPrefixOf(hash),
        scopes,
        label: input.label ?? null,
        expiresAt,
        createdBy: creatorUserId,
      })
      .returning();
    if (!row) throw new Error('Insert de token no devolvió fila');

    return {
      id: row.id,
      token: plain,
      tokenPrefix: row.tokenPrefix,
      scopes: row.scopes as string[],
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }

  async listTokens(serviceAccountId: string) {
    return this.db
      .select({
        id: apiTokens.id,
        serviceAccountId: apiTokens.serviceAccountId,
        tokenPrefix: apiTokens.tokenPrefix,
        scopes: apiTokens.scopes,
        label: apiTokens.label,
        expiresAt: apiTokens.expiresAt,
        lastUsedAt: apiTokens.lastUsedAt,
        revokedAt: apiTokens.revokedAt,
        createdAt: apiTokens.createdAt,
      })
      .from(apiTokens)
      .where(eq(apiTokens.serviceAccountId, serviceAccountId))
      .orderBy(desc(apiTokens.createdAt));
  }

  async revokeToken(productId: string, tokenId: string) {
    const [row] = await this.db
      .select({ id: apiTokens.id, serviceAccountId: apiTokens.serviceAccountId })
      .from(apiTokens)
      .innerJoin(serviceAccounts, eq(serviceAccounts.id, apiTokens.serviceAccountId))
      .where(and(eq(apiTokens.id, tokenId), eq(serviceAccounts.productId, productId)))
      .limit(1);
    if (!row) throw new ProblemException(Problems.notFound('Token', tokenId));

    await this.db.update(apiTokens).set({ revokedAt: new Date() }).where(eq(apiTokens.id, tokenId));
    this.buckets.delete(tokenId);
    return { id: tokenId, revokedAt: new Date() };
  }

  /**
   * Valida `Bearer dvc_…` → token + cuenta + producto.
   * Revocación instantánea (revoked_at IS NULL) en cada request.
   */
  async validateBearer(rawToken: string | null | undefined): Promise<ValidatedToken> {
    if (!rawToken || !rawToken.startsWith('dvc_')) {
      throw new ProblemException(
        Problems.unauthenticated('Se requiere `Authorization: Bearer dvc_…`'),
      );
    }
    const hash = hashApiToken(rawToken.trim());
    const [row] = await this.db
      .select({
        tokenId: apiTokens.id,
        serviceAccountId: serviceAccounts.id,
        productId: serviceAccounts.productId,
        agentName: serviceAccounts.name,
        disabledAt: serviceAccounts.disabledAt,
        tokenRevokedAt: apiTokens.revokedAt,
        expiresAt: apiTokens.expiresAt,
        scopes: apiTokens.scopes,
        productSlug: products.slug,
        productName: products.name,
        productDeletedAt: products.deletedAt,
      })
      .from(apiTokens)
      .innerJoin(serviceAccounts, eq(serviceAccounts.id, apiTokens.serviceAccountId))
      .innerJoin(products, eq(products.id, serviceAccounts.productId))
      .where(eq(apiTokens.tokenHash, hash))
      .limit(1);

    if (!row || row.tokenRevokedAt || row.disabledAt || row.productDeletedAt) {
      throw new ProblemException(
        Problems.unauthenticated('Token de servicio no válido, revocado o expirado'),
      );
    }
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      throw new ProblemException(Problems.unauthenticated('Token de servicio expirado'));
    }

    const scopes = (row.scopes ?? []) as string[];
    await this.registerUsage(row.tokenId);
    return {
      tokenId: row.tokenId,
      serviceAccountId: row.serviceAccountId,
      productId: row.productId,
      slug: row.productSlug,
      name: row.productName,
      agentName: row.agentName,
      scopes,
    };
  }

  private async registerUsage(tokenId: string): Promise<void> {
    const now = Date.now();
    const bucket = this.buckets.get(tokenId);
    if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
      this.buckets.set(tokenId, { count: 1, windowStart: now });
    } else {
      bucket.count += 1;
    }
    // last_used_at best-effort (no rompe el request si falla).
    try {
      await this.db
        .update(apiTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiTokens.id, tokenId));
    } catch (error) {
      this.logger.warn(`last_used_at no actualizado para token ${tokenId}: ${String(error)}`);
    }
  }

  assertRateLimit(tokenId: string): void {
    const now = Date.now();
    const bucket = this.buckets.get(tokenId);
    if (!bucket) return;
    if (now - bucket.windowStart >= RATE_WINDOW_MS) return;
    if (bucket.count > RATE_LIMIT_READ) {
      throw new ProblemException(
        Problems.conflict(
          `Rate-limit de integración superado (${RATE_LIMIT_READ} req/min por token)`,
          'integration.rate_limited',
        ),
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
    );
  }
}
