/**
 * F2-E2E · Camino dorado de Fase 2 (plan 07 §3 · F2-T09, 08 §4).
 *
 * Sesión admin idempotente → Documentación de kanora → crear doc vinculado
 * a PANT-02 vía UI → publicar (diálogo de nota) → aparece "Vigente" →
 * el doc es visible en la pestaña Documentación de la ficha de PANT-02.
 *
 * El prefijo `z-` es deliberado: la BD e2e es compartida por toda la
 * invocación y el PRIMER usuario recibe admin_global (lo crea golden.spec.ts
 * vía UI). Esta spec corre después (g < p < z) y reutiliza ese usuario con
 * login idempotente. Nunca renombrar a algo que ordene antes que golden.
 */
import { test, expect, request } from '@playwright/test';
import { WEB_URL } from './env';

const ADMIN_EMAIL = 'e2e-admin@devcycle.dev';
const ADMIN_PASSWORD = 'e2e-password-123';
const DOC_TITLE = 'Especificación E2E — Ficha de producto';

test('crear → publicar documento → visible en ficha del nodo', async ({ page }) => {
  // 1 · Sesión admin (idempotente respecto a golden.spec.ts).
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
  await api.dispose();

  // 2 · Documentación de kanora: crear vía UI vinculado a PANT-02.
  await page.goto('/products/kanora/documentacion');
  await expect(page.getByRole('heading', { name: 'Documentación', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /Nuevo documento/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo documento' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Título/).fill(DOC_TITLE);
  await dialog.getByLabel(/Código/).fill('DOC-901');
  await dialog.getByLabel(/Nodo inicial/).selectOption('PANT-02');
  await dialog.getByLabel(/Contenido/).fill('# Ficha de producto\n\nEspecificación E2E.');
  await dialog.getByRole('button', { name: 'Crear documento' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(DOC_TITLE, { exact: true }).first()).toBeVisible();

  // 3 · Publicar (la nota va en un window.prompt nativo).
  page.once('dialog', (d) => void d.accept('Publicación E2E'));
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.locator('.doc-item', { hasText: DOC_TITLE }).first()).toContainText('Vigente', {
    timeout: 10_000,
  });

  // 4 · La ficha de PANT-02 muestra el documento en su pestaña.
  await page.goto('/products/kanora/arbol?node=PANT-02');
  await page.getByRole('tab', { name: /Documentación/ }).click();
  await expect(page.getByText(DOC_TITLE, { exact: true }).first()).toBeVisible();
});
