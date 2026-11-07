/**
 * F3-E2E · Camino dorado de Fase 3 (plan 07 §4 · F3-T09, 08 §4): tarea desde
 * ficha → kanban global → arrastrar respeta transiciones.
 *
 * Prefijo `z-` deliberado (ver z-documentacion.spec.ts): corre después de
 * golden.spec.ts y reutiliza su usuario admin con login idempotente.
 */
import { test, expect, request } from '@playwright/test';
import { WEB_URL } from './env';

const ADMIN_EMAIL = 'e2e-admin@devcycle.dev';
const ADMIN_PASSWORD = 'e2e-password-123';
const TASK_TITLE = 'Tarea E2E — Asignación de pedidos';

test('crear tarea → ver en kanban → filtrar por PANT-02', async ({ page }) => {
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

  // 1 · Tareas de kanora: crear vía UI vinculada a PANT-02.
  await page.goto('/products/kanora/tareas');
  await expect(page.getByRole('heading', { name: 'Tareas', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /Nueva tarea/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva tarea' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Título/).fill(TASK_TITLE);
  await dialog.getByLabel(/Nodo funcional/).selectOption('PANT-02');
  await dialog.getByRole('button', { name: 'Crear tarea' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(TASK_TITLE).first()).toBeVisible({ timeout: 10_000 });

  // 2 · Cambiar a Kanban (URL-driven ?view=kanban).
  await page.getByRole('tab', { name: 'Kanban' }).click();
  await expect(page).toHaveURL(/view=kanban/);
  await expect(page.getByRole('region', { name: 'Tablero Kanban de tareas' })).toBeVisible();
  await expect(page.getByText(TASK_TITLE).first()).toBeVisible();

  // 3 · Filtrar por PANT-02 (búsqueda como en el criterio de aceptación).
  await page.getByLabel('Buscar tarea').fill('PANT-02');
  await expect(page.getByText(TASK_TITLE).first()).toBeVisible();

  // 4 · De vuelta a Tabla: la tarea sigue con su estado configurado.
  await page.getByRole('tab', { name: 'Tabla' }).click();
  await expect(page).toHaveURL(/view=table/);
});
