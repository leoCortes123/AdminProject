'use client';

import { createAuthClient } from 'better-auth/react';

/**
 * Cliente de better-auth del navegador. Habla con el mismo origen;
 * Next proxia /api/auth/* → API (cookies first-party).
 * En SSR/prerender se usa el origen por defecto (nunca se invoca allí).
 */
const baseURL =
  typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth`
    : 'http://localhost:3000/api/auth';

export const authClient = createAuthClient({ baseURL });
