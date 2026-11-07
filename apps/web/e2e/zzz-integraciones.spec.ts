/**
 * F6a-E2E · Camino dorado de Fase 6a (plan 07 §7 · F6a-T01…T03): vista
 * Integraciones con cuentas/tokens y auditoría, más una llamada real
 * `/integration/*` con el token creado en la UI.
 *
 * Prefijo `zzz-` deliberado (ver z-trazabilidad.spec.ts): corre la última
 * (después de golden.spec.ts y de `zz-seguimiento`) y reutiliza su usuario
 * admin con login idempotente + retry por rate-limit compartido.
 */
import { test, expect, request } from '@playwright/test';
import { WEB_URL } from './env';

const ADMIN_EMAIL = 'e2e-admin@devcycle.dev';
const ADMIN_PASSWORD = 'e2e-password-123';

test('Integraciones: crear cuenta, token read-only y auditoría', async ({ page }) => {
  const api = await request.newContext({ baseURL: WEB_URL });
  let sessionOk = false;
  for (let attempt = 0; attempt < 6 && !sessionOk; attempt++) {
    const signup = await api.post('/api/auth/sign-up/email', {
      data: { name: 'Admin E2E', email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (signup.status() === 200) {
      sessionOk = true;
      break;
    }
    const login = await api.post('/api/auth/sign-in/email', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (login.status() === 200) {
      sessionOk = true;
      break;
    }
    await page.waitForTimeout(2500);
  }
  expect(sessionOk, 'sesión E2E: registro o login').toBe(true);
  const cookies = await api.storageState();
  await page.context().addCookies(cookies.cookies);

  await page.goto('/products/kanora/integraciones');
  await expect(
    page.getByRole('heading', { name: 'Integraciones y agentes', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Cuentas de servicio y tokens')).toBeVisible();
  await expect(page.getByText('Auditoría de agentes')).toBeVisible();

  const name = `e2e-agent-${Date.now().toString(36)}`;
  await page.getByPlaceholder('claude-code').first().fill(name);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  // La cuenta aparece en el selector.
  await expect(page.locator(`option:has-text("${name}")`)).toBeAttached({ timeout: 10_000 });

  await page.getByRole('button', { name: /Crear token read-only/ }).click();
  // El token en claro se muestra una sola vez.
  await expect(page.getByText(/Copia este token ahora/)).toBeVisible({ timeout: 10_000 });
  const code = page.locator('code', { hasText: /^dvc_[A-Za-z0-9_-]{20,}$/ }).first();
  await expect(code).toBeVisible({ timeout: 10_000 });
  const token = (await code.textContent())?.trim() ?? '';
  expect(token.startsWith('dvc_')).toBe(true);

  // Llamada real con el token creado en la UI.
  const anon = await request.newContext({ baseURL: WEB_URL });
  const context = await anon.get('/api/v1/integration/products/kanora/nodes/PANT-02/context', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(context.status()).toBe(200);
  const body = await context.json();
  expect(body.target.code).toBe('PANT-02');

  // La ejecución de agente queda auditada y visible en la UI.
  await page.reload();
  await expect(page.getByText('Auditoría de agentes')).toBeVisible();
  await expect(page.getByText('get_product_context').first()).toBeVisible({ timeout: 15_000 });
  await api.dispose();
  await anon.dispose();
});
