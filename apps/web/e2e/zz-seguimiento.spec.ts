/**
 * F5-E2E · Camino dorado de Fase 5 (plan 07 §6 · F5-T04): vista Seguimiento
 * con datos reales del seed demo (avance, bloqueadas, cobertura, actividad).
 *
 * Prefijo `zz-` deliberado (ver z-trazabilidad.spec.ts): corre la última
 * (después de golden.spec.ts y del resto de `z-*`) y reutiliza su usuario
 * admin con login idempotente + retry por rate-limit compartido.
 */
import { test, expect, request } from '@playwright/test';
import { WEB_URL } from './env';

const ADMIN_EMAIL = 'e2e-admin@devcycle.dev';
const ADMIN_PASSWORD = 'e2e-password-123';

test('Seguimiento: avance, bloqueadas, cobertura y actividad visibles', async ({ page }) => {
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
    await page.waitForTimeout(2500);
  }
  expect(sessionOk, 'sesión E2E: registro o login').toBe(true);
  const cookies = await api.storageState();
  await page.context().addCookies(cookies.cookies);
  await api.dispose();

  await page.goto('/products/kanora/seguimiento');
  await expect(page.getByRole('heading', { name: 'Seguimiento', level: 1 })).toBeVisible();
  await expect(page.getByText('Avance del producto', { exact: true })).toBeVisible();
  await expect(page.getByText(/Elementos sin documentación/).first()).toBeVisible();
  await expect(page.getByText(/Funcionalidades sin pruebas/).first()).toBeVisible();
  await expect(page.getByText('Tareas bloqueadas', { exact: true })).toBeVisible();
  await expect(page.getByText('Actividad reciente')).toBeVisible();
  // Datos demo de kanora: TAR-240 bloqueada e INC-087 abierta.
  await expect(page.getByText('TAR-240').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/INC-087/).first()).toBeVisible({ timeout: 10_000 });
  // Enlaces profundos a las vistas de origen.
  await expect(page.getByRole('link', { name: /Ver en árbol/ }).first()).toBeVisible();
});
