/**
 * Entorno compartido de los tests E2E — BD efímera `devcycle_e2e`.
 * Todo sobreescribible por entorno; por defecto coincide con el PG de docker compose.
 */
import { join } from 'node:path';

export const E2E_DB_NAME = 'devcycle_e2e';
export const E2E_ADMIN_URL =
  process.env.E2E_ADMIN_URL ?? 'postgres://devcycle:devcycle@localhost:5432/devcycle';
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? `postgres://devcycle:devcycle@localhost:5432/${E2E_DB_NAME}`;

export const REPO_ROOT = join(__dirname, '..', '..', '..');
export const WEB_PORT = 3100;
export const API_PORT = 3101;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const API_URL = `http://localhost:${API_PORT}`;
