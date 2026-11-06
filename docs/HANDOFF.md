# HANDOFF — DevCycle (AdminProject) · 2026-11-06 (2ª sesión)

> **Estado:** Fase 1 · Fundamentos — **~60% completada**. `packages/shared`, `packages/db` y **`apps/api` funcionando y verificados E2E** (F1-T04…T07 ✅: API NestJS, better-auth, RBAC, products, nodes con move/duplicate/deactivate, activity_log, filtro problem+json, OpenAPI). `apps/web` (F1-T08), `packages/ui` (F1-T09), tests FND-* y CI verde en GitHub siguen pendientes.
> **Punto seguro:** BD re-sembrada a estado prístino (3 productos, 10 nodos, **0 usuarios**); CI (`.github/workflows/ci.yml`), ADRs (`docs/adr/`), README raíz.

## 0. Qué es el proyecto

Plataforma de gestión del ciclo de vida del software (multiproducto, trazabilidad funcional, agentes IA vía MCP). Brief completo en `prompt.md`; plan aprobado en `docs/planificacion/` (12 documentos). Mockup UX aprobado en `muckup/` (referencia obligatoria de UI, **intocable**). Desarrollo según `docs/planificacion/07-plan-implementacion.md`, **Fase 1 · Fundamentos**. Stack: pnpm+Turborepo · Node 22 · TS strict · Next.js 15 (web) · NestJS 11 (api) · PostgreSQL 16 + Drizzle · better-auth · MCP (Fase 6, fuera de esta sesión).

## 1. Hecho y verificado ✅

### Infra tras reinicio del PC

- Postgres en recuperación tras apagado forzoso: fsync de datos tardó ~70–90 s; `pg_isready` devuelve 0 aunque la BD no esté lista — **la sonda correcta es** `docker compose exec -T postgres psql -U devcycle -d devcycle -c 'select 1'`.
- BD purgada y re-sembrada a prístino: 3 productos, 10 nodos (kanora), 4 roles, 14 permisos, role_permissions=34, workflow_states=30, activity_log=0, users=0. Viene de `docker compose down -v` + `up` + `migrate up` + `seed --demo` (idempotentes ambos).

### Monorepo raíz (F1-T01)

- `git init -b main`; `.gitignore` (incluye `.env`), `docker-compose.yml` (`postgres:16-alpine` + `minio` bajo perfil `storage`), `package.json` (scripts `build/dev/lint/typecheck/test/db:*/demo`), `turbo.json`, ESLint flat (`packages/config/eslint.config.mjs`; **`consistent-type-imports` desactivada** — rompe DI, ver §3), Prettier, README raíz nuevo, CI `.github/workflows/ci.yml` (jobs: `build-test` lint+typecheck+unit+build; `db-migrations` con PG service: up→down --all→up, seed ×2, sanity psql).
- `pnpm demo` arreglado: antes NO incluía los datos demo; ahora `up postgres → migrate → seed --demo` y sugiere arrancar la API.

### `packages/config` ✅ · `packages/shared` ✅ (CJS + d.ts en `dist/`)

### `packages/db` ✅

- Esquema Drizzle, migraciones SQL up/down (`0001_extensions`, `0002_core`), runner propio, seed idempotente (`--demo`), **`declaration: true`** en build (faltaba: `@devcycle/db` publicaba `types` apuntando a un `dist/index.d.ts` inexistente → rompía typecheck de la API).
- `@types/node` añadido a devDependencies (typecheck de `seed.ts`/`migrate.ts` fallaba sin él).

### `apps/api` ✅ — F1-T04/T05/T06/T07 (arranca en `:3001`)

- **Bootstrap**: `helmet` → handler crudo de better-auth (`/api/auth/*`) **antes** del body-parser → `useBodyParser('json')` → CORS (`WEB_URL`, credentials) → prefijo `api/v1` → Swagger en `/api/v1/docs` (paths: `/me`, `/health`, `/products*`, `/nodes*`). Logger pino JSON (`nestjs-pino`, cookie redactada); `enableShutdownHooks`.
- **Env**: zod (`envSchema`) validado por `validateEnv` (en `ConfigModule.forRoot`) y `getEnv()` memoizado para consumo fuera de DI (auth). `apps/api/.env` creado (no versionado); `.env.example` versionado.
- **better-auth**: `drizzleAdapter` (user/session/account/verification), email+contraseña (min 8), sesiones PG, `trustedOrigins: [WEB_URL, BETTER_AUTH_URL]` (mejor-auth exige `Origin` en POST → si no, sign-out desde web → 403 `INVALID_ORIGIN`). **Hook `user.create.after`: primer usuario → `admin_global`** (verificado: registro → `/api/v1/me` devuelve `globalRoles:["admin_global"]`; sign-out → 401).
- **RBAC**: `SessionGuard` global (`@Public()` en health), `ProductGuard` (resuelve `:slug` → 404 si no existe; exige membresía o `admin_global`; 403 si no), `PermissionsGuard` + `@Permissions(...)` con **permisos efectivos**: `admin_global` → todos; si no, permisos del rol en `product_members` para ese producto. `admin_global` bypass documentado en ADR-004.
- **Products**: `GET /products` (membresías o todos si admin_global), `POST /products` (solo `products:manage` = admin_global) con **creación compuesta en una transacción**: product + member(creador `admin_product`, `accepted_at=now()`) + `workflow_states` (6 task + 4 issue) + `state_transitions` (18) por defecto + `activity_log(product.created)`. `GET /products/:slug`, `PATCH` (`config:manage`), `GET/POST /products/:slug/members` (alta directa de usuarios **ya registrados**; sin flujo de invitación por email en v1 — decisión), `members:manage`.
- **Nodes** (`ltree`): `GET` (plano, `ORDER BY path`), `POST` (creado en transacción: código único por producto con índice parcial → 409 `node.code_conflict`; `position = max+1`), `GET/PATCH` (nombre/estado/owner/posición; **code inmutable**), `POST .../move` (**serializable**; validación anti-ciclo: 422 `node.move_to_self`/`node.move_into_descendant`/`node.parent_not_found`; recomputado `path`/`depth` del subárbol con CTE `CASE` en un solo UPDATE; hermano renumerado si `position` dado), `POST .../duplicate` (subárbol completo; códigos nuevos con el siguiente número libre por prefijo — incluye códigos históricos/borrados), `POST .../deactivate` (soft-delete del subárbol, `path <@`).
- **Auditoría**: `activity_log` en todas las mutaciones (`product.created`, `member.added|role_changed`, `node.created|updated|moved|duplicated|deactivated`), dentro de la misma transacción que la operación.
- **Errores**: filtro global → `application/problem+json` (RFC 9457): ZodError→400 `validation.failed`, HttpException→status `http.<n>`, 23505→409 `db.unique_violation`, desconocido→500 `internal.error` (nunca filtra internals; 5xx con stack en log).
- **Unit tests** (`vitest`, FND-U): `tree.utils.spec.ts` (13) + `problem-details.filter.spec.ts` (6) — 19 verdes. `turbo test/typecheck/lint/build` todo verde en el workspace.
- **Fix runtime crítico**: las lecturas dentro de transacciones deben usar `tx` (no el pool) — `getNode(..., tx)`; antes devolvía estado pre-commit (stale reads) en `move`.
- **Fix `subpath()`**: `subpath(path, nlevel(path))` es inválido para el nodo raíz del subárbol → `invalid positions`; CTE con `CASE` (ver ADR-005).
- **Anti-patrón detectado y desactivado**: `consistent-type-imports` convertiría clases inyectadas en `import type` y rompería el DI de Nest (2 incidentes reales; regla `off` en `packages/config`).

### ADRs ✅ (`docs/adr/`)

ADR-001 monorepo · ADR-002 NestJS · ADR-003 Drizzle · ADR-004 better-auth · ADR-005 ltree — todos con alternativas y consecuencias.

## 2. Pendiente inmediato (retomar por aquí)

1. **F1-T08 · `apps/web`** (Next.js 15, XL): App Router + layout mockup (sidebar/topbar), login, selector de contexto, Productos, Resumen skeleton, árbol read-only + ficha vacía, Ctrl+K. **Revisar `muckup/` antes de tocar UI (intocable).** Proxy cookie/auth vía BFF (`/api/auth` → API). `↔ packages/ui`.
2. **F1-T09 · `packages/ui`** (Tree, DataTable, Pill, Tabs, EmptyState, CommandPalette portados del mockup, tests ≥70%).
3. **FND-T07/E2E**: fuzz de 1.000 movimientos aleatorios sobre el árbol; FND-SEC completo (tenant-escape A/B); FND-I (API contra PG efímero); FND-E2E (Playwright) cuando web exista.
4. **CI en GitHub**: primer push verde pendiente (`.github/workflows/ci.yml` ya escrito; verificar nombres de secrets — no requiere ninguno).
5. **Fase 1 completa**: criterios §2 de 07-plan (login real, 2 productos aislados, árbol operativo, CI verde, demo).
6. **Fase 1 · calidad**: tests de `nodes.service` con PG efímero (move transaccional, duplicado, deactivate); property-based del anti-ciclo.
7. Decisiones v1 registradas y pendientes de ratificar: alta directa de miembros existentes (sin invitación por email); `product.uuid7` vs better-auth text ids (status quo, ver ADR-004); 1 sola organización implícita (`getDefaultOrgId` toma la más antigua).

## 3. Trampas y decisiones ya resueltas (no repetir análisis)

- **`subpath(path, nlevel(path))` → `invalid positions`** en ltree: el nodo raíz del subárbol necesita `CASE` en el UPDATE (ADR-005).
- **Stale reads dentro de `db.transaction`**: `this.db` (pool) no ve cambios no commitados → pasar `tx` (p. ej. `getNode(product.id, code, tx)`).
- **CSRF de better-auth**: exige `Origin` en POST; `trustedOrigins` debe incluir `WEB_URL` → `INVALID_ORIGIN` en sign-out desde web.curl sin Origin → 403 `MISSING_OR_NULL_ORIGIN` (comportamiento esperado).
- **`consistent-type-imports` + `emitDecoratorMetadata` = DI roto** (`Nest can't resolve dependencies of …`): clases inyectadas SIEMPRE como `import` de valor. Regla desactivada.
- **pino-http loguea el error con el stack de pino, no del origen** — buscar `ProblemDetailsFilter` en el log para el stack real.
- **`pnpm install` aborta (no-TTY) si la raíz cambia** o si el store esperado no coincide: `node_modules` se instaló con `storeDir=/run/media/leonardo/Datos/.pnpm-store/v10`; tras el reinicio del PC desapareció `/home/leonardo/.config/pnpm/rc` (que fijaba ese store) y pnpm quiere `/mnt/datos/.pnpm-store/v10`. Solución: `CI=true pnpm install --store-dir=/run/media/leonardo/Datos/.pnpm-store/v10`. **Pendiente del usuario**: recrear el rc (p. ej. `store-dir=/run/media/leonardo/Datos/.pnpm-store/v10`) o reinstalar de cero con el store por defecto.
- **Procesos de fondo de esta sesión**: los hijos de shell mueren con el grupo; lanzar la API con `setsid` (p. ej. `(setsid bash -c 'set -a; . ./.env; set +a; exec node dist/main.js' </dev/null > log 2>&1 &)`).
- **Postgres tras apagado forzoso**: fsync/recovery lento; sondear SIEMPRE con `psql -c 'select 1'`, no con `pg_isready`.
- **ltree label**: `code` en minúsculas con `-`→`_` (`MODULO-01` → `modulo_01`).
- **Better-auth ids son `text`**, no uuid: por eso `ownerId`, `actor_user_id` son text en el modelo.
- **Código duplicado rechazado con 409** (`node.code_conflict`) vía índice parcial único `(product_id, code) WHERE deleted_at IS NULL`.
- **Express 5**: wildcard routes cambian (`*splat`); el handler de better-auth se monta con middleware discriminador por `req.path`, evitando la sintaxis.

## 4. Estado al cortar

- API **en marcha** en `http://localhost:3001` (lanzada con `setsid`); pid en `/tmp/opencode/api.pid`; log en `/tmp/opencode/api.log`.
- BD prístina: **sin usuarios**; el primer registro recibe `admin_global`.
  - Flujo verificado: sign-up → `/me` (admin_global) → sign-out → 401. (El usuario de prueba `leonardo@example.com` fue eliminado en el reseteo; vuelve a registrarte.)
  - `atlas-qa` (producto de pruebas E2E) eliminado en el reseteo.
- Versiones: better-auth 1.7.18 · @nestjs/* 11.2.8 · Express 5.2.1 · drizzle-orm 0.38.4 · postgres.js 3.4.9.
- Sin commits pendientes al cortar (trabajo commitea por hitos; ver `git log`).

## 5. Comandos de recuperación

```bash
cd /mnt/datos/Programacion/AdminProject
docker compose up -d postgres
for i in $(seq 1 150); do docker compose exec -T postgres psql -U devcycle -d devcycle -c 'select 1' >/dev/null 2>&1 && echo ready && break; sleep 2; done
export DATABASE_URL=postgres://devcycle:devcycle@localhost:5432/devcycle
pnpm install --store-dir=/run/media/leonardo/Datos/.pnpm-store/v10   # si pnpm aborta por store-dir
pnpm --filter @devcycle/shared build && pnpm --filter @devcycle/db build
cd apps/api && setsid bash -c 'set -a; . ./.env; set +a; exec node dist/main.js' </dev/null > /tmp/opencode/api.log 2>&1 &
curl http://localhost:3001/api/v1/health
```

Estado del seed (`migrate status`): `[x] 0001_extensions`, `[x] 0002_core`.

## 6. Referencias

- Plan de Fase 1 y criterios: `docs/planificacion/07-plan-implementacion.md` §2 (F1-T01…T12, R-03/R-07).
- Modelo de datos: `docs/planificacion/04-modelo-datos.md` (§10 matriz autorización).
- Arquitectura técnica y límites: `docs/planificacion/03-arquitectura-tecnica.md` §5 (prohibido web→db).
- Mockup (intocable): `muckup/index.html` + `muckup/README.md` · ADRs: `docs/adr/`.
- Estrategia de pruebas: `docs/planificacion/08-estrategia-pruebas.md` (FND-U/I/E2E/SEC/MIG).
