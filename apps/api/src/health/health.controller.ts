import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { PROBLEM_TYPE_BASE } from '@devcycle/shared';
import { Public } from '../common/public.decorator';
import { ProblemException } from '../common/problem.exception';
import { DB, type Database } from '../database';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Healthcheck liveness/readiness (incluye `SELECT 1` a Postgres)' })
  async health() {
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new ProblemException({
        type: `${PROBLEM_TYPE_BASE}unavailable`,
        title: 'Base de datos no disponible',
        status: 503,
        code: 'db.unavailable',
      });
    }
    return { status: 'ok', db: 'up' };
  }
}
