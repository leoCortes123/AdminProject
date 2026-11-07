/**
 * F4-E2E · Camino dorado de Fase 4 (plan 07 §5 · F4-T06, 08 §4): cambio
 * ejecutado con INC resuelta → Q1 «¿qué tareas afectan esta pantalla?» + grafo.
 *
 * Prefijo `z-` deliberado (ver z-documentacion.spec.ts): corre después de
 * golden.spec.ts y reutiliza su usuario admin con login idempotente.
 */
import { test, expect, request } from '@playwright/test';
import { WEB_URL } from './env';

const ADMIN_EMAIL = 'e2e-admin@devcycle.dev';
const ADMIN_PASSWORD = 'e2e-password-123';
const MOD_TITLE = 'MOD E2E — Límite de reasignación (RN-014)';

test('proponer MOD → ver en tabla → ejecutar Q1 y grafo', async ({ page }) => {
  const api = await request.newContext({ baseURL: WEB_URL });
  // better-auth limita los intentos de auth (429 con bucket compartido sin IP
  // tras varias specs): reintentamos con backoff en vez de fallar de inmediato.
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
    // 429 / 5xx por rate-limit compartido → espera y reintenta.
    await page.waitForTimeout(2500);
  }
  expect(sessionOk, 'sesión E2E: registro o login').toBe(true);
  const cookies = await api.storageState();
  await page.context().addCookies(cookies.cookies);
  await api.dispose();

  // 1 · Modificaciones de kanora: proponer vía UI vinculada a PANT-02.
  await page.goto('/products/kanora/modificaciones');
  await expect(page.getByRole('heading', { name: 'Modificaciones', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /Registrar modificación/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar modificación' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Título/).fill(MOD_TITLE);
  await dialog.getByLabel(/Nodo afectado/).selectOption('PANT-02');
  await dialog.getByRole('button', { name: 'Proponer' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(MOD_TITLE).first()).toBeVisible({ timeout: 10_000 });

  // 2 · Trazabilidad: ejecutar Q1 «¿qué tareas afectan esta pantalla?».
  await page.goto('/products/kanora/trazabilidad');
  await expect(page.getByRole('heading', { name: 'Trazabilidad', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /¿Qué tareas afectan esta pantalla/ }).click();
  await page.getByRole('button', { name: /Ejecutar consulta/ }).click();
  // El demo ya trae TAR-231/TAR-232 vinculadas a PANT-02 (seed demo kanora).
  await expect(page.getByText(/TAR-231/).first()).toBeVisible({ timeout: 10_000 });

  // 3 · El grafo de PANT-02 se dibuja (SVG con centro PANT-02).
  await expect(page.getByRole('img', { name: /Grafo de relaciones/ })).toBeVisible();
});
