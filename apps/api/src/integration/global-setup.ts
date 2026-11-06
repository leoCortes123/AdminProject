/**
 * Setup global de integración: crea una BD efímera `devcycle_test` desde cero
 * (drop/create), aplica las migraciones y siembra catálogos+demo (idempotente).
 * Corre ANTES que cualquier test (vitest globalSetup). `cwd` = apps/api.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import postgres from 'postgres';

const ADMIN_URL = 'postgres://devcycle:devcycle@localhost:5432/devcycle';
const TEST_URL = 'postgres://devcycle:devcycle@localhost:5432/devcycle_test';
const REPO_ROOT = join(process.cwd(), '../..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'packages/db/migrations');

export default async function globalSetup(): Promise<void> {
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  await admin`DROP DATABASE IF EXISTS devcycle_test WITH (FORCE)`;
  await admin`CREATE DATABASE devcycle_test`;
  await admin.end();

  const db = postgres(TEST_URL, { max: 1, onnotice: () => {} });
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.up.sql'))
    .sort();
  for (const file of files) {
    const body = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    await db.unsafe(body, [], { prepare: false });
  }
  await db.end();

  // Semilla de catálogos + demo (misma semilla que producción).
  execFileSync('pnpm', ['--filter', '@devcycle/db', 'exec', 'tsx', 'src/seed.ts', '--demo'], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'inherit',
  });
}
