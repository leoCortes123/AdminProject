import { createHash, randomBytes } from 'node:crypto';

/** Genera un token en claro `dvc_<43chars>` (32 bytes base64url). Solo se muestra una vez. */
export function generateApiToken(): string {
  const secret = randomBytes(32).toString('base64url');
  return `dvc_${secret}`;
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Prefijo legible para UI (nunca secreto): `dvc_XXXX` con 4 caracteres del hash. */
export function tokenPrefixOf(hash: string): string {
  return `dvc_${hash.slice(0, 4)}`;
}

/**
 * Redacción defensiva de argumentos para auditoría (F6a-T03): nunca guardar
 * tokens ni bodies completos. Solo resúmenes cortos y claves inocuas.
 */
const SENSITIVE_KEYS = new Set([
  'token',
  'authorization',
  'secret',
  'password',
  'body',
  'bodymarkdown',
  'body_markdown',
  'apikey',
  'api_key',
]);

export function redactArgs(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 200) {
      out[key] = `${value.slice(0, 200)}…(truncado ${value.length} chars)`;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      out[key] = redactArgs(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function summarizeArgs(input: Record<string, unknown>): string {
  const redacted = redactArgs(input);
  return Object.entries(redacted)
    .slice(0, 12)
    .map(([k, v]) => {
      if (v === null || v === undefined) return `${k}=`;
      if (Array.isArray(v)) return `${k}=[${v.length}]`;
      const s = String(v);
      return `${k}=${s.length > 80 ? `${s.slice(0, 80)}…` : s}`;
    })
    .join(' ');
}
