import { Inject, Injectable, Logger } from '@nestjs/common';
import { activityLog } from '@devcycle/db';
import { DB, type Database } from '../database';

/** Ejecutor de queries: el pool global o una transacción abierta. */
export type DbExecutor = Pick<Database, 'insert' | 'select' | 'update' | 'delete' | 'execute'>;

export interface ActivityInput {
  productId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityKind?: string | null;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Emisor de `activity_log` (append-only, incluso para Administrador global).
 * Los errores de auditoría se loguean pero nunca rompen la operación de negocio,
 * salvo que se emita dentro de una transacción (en cuyo caso aborta con ella).
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  async emit(input: ActivityInput, tx?: DbExecutor): Promise<void> {
    const target = tx ?? this.db;
    try {
      await target.insert(activityLog).values({
        productId: input.productId ?? null,
        actorType: input.actorUserId ? 'human' : 'system',
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityKind: input.entityKind ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: input.metadata ?? {},
        ip: input.ip ?? null,
      });
    } catch (error) {
      // Dentro de una transacción el error debe propagar para no perder auditoría.
      if (tx) throw error;
      this.logger.error(`activity_log emit falló: ${String(error)} (action=${input.action})`);
    }
  }
}
