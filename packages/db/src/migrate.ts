/**
 * Runner de migraciones DevCycle.
 *
 * Uso:
 *   tsx src/migrate.ts up        — aplica migraciones pendientes
 *   tsx src/migrate.ts down      — revierte la última migración
 *   tsx src/migrate.ts down --all — revierte todo (¡destructivo!)
 *   tsx src/migrate.ts status    — lista aplicadas/pendientes
 *
 * Cada migración `NNNN_nombre.up.sql` tiene su `.down.sql` espejo.
 * Se aplica en una transacción y se registra en `schema_migrations`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://devcycle:devcycle@localhost:5432/devcycle';

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
}

function migrationNames(kind: 'up' | 'down'): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(`.${kind}.sql`))
    .map((f) => f.replace(`.${kind}.sql`, ''))
    .sort();
}

async function applied(): Promise<Set<string>> {
  const rows = await sql<{ name: string }[]>`SELECT name FROM schema_migrations`;
  return new Set(rows.map((r) => r.name));
}

async function up() {
  await ensureTable();
  const done = await applied();
  const pending = migrationNames('up').filter((n) => !done.has(n));
  if (pending.length === 0) {
    console.info('Sin migraciones pendientes.');
    return;
  }
  for (const name of pending) {
    const body = readFileSync(join(MIGRATIONS_DIR, `${name}.up.sql`), 'utf8');
    console.info(`→ aplicando ${name}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body, [], { prepare: false });
      await tx`INSERT INTO schema_migrations (name) VALUES (${name})`;
    });
  }
  console.info(`OK: ${pending.length} migración(es) aplicada(s).`);
}

async function down(all: boolean) {
  await ensureTable();
  const done = await applied();
  const appliedList = migrationNames('down')
    .filter((n) => done.has(n))
    .reverse();
  const toRevert = all ? appliedList : appliedList.slice(0, 1);
  if (toRevert.length === 0) {
    console.info('Nada que revertir.');
    return;
  }
  for (const name of toRevert) {
    const body = readFileSync(join(MIGRATIONS_DIR, `${name}.down.sql`), 'utf8');
    console.info(`→ revirtiendo ${name}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body, [], { prepare: false });
      await tx`DELETE FROM schema_migrations WHERE name = ${name}`;
    });
  }
  console.info(`OK: ${toRevert.length} migración(es) revertida(s).`);
}

async function status() {
  await ensureTable();
  const done = await applied();
  for (const name of migrationNames('up')) {
    console.info(`${done.has(name) ? '[x]' : '[ ]'} ${name}`);
  }
}

async function main() {
  const cmd = process.argv[2];
  const all = process.argv.includes('--all');
  try {
    if (cmd === 'up') await up();
    else if (cmd === 'down') await down(all);
    else if (cmd === 'status') await status();
    else {
      console.error('Uso: migrate.ts up|down [--all]|status');
      process.exitCode = 1;
    }
  } finally {
    await sql.end();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
