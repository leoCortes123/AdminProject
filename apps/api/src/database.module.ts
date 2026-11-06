import { Global, Module } from '@nestjs/common';
import { DB, getDb } from './database';

/** Módulo global que expone el cliente Drizzle compartido (token `DB`). */
@Global()
@Module({
  providers: [{ provide: DB, useFactory: getDb }],
  exports: [DB],
})
export class DatabaseModule {}
