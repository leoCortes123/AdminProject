import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { agentExecutions } from '@devcycle/db';
import { ActivityService, type DbExecutor } from '../common/activity.service';
import { DB, type Database } from '../database';
import { Problems } from '@devcycle/shared';
import { redactArgs, summarizeArgs } from './integration-tokens';

export interface AuditInput {
  productId: string;
  serviceAccountId: string;
  agentName: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'ok' | 'error' | 'confirmation_required' | 'rejected';
  durationMs: number;
  ip?: string | null;
  resultSummary?: string;
}

/**
 * Auditoría de integraciones (F6a-T03): cada llamada `/integration/*` deja
 * fila en `agent_executions` (args redactados) + `activity_log` con
 * `actor_type='agent'`. Los fallos de auditoría se loguean pero no rompen la
 * respuesta (la operación ya se validó y ejecutó).
 */
@Injectable()
export class AgentAuditService {
  private readonly logger = new Logger(AgentAuditService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly activity: ActivityService,
  ) {}

  async record(input: AuditInput): Promise<void> {
    const redacted = redactArgs(input.args);
    const summary = summarizeArgs(input.args);
    try {
      await this.db.insert(agentExecutions).values({
        productId: input.productId,
        serviceAccountId: input.serviceAccountId,
        agentName: input.agentName,
        toolName: input.toolName,
        requestSummary: summary.slice(0, 2000),
        requestArgs: redacted,
        resultSummary: (input.resultSummary ?? '').slice(0, 1000),
        status: input.status,
        durationMs: Math.max(0, Math.round(input.durationMs)),
        ip: input.ip ?? null,
      });
      await this.activity.emit({
        productId: input.productId,
        actorServiceAccountId: input.serviceAccountId,
        action: `integration.${input.toolName}`,
        entityKind: null,
        entityId: null,
        summary: `${input.agentName} · ${input.toolName} (${input.status}) ${summary}`.slice(
          0,
          1000,
        ),
        metadata: { tool: input.toolName, status: input.status, args: redacted },
        ip: input.ip ?? null,
      });
    } catch (error) {
      this.logger.error(`agent_executions audit falló: ${String(error)} (tool=${input.toolName})`);
    }
  }

  async listForAdmin(
    productId: string,
    limit = 50,
  ): Promise<
    Array<{
      id: string;
      serviceAccountId: string | null;
      agentName: string | null;
      toolName: string | null;
      requestSummary: string;
      status: string;
      durationMs: number | null;
      createdAt: Date;
    }>
  > {
    const rows = await this.db
      .select({
        id: agentExecutions.id,
        serviceAccountId: agentExecutions.serviceAccountId,
        agentName: agentExecutions.agentName,
        toolName: agentExecutions.toolName,
        requestSummary: agentExecutions.requestSummary,
        status: agentExecutions.status,
        durationMs: agentExecutions.durationMs,
        createdAt: agentExecutions.createdAt,
      })
      .from(agentExecutions)
      .where(eq(agentExecutions.productId, productId))
      .orderBy(desc(agentExecutions.createdAt))
      .limit(Math.min(limit, 100));
    return rows;
  }

  /** Compat: redirección hacia la emisión con tx si se necesita en el futuro. */
  static async emitWithTx(
    tx: DbExecutor,
    activity: ActivityService,
    input: AuditInput,
  ): Promise<void> {
    await activity.emit(
      {
        productId: input.productId,
        actorServiceAccountId: input.serviceAccountId,
        action: `integration.${input.toolName}`,
        summary: `${input.agentName} · ${input.toolName} (${input.status})`,
        metadata: { tool: input.toolName, status: input.status },
        ip: input.ip ?? null,
      },
      tx,
    );
    void Problems;
  }
}
