/**
 * Utilidades puras del árbol funcional (ltree). Sin I/O: candidatas a tests
 * unitarios (FND-U). La semántica reproduce los operadores ltree de PostgreSQL.
 */

/** ltree label estable a partir del código: minúsculas, `-` → `_`. */
export const ltreeLabel = (code: string): string => code.toLowerCase().replace(/-/g, '_');

/** `path` es descendiente-o-igual de `ancestor` (equivale a `path <@ ancestor`). */
export function pathIsDescendantOrEqual(ancestor: string, path: string): boolean {
  return path === ancestor || path.startsWith(`${ancestor}.`);
}

/** Profundidad (0-based) de un path ltree. */
export function pathDepth(path: string): number {
  return path.split('.').length - 1;
}

const CODE_PATTERN = /^([A-Z][A-Z0-9_]{0,15})-([0-9]{1,6})$/;

/** Separa un código `PREFIJO-123` en sus partes; null si no cumple el formato. */
export function parseNodeCode(code: string): { prefix: string; num: number } | null {
  const match = CODE_PATTERN.exec(code);
  if (!match) return null;
  return { prefix: match[1] as string, num: Number.parseInt(match[2] as string, 10) };
}

/**
 * Asigna códigos frescos a cada nodo de un subárbol copiado, manteniendo el
 * prefijo y numerando desde `max(códigos existentes en el producto) + 1` por
 * prefijo (evita colisiones con nodos vivos y con borrados históricos).
 *
 * @param subtreeCodesInOrder códigos del subárbol origen en orden topológico
 * @param existingCodes todos los códigos del producto (incluye borrados)
 * @returns mapa código origen → código nuevo (el mismo código nunca se reutiliza)
 */
export function allocateDuplicateCodes(
  subtreeCodesInOrder: string[],
  existingCodes: string[],
): Map<string, string> {
  const maxExisting = new Map<string, number>();
  for (const code of existingCodes) {
    const parsed = parseNodeCode(code);
    if (parsed) {
      maxExisting.set(parsed.prefix, Math.max(maxExisting.get(parsed.prefix) ?? 0, parsed.num));
    }
  }

  const nextByPrefix = new Map<string, number>();
  const allocated = new Map<string, string>();
  for (const code of subtreeCodesInOrder) {
    const parsed = parseNodeCode(code);
    if (!parsed) {
      throw new Error(`Código con formato inesperado en el subárbol: '${code}'`);
    }
    const current = nextByPrefix.get(parsed.prefix) ?? maxExisting.get(parsed.prefix) ?? 0;
    const next = current + 1;
    nextByPrefix.set(parsed.prefix, next);
    allocated.set(code, `${parsed.prefix}-${String(next).padStart(2, '0')}`);
  }
  return allocated;
}

/** Posición inicial del duplicado: max(position)+1 entre los hermanos destino. */
export function nextSiblingPosition(siblingPositions: number[]): number {
  return siblingPositions.length === 0 ? 0 : Math.max(...siblingPositions) + 1;
}
