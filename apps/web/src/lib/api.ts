/**
 * Acceso server-side a la API (RSC). El navegador nunca habla con :3001
 * directamente: usa el proxy de Next (`/api/*` → API) vía `auth-client` o fetch
 * client-side; aquí reenviamos la cookie de sesión (auth de verdad en la API).
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { MeResponse } from './types';

export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    readonly status: number | null,
    readonly detail: string,
  ) {
    super(`API respondió ${status ?? 'sin respuesta'}: ${detail.slice(0, 200)}`);
    this.name = 'ApiError';
  }
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const hdrs = new Headers();
  const cookie = (await headers()).get('cookie');
  if (cookie) hdrs.set('cookie', cookie);
  if (options.body !== undefined) hdrs.set('content-type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${API_INTERNAL_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: hdrs,
      body: options.body !== undefined ? JSON.stringify(options.body) : null,
      cache: 'no-store',
    });
  } catch (error) {
    throw new ApiError(null, error instanceof Error ? error.message : String(error));
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiError(response.status, detail || response.statusText);
  }
  return (await response.json()) as T;
}

/** Usuario autenticado o redirección a /login. Usar en layouts/pages protegidos. */
export async function requireMe(): Promise<MeResponse> {
  try {
    return await apiFetch<MeResponse>('/api/v1/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect('/login');
    }
    throw error;
  }
}

/** Variante no-lanzadora: devuelve null si la API no responde (p. ej. /health en build). */
export async function tryApi<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path);
  } catch {
    return null;
  }
}
