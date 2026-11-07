/**
 * Motor de transiciones configurables (F3-T03) — función pura, unit-testeable.
 *
 * La tabla `state_transitions` declara qué pares (from → to) son válidos por
 * scope (task/issue). Esta función evalúa UN par contra ese catálogo sin
 * tocar BD: el servicio carga las transiciones del producto y delega aquí.
 *
 * Semántica:
 *  - from === to → siempre permitido (no-op, idempotente).
 *  - Si no existe fila (scope, from, to) → prohibido.
 *  - Si la fila exige `required_permission` y el actor no lo tiene → prohibido.
 *  - `requires_confirmation` NO bloquea aquí (la UI pide confirmación); el
 *    servicio lo expone para que la API lo devuelva como metadato.
 */

export interface TransitionRule {
  fromKey: string | null;
  toKey: string;
  requiredPermission?: string | null;
  requiresConfirmation?: boolean;
}

export interface TransitionDecision {
  allowed: boolean;
  reason?: string;
  requiredPermission?: string | null;
  requiresConfirmation?: boolean;
}

export function canTransition(
  transitions: readonly TransitionRule[],
  fromKey: string,
  toKey: string,
  permissions: readonly string[] = [],
): TransitionDecision {
  if (fromKey === toKey) {
    return { allowed: false, reason: 'sin_cambio' };
  }
  const rule = transitions.find((t) => t.fromKey === fromKey && t.toKey === toKey);
  if (!rule) {
    return { allowed: false, reason: 'transicion_no_declarada' };
  }
  if (rule.requiredPermission && !permissions.includes(rule.requiredPermission)) {
    return {
      allowed: false,
      reason: 'falta_permiso',
      requiredPermission: rule.requiredPermission,
      requiresConfirmation: rule.requiresConfirmation ?? false,
    };
  }
  return {
    allowed: true,
    requiredPermission: rule.requiredPermission ?? null,
    requiresConfirmation: rule.requiresConfirmation ?? false,
  };
}

/** ¿Existe alguna transición desde `fromKey`? (p. ej. para deshabilitar drops). */
export function allowedTargets(
  transitions: readonly TransitionRule[],
  fromKey: string,
): readonly string[] {
  return [...new Set(transitions.filter((t) => t.fromKey === fromKey).map((t) => t.toKey))];
}
