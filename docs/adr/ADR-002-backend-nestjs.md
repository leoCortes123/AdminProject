# ADR-002 · Backend NestJS 11 (monolito modular)

- **Estado:** ✅ Aceptada (Fase 1)
- **Fecha:** 2026-11-06
- **Relacionado:** [03-arquitectura-tecnica.md](../planificacion/03-arquitectura-tecnica.md) §4.2 · [09-riesgos-y-decisiones.md](../planificacion/09-riesgos-y-decisiones.md) D-002 · [07-plan-implementacion.md](../planificacion/07-plan-implementacion.md) F1-T04

## Contexto

DevCycle necesita una API REST estable y documentada (los agentes IA vía MCP la consumen en Fase 6), con módulos alineados a los límites funcionales M-xx, RBAC por guards, validación compartida con la web (`packages/shared`) y errores RFC 9457.

## Decisión

**NestJS 11** sobre Express 5, con:

- Un módulo por área: `health`, `iam`, `products`, `nodes` (Fase 1); resto de módulos M-xx en fases posteriores.
- **better-auth montado como handler crudo ANTES del body-parser** (`bodyParser: false` → `app.use(auth)` → `app.useBodyParser('json')`) en `/api/auth/*`.
- RBAC: `SessionGuard` global (APP_GUARD) + `ProductGuard` (resuelve `:slug` y exige membresía) + `PermissionsGuard` con `@Permissions(...)` y permisos efectivos por producto (o global `admin_global`).
- Validación de entrada con **zod** (`zodPipe`), no con class-validator; errores uniformes `application/problem+json` vía filtro global (`ProblemDetailsFilter`).
- Logging estructurado JSON (`nestjs-pino`), cookie `better-auth.session_token` redactada.
- OpenAPI en `/api/v1/docs` (`@nestjs/swagger`); prefijo global `/api/v1`.

## Alternativas evaluadas

| Alternativa    | A favor                                             | En contra                                                       | Veredicto                   |
| -------------- | --------------------------------------------------- | --------------------------------------------------------------- | --------------------------- |
| **NestJS**     | DI maduro, módulos = límites M-xx, OpenAPI, testing | Más ceremonia que “a pelo”                                      | **Aceptada**                |
| Fastify + tRPC | Menor superficie, tipos end-to-end                  | Sin módulos/DI estructurados; MCP necesita REST estable, no RPC | Descartada para API pública |
| Hono           | Ultraligero                                         | Ecosistema joven para dominio complejo                          | Descartada                  |
| Express pelado | Máximo control                                      | Sin estructura; mantenimiento a largo plazo                     | Descartada                  |

## Consecuencias

- Express 5: los wildcards en rutas cambian (`*splat`); el handler de auth se monta con un middleware propio que discrimina por `req.path`, evitando la sintaxis.
- Orden de middlewares obligatorio: helmet → auth crudo (sin body-parser) → body-parser JSON → prefijo `/api/v1`.
- `consistent-type-imports` está desactivada en ESLint para `apps/api`: convertir clases inyectadas a `import type` rompe `emitDecoratorMetadata` y el DI (incidente real en desarrollo).
- Cada endpoint declara permiso explícitamente (`@Permissions`) o se apoya solo en `ProductGuard` (lectura para miembros); `@Public()` solo para `/health`.
