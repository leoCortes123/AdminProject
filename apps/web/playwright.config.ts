import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { API_PORT, API_URL, E2E_DATABASE_URL, REPO_ROOT, WEB_PORT, WEB_URL } from './e2e/env';

/**
 * E2E de Fase 1 (FND-E2E).
 *
 * Requiere el build previo del workspace con la API destino horneada:
 *   API_INTERNAL_URL=http://localhost:3101 pnpm --filter @devcycle/web build
 *   (las rewrites de Next se hornean en `next build`, no en `next start`).
 * Además, el servidor web del E2E recibe API_INTERNAL_URL en runtime —
 * los Server Components leen esa variable por petición (no horneada).
 *
 * La BD `devcycle_e2e` se recrea sola en globalSetup (drop/create + migrar +
 * seed demo · 0 usuarios). API en :3101, web en :3100 (la demo usa 3000/3001).
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  // La spec dorada no es idempotente (el PRIMER usuario recibe admin_global y
  // la BD solo se recrea en globalSetup, una vez por invocación) → sin retries.
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `node ${join(REPO_ROOT, 'apps/api/dist/main.js')}`,
      url: `${API_URL}/api/v1/health`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'production',
        PORT: String(API_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        BETTER_AUTH_SECRET: 'e2e-9f3a7c1b5d8e4f60718293a4b5c6d7e8f9012345678',
        BETTER_AUTH_URL: API_URL,
        WEB_URL,
      },
    },
    {
      command: `npx next start -p ${WEB_PORT}`,
      cwd: join(REPO_ROOT, 'apps/web'),
      url: `${WEB_URL}/login`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        // RSC (lib/api.ts) lee API_INTERNAL_URL por petición — sin esto, las
        // fetches SSR van a :3001 (demo) y la sesión E2E recibe 401 → /login.
        API_INTERNAL_URL: API_URL,
      },
    },
  ],
});
