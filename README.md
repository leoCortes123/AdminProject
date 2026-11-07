# DevCycle · AdminProject

Plataforma de gestión del ciclo de vida del software: multiproducto, trazabilidad funcional y agentes IA vía MCP. Monorepo pnpm + Turborepo (Node ≥ 22).

> Estado: **Fase 2 · Conocimiento** — M-03 completa: documentación versionada, tipada (13 tipos), vinculada (doc↔nodo y doc↔doc), buscable (FTS español), con editor Markdown + preview sanitizada, diff de versiones y adjuntos. Fase 1 sigue verde (árbol con fuzz de 1.000 movimientos, TTI < 1,5 s). Integración API+PG (15 tests) y E2E Playwright (3 specs) **verdes en local**; CI con 4 jobs pendiente del desbloqueo de billing de la cuenta de GitHub (ver `docs/HANDOFF.md`).

## Demo rápida (≈ 5 min)

```bash
docker compose up -d postgres   # PostgreSQL 16 en localhost:5432
pnpm install
pnpm demo                       # migra + siembra (catálogos + 3 productos + 3 documentos demo)
pnpm --filter @devcycle/api dev # API en http://localhost:3001 (docs: /api/v1/docs)
```

Abre `http://localhost:3001/api/v1/docs`, registra el primer usuario en la app:
**el primer usuario recibe `admin_global` automáticamente**. Productos demo: `kanora`, `verdana`, `nucleo` (ver `muckup/` para la UX objetivo). Kanora trae 3 documentos (`DOC-101` vigente multi-nodo, `DOC-118` vigente, `DOC-124` en revisión) para ver Documentación y la pestaña de ficha sin pasos manuales.

## Estructura

```
apps/api         NestJS 11 — dominio, REST, OpenAPI, RBAC, better-auth (productos, nodos, documentos, adjuntos, búsqueda)
apps/web         Next.js 15 — Productos, Resumen, Arquitectura funcional, Documentación, login, E2E
packages/db      Esquema Drizzle, migraciones SQL (up/down), seeds (incl. documentos demo)
packages/shared  Tipos/zod/errores RFC 9457/constantes (CJS)
packages/config  tsconfig, eslint, prettier compartidos
docs/            Planificación, HANDOFF y ADRs (docs/adr/)
muckup/          Mockup UX aprobado (intocable)
```

## Comandos

| Comando                                 | Qué hace                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm demo`                             | Levanta Postgres, migra y siembra datos demo (idempotente)                                 |
| `pnpm build`/`lint`/`typecheck`/`test`  | Pipeline turbo de todo el workspace                                                        |
| `pnpm format` / `format:check`          | Prettier (mockup y `prompt.md` fuera: `.prettierignore`)                                   |
| `pnpm test:integration` (`apps/api`)    | Integración API+PG (health · RBAC · ltree · fuzz 1.000 · docs F2 · 15 tests)               |
| `pnpm e2e` (`apps/web`)                 | E2E Playwright: Fase 1 + Documentación + TTI < 1.5 s (build con `API_INTERNAL_URL=…:3101`) |
| `pnpm db:migrate` / `db:seed`           | Migraciones y catálogos (`packages/db`)                                                    |
| `docker compose up -d postgres [minio]` | Infra local (MinIO bajo perfil `storage`)                                                  |

> Nota: `pnpm format` no toca `muckup/` (mockup aprobado, intocable) ni `prompt.md` — ver `.prettierignore`.

## Entorno

`apps/api` lee `.env` (copiar de `apps/api/.env.example`): `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥ 32 chars), `BETTER_AUTH_URL`, `WEB_URL`, `PORT=3001`. Adjuntos: filesystem en dev (`UPLOADS_DIR`, defecto `apps/api/data/uploads/`), S3/MinIO en prod si `S3_BUCKET` está definido. Nunca versionar `.env`.

## Documentación

- Estado vivo del desarrollo: `docs/HANDOFF.md`
- Plan e implementación: `docs/planificacion/07-plan-implementacion.md` (§3 Fase 2)
- Decisiones arquitectónicas: `docs/adr/ADR-001..005` (+ §4.6–4.7 de `03-arquitectura-tecnica.md` para editor y StoragePort)
