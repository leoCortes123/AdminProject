/**
 * FND-E2E · Camino dorado de Fase 1.
 *
 * registro (primer usuario → admin_global) → Productos visibles →
 * crear producto desde la UI → nodo creado vía API → nodo visible en el árbol →
 * árbol seed real (kanora · MODULO-01) → logout.
 *
 * La BD `devcycle_e2e` es efímera y la recrea global-setup antes de la suite.
 */
import { test, expect, request } from '@playwright/test';
import { WEB_URL } from './env';

const PRODUCT_NAME = 'E2E Golden';
const PRODUCT_SLUG = 'e2e-golden';
const ADMIN_EMAIL = 'e2e-admin@devcycle.dev';
const ADMIN_PASSWORD = 'e2e-password-123';

test('registro → productos → crear producto → nodo en árbol', async ({ page, context }) => {
  // 1 · Registro: primer usuario de una BD vacía recibe admin_global.
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Crear cuenta' }).click();
  await page.getByLabel(/Nombre completo/).fill('Admin E2E');
  await page.getByLabel(/^Email/).fill(ADMIN_EMAIL);
  await page.getByLabel(/Contraseña/).fill(ADMIN_PASSWORD);
  await page.locator('.login-submit').click();

  // 2 · Aterriza en /products con los 3 productos del seed visibles.
  await page.waitForURL('**/products');
  await expect(page.getByRole('heading', { name: 'Productos', level: 1 })).toBeVisible();
  await expect(page.getByText('Kanora', { exact: true })).toBeVisible();
  await expect(page.getByText('Verdana', { exact: true })).toBeVisible();
  await expect(page.getByText('Núcleo', { exact: true })).toBeVisible();

  // 3 · Crear producto desde la UI (modal solo admin_global).
  await page.getByRole('button', { name: /Nuevo producto/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo producto' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nombre').fill(PRODUCT_NAME);
  await dialog.getByLabel('Slug').fill(PRODUCT_SLUG);
  await dialog.getByLabel(/Stack/).fill('Next.js, PostgreSQL');
  await dialog.getByRole('button', { name: 'Crear producto' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(PRODUCT_NAME, { exact: true })).toBeVisible();

  // 4 · Entrar al producto → Resumen → Arquitectura funcional (árbol vacío honesto).
  await page.getByText(PRODUCT_NAME, { exact: true }).click();
  await page.waitForURL(`**/products/${PRODUCT_SLUG}/resumen`);
  await page.getByRole('link', { name: /Arquitectura funcional/ }).click();
  await page.waitForURL(`**/products/${PRODUCT_SLUG}/arbol`);
  await expect(page.getByText('Árbol vacío')).toBeVisible();

  // 5 · Crear un módulo vía API (la UI de Fase 1 es read-only) con la cookie de la sesión.
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const api = await request.newContext({
    baseURL: WEB_URL,
    extraHTTPHeaders: { cookie: cookieHeader },
  });
  const created = await api.post(`/api/v1/products/${PRODUCT_SLUG}/nodes`, {
    data: { parentId: null, nodeTypeKey: 'modulo', code: 'E2E-01', name: 'Módulo dorado E2E' },
  });
  expect(created.status()).toBe(201);

  // 6 · Recargar el árbol → el nodo aparece.
  await page.reload();
  await expect(page.getByText('E2E-01')).toBeVisible();

  // 7 · El seed real de kanora renderiza su árbol (dato real, no mocks).
  await page.goto('/products/kanora/arbol');
  await expect(page.getByText('MODULO-01')).toBeVisible();

  // 8 · Logout → /login.
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.waitForURL('**/login**');
  await expect(page.getByRole('tab', { name: 'Iniciar sesión' })).toBeVisible();
});
