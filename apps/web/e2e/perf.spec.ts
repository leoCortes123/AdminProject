/**
 * FND-PERF · Presupuesto de rendimiento de Fase 1 (plan 07 §2 · F1-T08,
 * estrategia 08 §7): "time-to-interactive < 1.5 s en Productos".
 *
 * Criterio operativo (documentado aquí porque "TTI" no es medible de forma
 * fiable fuera de un navegador con instrumentación): en la vista Productos,
 * servida por `next start` sobre el build de producción, el contenido real
 * (heading "Productos" + las filas del seed) es visible en < 1.500 ms desde el
 * inicio de la navegación. Se mide con `performance.timing.domContentLoadedEventEnd`
 * y, como control, con un `expect(...).toBeVisible({ timeout })` real.
 *
 * Antes de esta prueba se crea el primer usuario vía API (admin_global), de modo
 * que el orden respecto a golden.spec.ts es indiferente. La BD `devcycle_e2e` la
 * recrea global-setup una vez por invocación.
 */
import { test, expect, request } from '@playwright/test';
import { WEB_URL } from './env';

const BUDGET_MS = 1_500;
const ADMIN_EMAIL = 'e2e-admin@devcycle.dev';
const ADMIN_PASSWORD = 'e2e-password-123';

test('Productos · contenido visible en < 1.5 s (build de producción)', async ({ page }) => {
  // 1 · Sesión admin (idempotente: si golden ya registró, se inicia sesión).
  const api = await request.newContext({ baseURL: WEB_URL });
  const signup = await api.post('/api/auth/sign-up/email', {
    data: { name: 'Admin E2E', email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (signup.status() !== 200) {
    const login = await api.post('/api/auth/sign-in/email', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(login.status(), 'sesión E2E: registro o login').toBe(200);
  }
  const cookies = await api.storageState();
  await page.context().addCookies(cookies.cookies);

  // 2 · Navegación instrumentada a /products.
  await page.goto('/products', { waitUntil: 'commit' });
  await expect(page.getByRole('heading', { name: 'Productos', level: 1 })).toBeVisible({
    timeout: BUDGET_MS,
  });
  await expect(page.getByText('Kanora', { exact: true })).toBeVisible({ timeout: BUDGET_MS });

  const dcl = await page.evaluate(
    () => performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
  );

  // 3 · El presupuesto se cumple (DOM listo con datos reales < 1.5 s).
  expect(dcl).toBeGreaterThan(0);
  expect(dcl, `DOMContentLoaded de /products: ${dcl} ms`).toBeLessThan(BUDGET_MS);
  test.info().annotations.push({ type: 'perf', description: `TTI-ish /products: ${dcl} ms` });
  console.log(`[perf] /products · domContentLoaded ≈ ${dcl} ms (presupuesto ${BUDGET_MS} ms)`);
  await api.dispose();
});
