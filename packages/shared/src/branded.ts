/** Tipos nominal/branded para códigos públicos del dominio (M01, PANT-02, TAR-231…). */

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Código de nodo funcional, p. ej. `MODULO-01`, `PANT-02`. Único por producto. */
export type NodeCode = Brand<string, 'NodeCode'>;
/** Código de documento, p. ej. `DOC-101`. */
export type DocumentCode = Brand<string, 'DocumentCode'>;
/** Código de tarea, p. ej. `TAR-231`. */
export type TaskCode = Brand<string, 'TaskCode'>;
/** Código de incidencia, p. ej. `INC-087`. */
export type IssueCode = Brand<string, 'IssueCode'>;
/** Código de modificación, p. ej. `MOD-031`. */
export type ChangeCode = Brand<string, 'ChangeCode'>;
/** Código de caso de prueba, p. ej. `TC-014`. */
export type TestCaseCode = Brand<string, 'TestCaseCode'>;
/** Slug de producto (citext), p. ej. `kanora`. */
export type ProductSlug = Brand<string, 'ProductSlug'>;

const CODE_RE = /^[A-Z][A-Z0-9_]{0,15}-[0-9]{1,6}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function parseNodeCode(raw: string): NodeCode | null {
  const v = raw.trim().toUpperCase();
  return CODE_RE.test(v) ? (v as NodeCode) : null;
}
export function parseSlug(raw: string): ProductSlug | null {
  const v = raw.trim().toLowerCase();
  return SLUG_RE.test(v) ? (v as ProductSlug) : null;
}
