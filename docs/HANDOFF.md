# HANDOFF — DevCycle (AdminProject) · 2026-11-06

> **Estado:** Fase 1 · Fundamentos **en curso, ~35% completada**. Se detuvo en un punto seguro tras completar y verificar `packages/shared`, `packages/db` y el esqueleto del monorepo. `apps/api` tiene `package.json` con dependencias instaladas; **falta todo el código** (ver §2).
> **Punto seguro:** migraciones aplicadas y testadas up/down sobre PostgreSQL real, seed demo ejecutado, `packages/shared` y `packages/db` compilan y se consumen vía `dist/` (CJS). Nada depende de estado efímero salvo el contenedor Docker de Postgres (datos en volumen `adminproject_devcycle_pgdata`); `apps/api` tiene dependencias instaladas pero aún sin código.

## 0. Qué es el proyecto

Plataforma de gestión del ciclo de vida del software (multiproducto, trazabilidad funcional, agentes IA vía MCP). Brief completo en `prompt.md`; plan aprobado en `docs/planificacion/` (12 documentos). Mockup UX aprobado en `muckup/` (referencia obligatoria de UI, **intocable**). Este desarrollo aplica `docs/planificacion/07-plan-implementacion.md`, **Fase 1 · Fundamentos**.

Stack confirmado en `docs/planificacion/03-arquitectura-tecnica.md`: pnpm+Turborepo · Node 22 · TS strict · Next.js 15 (web) · NestJS 11 (api) · PostgreSQL 16 + Drizzle · better-auth · MCP (Fase 6, fuera de esta sesión).

## 1. Hecho y verificado ✅

### Raíz del monorepo (F1-T01 parcial)
- `git init -b main` (sin commits todavía), `.gitignore`, `docker-compose.yml` (`postgres:16-alpine` servicio `postgres`; `minio` bajo perfil `storage`; volumen `devcycle_pgdata`), `package.json` raíz (scripts `build/dev/lint/typecheck/test/db:*/demo`), `pnpm-workspace.yaml`, `turbo.json`, `eslint.config.mjs` raíz (flat config, `muckup/` e ignorados), `prettier.config.mjs` raíz.
- Script `pnpm demo` en raíz (up postgres → migrate → seed).

### `packages/config` ✅
`tsconfig.base.json` (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`), `tsconfig.nestjs.json` (CJS + decoradores), `tsconfig.nextjs.json`, `eslint.config.mjs` (typescript-eslint recommended), `prettier.config.mjs`.

### `packages/shared` ✅ (F1-T03)
Errores RFC 9457 (`errors.ts` con `Problems.*`), `Result<T,E>` (`result.ts`), tipos branded (`NodeCode`, `ProductSlug`… `branded.ts`), catálogos estables (`constants.ts`: `NODE_TYPE_KEYS`, `PERMISSIONS` 14, `ROLE_KEYS`, `ENTITY_KINDS`, `RELATION_TYPES`…), zod base (`schemas.ts`: `createProductSchema`, `createNodeSchema`, `moveNodeSchema`, paginación cursor). **Se exporta como CJS compilado a `dist/`** (`main`/`types` → `dist`), porque NestJS consume `require()`.

### `packages/db` ✅ (F1-T02)
- `src/schema.ts` (Drizzle, PG): `organizations`, `users`/`sessions`/`accounts`/`verifications` (better-auth, modelName `users` etc.), RBAC (`roles`, `permissions`, `role_permissions`, `user_roles` para rol global de organización), `products`, `product_members`, `node_types` (globales seed + por producto), `product_nodes` (`ltree path`, `depth`, FK compuesta `(parent_id, product_id)`), `document_types`, `workflow_states`, `state_transitions`, `activity_log` (append-only).
- Migraciones **SQL escritas a mano con up/down** en `migrations/`: `0001_extensions` (ltree, citext, pg_trgm, unaccent, btree_gin) y `0002_core` (todo el modelo F1; incluye índices parciales únicos `(product_id, code) WHERE deleted_at IS NULL`, GiST sobre `path`, unique global de `node_types`, FK compuesta padre→hijo, trigger `forbid_mutation()` para `activity_log`).
- Runner propio `src/migrate.ts` (`up` / `down [--all]` / `status`) con tabla `schema_migrations` (FND-MIG). **Probado: down completo → up → seed idempotente, todo OK.**
- `src/seed.ts` **idempotente** (`--demo` opcional): roles 4 (`admin_global`, `admin_product`, `collaborator`, `viewer`), 14 permisos + matriz `role_permissions`, 8 `node_types` globales, 13 `document_types` (§5.3, decisión arquitectónica codificada como `adr`). Demo: organización `Acme & Co` y productos `kanora` (árbol reducido: 3 módulos, 10 nodos con paths ltree), `verdana`, `nucleo`; cada producto con `workflow_states`/`state_transitions` por defecto (tareas e issues, `src/workflow-defaults.ts`, reutilizable por la API en F1-T06).
- **Comandos:** `DATABASE_URL=postgres://devcycle:devcycle@localhost:5432/devcycle pnpm --filter @devcycle/db migrate up|status|down` y `... seed [--demo]`.
- `tsconfig.build.json` → `dist/` CJS; `migrate.ts` y `seed.ts` **excluidos del build** y ejecutables con `tsx`. Ambos usan `main()` con `.catch()` (TLA no soportado en CJS/tsx).

### Estado de la base de datos (volumen Docker `adminproject_devcycle_pgdata`)
`psql` verificado: 3 productos seed, 10 nodos kanora, roles=4, permissions=14, role_permissions=34, workflow_states=30, state_transitions=54, node_types=8, document_types=13. Postgres corre en `localhost:5432` (container `adminproject-postgres-1`).

### `apps/api` — solo preparado
`package.json` escrito (NestJS 11, platform-express, config, swagger, better-auth `^1.1.15`, nestjs-pino, helmet, supertest, vitest…). **Código aún no existe.** Dependencias en instalación al cortar (ver §4). Sin `tsconfig*.json` aún (patrón: copiar de `packages/db`, con `tsconfig.build.json` excluyendo tests).

## 2. Pendiente inmediato (retomar por aquí)

1. ~~Verificar `pnpm install`~~ **HECHO** (exit 0; better-auth 1.7.18, @nestjs/* 11.2.8). Ejecutar `pnpm --filter @devcycle/shared build && pnpm --filter @devcycle/db build` para asegurar `dist/` frescos.
2. **F1-T04** `apps/api` bootstrap: `src/main.ts` (helmet, `app.use('/api/auth', toNodeHandler(auth))` **antes** del body-parser de Nest, swagger en `/api/v1/docs`, prefijo `/api/v1` para controllers, ValidationPipe), `src/app.module.ts` (ConfigModule con validación **zod** de env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PORT=3001`, `WEB_URL`), `src/config/env.ts`, `src/health/health.controller.ts` (`GET /api/v1/health` → `{status:'ok', db:'up'}` con `SELECT 1`), `nestjs-pino` logger.
3. **Auth better-auth**: instancia en `src/iam/auth.ts` con `drizzleAdapter(db, {provider:'pg', schema:{user: users, session: sessions, account: accounts, verification: verifications}})` (nombres de tabla ya creados en migración 0002), `emailAndPassword.enabled`, `secret`/`baseURL` de env, y **`databaseHooks.user.create.after`**: si es el primer usuario de `users` → insertar `user_roles(user_id, role_id)` con rol `admin_global` (decisión ya tomada; la API es la única que conoce el contexto).
4. **F1-T05 RBAC**: `SessionGuard` (cookie `better-auth.session_token`; mejor: `auth.api.getSession({headers})`), `@Public()`, `CurrentUser` decorator; `ProductGuard` (resuelve `products` por `:slug` param, exige membership o rol global `admin_global`, adjunta `productId`); `PermissionsGuard` + `@Permissions(...)` con Reflector; cálculo de permisos efectivos = permisos del rol en `product_members` para ese producto, o todos si rol global `admin_global`. 403 sistemático si falta permiso; `activity_log` para operaciones sensibles.
5. **F1-T06** `products`: `GET /me`, `GET/POST /products`, `GET /products/:slug`. Crear producto = transacción: product + member(creator, `admin_product`) + `workflow_states`/`state_transitions` por defecto (reutilizar `DEFAULT_WORKFLOW_STATES/TRANSITIONS` desde `@devcycle/db`, exportado vía index — **falta exportarlo**: añadir `export * from './workflow-defaults.js'` a `packages/db/src/index.ts`) + `activity_log`. Solo `admin_global` crea productos (matriz §10 de 04-modelo-datos).
6. **F1-T07** `nodes`: `GET /products/:slug/nodes` (plano, ordenado por `path`), CRUD, `POST .../nodes/:code/move` (transacción **serializable**: validar ciclo = `newParent` no puede ser descendiente del nodo; recomputar `path`/`depth` de todo el subárbol vía `ltree`: `path = $newPath || subpath(path, nlevel($oldPath))::ltree`, `depth = nlevel(path)-1`), `POST .../nodes/:code/duplicate` (copia subárbol; códigos autogenerados con prefijo + siguiente número libre por producto, porque el regex de código exige `PREFIJO-123`), `POST .../nodes/:code/deactivate` (soft-delete del subárbol; códigos inmutables como el resto — no permitir cambiar `code`).
7. Emitir `activity_log` en cada operación (`product.created`, `node.created|moved|duplicated|deactivated`).
8. Problem-details filter global (`application/problem+json`) mapeando `ZodError`→400, `HttpException`→status, desconocidos→500; `Idempotency-Key` reservado para agentes (Fase 6).
9. **CI (F1-T10)**: `.github/workflows/ci.yml` (pnpm cache, services: postgres:16, `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, integration job con PG service).
10. **F1-T11** ADRs en `docs/adr/`: ADR-001 monorepo pnpm+Turbo, ADR-002 NestJS, ADR-003 Drizzle, ADR-004 better-auth, ADR-005 ltree (con alternativas — ya documentadas en `docs/planificacion/03` y `04` §5; enlazar).
11. **F1-T12** ya cubierto en gran parte por `seed --demo`; falta que `pnpm demo` (raíz) verifique health de API una vez exista.
12. Pendiente de Fase 1 completo: `apps/web` (F1-T08, Next.js: login, selector de contexto, Productos, árbol read-only, ficha vacía; layout del mockup), `packages/ui` (F1-T09), tests (FND-U unit TreeService, FND-I API contra PG efímero, FND-SEC tenant-escape, FND-E2E Playwright). **No improvisar; revisar mockup antes de tocar web.**

## 3. Decisiones y trampas ya resueltas (no repetir análisis)

- **CJS en paquetes compartidos**: `packages/shared` y `packages/db` compilan a `dist/` CJS (`tsconfig.build.json`, `module: CommonJS`, `verbatimModuleSyntax: false` en build). NestJS no puede `require()` ESM ni TS-fuente. Next.js/MCP consumen CJS sin problema.
- **TLA prohibido** en scripts que tsx ejecuta como CJS → usar `main().catch()`.
- **`pnpm --filter @devcycle/db seed -- --demo`** duplica el flag; usar `exec tsx src/seed.ts --demo` o dejar que `pnpm ... seed` no lleve `--` (verificar en CI).
- **pg_isready devuelve 0 aunque la BD no exista** (sonda con `dbname=user`): casi corrompió la primera inicialización de Postgres. Para readiness usar `docker compose exec -T postgres psql -U devcycle -d devcycle -c 'select 1'`.
- Primera inicialización de Postgres tardó ~70 s (initdb lento). Si el contenedor se corrompe: `docker compose down -v && docker compose up -d postgres` y **sin sondear hasta que el log muestre init completo**.
- pnpm ignoró build-scripts de `esbuild` (warning) — funciona igualmente con `tsx`.
- `node_modules/` fuera de git; `pnpm-lock.yaml` commiteable.
- ltree label = `code` minúsculas con `-`→`_` (codes tienen guión, inválido en ltree). Camino único por producto; codes inmutables tras creación (docs §11.4).
- Modelo polimórfico `relations` queda para F2+; `node_relations`/`item_relations` serán vistas.

## 4. Estado al cortar la sesión

- **`pnpm install` completado (exit 0).** Versiones instaladas: better-auth 1.7.18, @nestjs/* 11.2.8, nestjs-pino 4.6.1. pnpm sigue ignorando build-scripts de esbuild (warning conocido, sin impacto).
- **Commit inicial creado** (`chore: monorepo scaffold + fase 1 fundamentos…`) como punto seguro.
- **Docker**: contenedor `adminproject-postgres-1` arriba; volumen `adminproject_devcycle_pgdata` **contiene datos seed** — si se borra, re-sembrar con `migrate up` + `seed --demo`.

## 5. Comandos de recuperación

```bash
docker compose up -d postgres
for i in $(seq 1 90); do docker compose exec -T postgres psql -U devcycle -d devcycle -c 'select 1' >/dev/null 2>&1 && break; sleep 2; done
export DATABASE_URL=postgres://devcycle:devcycle@localhost:5432/devcycle
pnpm install
pnpm --filter @devcycle/shared build && pnpm --filter @devcycle/db build
pnpm --filter @devcycle/db migrate status   # debe mostrar [x] 0001_extensions, [x] 0002_core
```

## 6. Referencias

- Plan de Fase 1 y criterios de aceptación: `docs/planificacion/07-plan-implementacion.md` §2 (F1-T01…T12, R-03/R-07).
- Modelo de datos completo (migraciones F2+): `docs/planificacion/04-modelo-datos.md`.
- Arquitectura técnica y límites modulares (prohibido: web→packages/db, mcp-server→db): `docs/planificacion/03-arquitectura-tecnica.md` §5.
- Mockup a replicar en `apps/web`: `muckup/index.html` + `muckup/README.md`.
- Estrategia de pruebas (FND-*): `docs/planificacion/08-estrategia-pruebas.md`.
