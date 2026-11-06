import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = ReturnType<typeof createDb>;

/** Crea el cliente Drizzle sobre postgres.js. `max` conexiones configurable. */
export function createDb(connectionString: string, max = 10) {
  const client = postgres(connectionString, { max });
  return drizzle(client, { schema });
}

export { schema };
