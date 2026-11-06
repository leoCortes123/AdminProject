import { createDb, type Database } from '@devcycle/db';
import { getEnv } from './config/env';

/** Token de inyección del cliente Drizzle compartido. */
export const DB = Symbol('DB');

export type { Database };

let instance: Database | undefined;

/**
 * Cliente Drizzle singleton (pool de postgres.js). Lo usan tanto el módulo
 * `DatabaseModule` (vía DI) como la instancia de better-auth, de modo que
 * toda la API comparte un único pool.
 */
export function getDb(): Database {
  if (!instance) {
    instance = createDb(getEnv().DATABASE_URL, 10);
  }
  return instance;
}
