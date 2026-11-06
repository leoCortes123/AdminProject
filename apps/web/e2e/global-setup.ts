/**
 * Playwright globalSetup — recrea la BD efímera `devcycle_e2e` desde cero:
 * drop/create → migraciones → seed demo (0 usuarios ⇒ el primero recibe admin_global).
 * Espejo de apps/api/src/integration/global-setup.ts, vía scripts del paquete db.
 */
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';
import { E2E_ADMIN_URL, E2E_DATABASE_URL, E2E_DB_NAME, REPO_ROOT } from './env';

export default async function globalSetup(): Promise<void> {
  console.log('[e2e] global-setup: recreando', E2E_DATABASE_URL);
  const dbName = (() => {
    try {
      return new URL(E2E_DATABASE_URL).pathname.replace(/^\//, '') || E2E_DB_NAME;
    } catch {
      return E2E_DB_NAME;
    }
  })();

  const admin = postgres(E2E_ADMIN_URL, { max: 1, onnotice: () => {} });
  // Nombre validado: identificador SQL simple, nunca interpolado crudo desde fuera.
  if (!/^[a-z_][a-z0-9_]*$/.test(dbName)) {
    throw new Error(`Nombre de BD E2E inválido: ${dbName}`);
  }
  await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };
  execFileSync('pnpm', ['--filter', '@devcycle/db', 'migrate', 'up'], {
    cwd: REPO_ROOT,
    env,
    stdio: 'inherit',
  });
  execFileSync('pnpm', ['--filter', '@devcycle/db', 'exec', 'tsx', 'src/seed.ts', '--demo'], {
    cwd: REPO_ROOT,
    env,
    stdio: 'inherit',
  });
}
