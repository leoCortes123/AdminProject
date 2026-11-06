import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET debe tener al menos 32 caracteres'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3001'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

/** Validación usada por @nestjs/config: `ConfigModule.forRoot({ validate })`. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const summary = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración de entorno inválida — ${summary}`);
  }
  return result.data;
}

let cached: Env | undefined;

/**
 * Acceso fuera de DI (p. ej. la instancia de better-auth, que se crea en el
 * módulo). Memoizado; falla rápido con mensaje claro si falta configuración.
 */
export function getEnv(): Env {
  if (!cached) {
    cached = validateEnv(process.env as Record<string, unknown>);
  }
  return cached;
}
