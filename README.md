# DevCycle · AdminProject

Plataforma de gestión del ciclo de vida del software: multiproducto, trazabilidad funcional y agentes IA vía MCP. Monorepo pnpm + Turborepo (Node ≥ 22).

> Estado: **Fase 1 · Fundamentos** — cimientos verificados: monorepo, CI (4 jobs: build-test, db-migrations, integration-tests, e2e), PostgreSQL + Drizzle, better-auth, RBAC, árbol funcional (`ltree`), API NestJS operativa, web Next.js operativa. Integración API+PG y E2E Playwright **verdes**.

## Demo rápida (≈ 5 min)

```bash
docker compose up -d postgres   # PostgreSQL 16 en localhost:5432
pnpm install
pnpm demo                       # migra + siembra (catálogos + 3 productos demo)
pnpm --filter @devcycle/api dev # API en http://localhost:3001 (docs: /api/v1/docs)
```

Abre `http://localhost:3001/api/v1/docs`, registra el primer usuario en la app:
**el primer usuario recibe `admin_global` automáticamente**. Productos demo: `kanora`, `verdana`, `nucleo` (ver `muckup/` para la UX objetivo).

## Estructura

```
apps/api         NestJS 11 — dominio, REST, OpenAPI, RBAC, better-auth
apps/web         Next.js 15 (pendiente — Fase 1-T08)
packages/db      Esquema Drizzle, migraciones SQL (up/down), seeds
packages/shared  Tipos/zod/errores RFC 9457/constantes (CJS)
packages/config  tsconfig, eslint, prettier compartidos
docs/            Planificación, HANDOFF y ADRs (docs/adr/)
muckup/          Mockup UX aprobado (intocable)
```

## Comandos

| Comando                                      | Qué hace                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm demo`                                  | Levanta Postgres, migra y siembra datos demo (idempotente)                              |
| `pnpm build` / `lint` / `typecheck` / `test` | Pipeline turbo de todo el workspace                                                     |
| `pnpm test:integration` (en `apps/api`)      | Integración API+PG (health, RBAC, árbol ltree, fuzz 300)                                |
| `pnpm e2e` (en `apps/web`)                   | E2E Playwright (requiere build con `API_INTERNAL_URL=http://localhost:3101 pnpm build`) |
| `pnpm db:migrate` / `db:seed`                | Migraciones y catálogos (`packages/db`)                                                 |
| `docker compose up -d postgres [minio]`      | Infra local (MinIO bajo perfil `storage`)                                               |

## Entorno

`apps/api` lee `.env` (copiar de `apps/api/.env.example`): `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥ 32 chars), `BETTER_AUTH_URL`, `WEB_URL`, `PORT=3001`. Nunca versionar `.env`.

## Documentación

- Estado vivo del desarrollo: `docs/HANDOFF.md`
- Plan e implementación: `docs/planificacion/07-plan-implementacion.md`
- Decisiones arquitectónicas: `docs/adr/ADR-001..005`
