# ADR-004 · better-auth (email+contraseña, sesiones en PostgreSQL)

- **Estado:** ✅ Aceptada (Fase 1)
- **Fecha:** 2026-11-06
- **Relacionado:** [03-arquitectura-tecnica.md](../planificacion/03-arquitectura-tecnica.md) §4.5 · [07-plan-implementacion.md](../planificacion/07-plan-implementacion.md) F1-T04 · [04-modelo-datos.md](../planificacion/04-modelo-datos.md) §4.1

## Contexto

La plataforma necesita auth para humanos (web) con sesiones revocables y, en Fase 6, tokens de servicio para agentes MCP. Requisito: auditoría de acciones, cookies HttpOnly, y que la API (no la web) sea la autoridad del contexto de registro.

## Decisión

**better-auth** con `drizzleAdapter` sobre las tablas `users/sessions/accounts/verifications` (creadas en migración 0002, `modelName` en singular):

- `emailAndPassword.enabled`, `minPasswordLength: 8`.
- Sesiones en PostgreSQL (default 7 días, `updateAge` 1 día), cookie HttpOnly `better-auth.session_token`, `SameSite=Lax`.
- `baseURL` de `BETTER_AUTH_URL`; **`trustedOrigins: [WEB_URL, BETTER_AUTH_URL]`** — better-auth exige `Origin` en POST (CSRF); sin esto, sign-out desde la web (`:3000`) → 403 `INVALID_ORIGIN`.
- Montado fuera de Nest (handler crudo) **antes** del body-parser; Nest sigue para el resto (`/api/v1/*`).
- **Hook `databaseHooks.user.create.after`:** si es el PRIMER usuario de `users`, se le asigna el rol global `admin_global` (rol por defecto de la organización). La API es el único punto que conoce el contexto de registro.
- Logout siempre revocable: better-auth borra la fila de `sessions`; `/api/v1/me` → 401 tras sign-out (verificado E2E con curl).

## Alternativas evaluadas

| Alternativa           | A favor                                                                               | En contra                                                        | Veredicto              |
| --------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------- |
| **better-auth**       | TS-first, sesiones en DB, adaptador Drizzle, hooks de auditoría, válido fuera de Next | Novel (R-07); API evoluciona                                     | **Aceptada**           |
| Auth.js v5            | Potencia                                                                              | Acoplado a Next.js; queremos validez fuera de web (API, MCP CLI) | Descartada como núcleo |
| Implementación propia | Control total                                                                         | Coste de seguridad alto                                          | Descartada             |
| JWT puro sin sesiones | Stateless                                                                             | Revocación imposible — inaceptable para acciones de agentes      | Descartada             |

## Consecuencias

- `getSession` por request: `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })` — sin caché en v1 (volumen bajo: 50 usuarios/producto).
- Los ids de usuario son `text` (no uuid) en better-auth — por eso `product_nodes.owner_id`/`activity_log.actor_user_id` son `text` y `createNodeSchema.ownerId` es `z.string()`.
- El primer usuario del sistema recibe `admin_global`; el resto se incorpora como miembro por producto (`POST /products/:slug/members`, alta directa en v1 sin email de invitación).
- El riesgo de novelty (R-07) se mitiga con smoke tests curl documentados en HANDOFF y E2E Playwright en F1-T08/FND-E2E.
