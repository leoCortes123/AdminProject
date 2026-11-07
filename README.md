# DevCycle · AdminProject

Plataforma de gestión del ciclo de vida del software: multiproducto, trazabilidad funcional y agentes IA vía MCP. Monorepo pnpm + Turborepo (Node ≥ 22).

> Estado: **Fase 6a · Integraciones (API + scopes)** — cuentas de servicio y tokens con hash/scopes/revocación, 21 endpoints `GET /integration/*` read-only reutilizando servicios de dominio, `get_product_context` acotado a 32 KB, auditoría agente (`agent_executions` + `activity_log`) y UI de gestión de tokens. Integración API+PG (37 tests) y E2E Playwright (7 specs) **verdes en local**; CI con 4 jobs pendiente del desbloqueo de billing de la cuenta de GitHub (ver `docs/HANDOFF.md`).

## Demo rápida (≈ 5 min)

```bash
docker compose up -d postgres   # PostgreSQL 16 en localhost:5432
pnpm install
pnpm demo                       # migra + siembra (catálogos + 3 productos + 3 docs + 3 tareas + 1 incidencia demo)
pnpm --filter @devcycle/api dev # API en http://localhost:3001 (docs: /api/v1/docs)
```

Abre `http://localhost:3001/api/v1/docs`, registra el primer usuario en la app:
**el primer usuario recibe `admin_global` automáticamente**. Productos demo: `kanora`, `verdana`, `nucleo` (ver `muckup/` para la UX objetivo). Kanora trae 3 documentos (`DOC-101` vigente multi-nodo, `DOC-118` vigente, `DOC-124` en revisión), 3 tareas (`TAR-231` en curso, `TAR-232` pendiente, `TAR-240` en curso bloqueada por TAR-231), 1 incidencia (`INC-087` abierta con tarea correctiva), 2 modificaciones (`MOD-031` propuesta con `resolves` a INC-087 + `MOD-030` ejecutada con git) y 1 caso de prueba (`TC-014` con resultado passed) para ver Tareas/Incidencias/Modificaciones/Trazabilidad/Seguimiento y la ficha con relaciones e historial sin pasos manuales.

## Estructura

```
apps/api         NestJS 11 — dominio, REST, OpenAPI, RBAC, better-auth (productos, nodos, documentos, tareas, incidencias, comentarios, adjuntos, búsqueda, modificaciones, pruebas, traza, seguimiento, integración con service tokens)
apps/web         Next.js 15 — Productos, Resumen, Arquitectura funcional, Documentación, Tareas (tabla/árbol/kanban), Incidencias, Modificaciones, Trazabilidad (consultas + grafo), Seguimiento (avance/cobertura/actividad), Integraciones y agentes (tokens + auditoría), login, E2E
packages/db      Esquema Drizzle, migraciones SQL (up/down), seeds (incl. documentos/tareas/incidencias/modificaciones/casos demo)
packages/shared  Tipos/zod/errores RFC 9457/constantes (CJS)
packages/config  tsconfig, eslint, prettier compartidos
docs/            Planificación, HANDOFF y ADRs (docs/adr/)
muckup/          Mockup UX aprobado (intocable)
```

## Comandos

| Comando                                 | Qué hace                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm demo`                             | Levanta Postgres, migra y siembra datos demo (idempotente)                                                                                       |
| `pnpm build`/`lint`/`typecheck`/`test`  | Pipeline turbo de todo el workspace                                                                                                              |
| `pnpm format` / `format:check`          | Prettier (mockup y `prompt.md` fuera: `.prettierignore`)                                                                                         |
| `pnpm test:integration` (`apps/api`)    | Integración API+PG (health · RBAC · ltree · fuzz 1.000 · docs F2 · trabajo F3 · traza F4 · seguimiento F5 · integración F6a · 37 tests)          |
| `pnpm e2e` (`apps/web`)                 | E2E Playwright: Fase 1 + Documentación + Tareas + Trazabilidad + Seguimiento + Integraciones + TTI < 1.5 s (build con `API_INTERNAL_URL=…:3101`) |
| `pnpm db:migrate` / `db:seed`           | Migraciones y catálogos (`packages/db`)                                                                                                          |
| `docker compose up -d postgres [minio]` | Infra local (MinIO bajo perfil `storage`)                                                                                                        |

> Nota: `pnpm format` no toca `muckup/` (mockup aprobado, intocable) ni `prompt.md` — ver `.prettierignore`.

## Entorno

`apps/api` lee `.env` (copiar de `apps/api/.env.example`): `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥ 32 chars), `BETTER_AUTH_URL`, `WEB_URL`, `PORT=3001`. Adjuntos: filesystem en dev (`UPLOADS_DIR`, defecto `apps/api/data/uploads/`), S3/MinIO en prod si `S3_BUCKET` está definido. Nunca versionar `.env`.

## Documentación

- Estado vivo del desarrollo: `docs/HANDOFF.md`
- Plan e implementación: `docs/planificacion/07-plan-implementacion.md` (§7 Fase 6a; §6 Fase 5)
- Decisiones arquitectónicas: `docs/adr/ADR-001..007` (+ §4.6–4.7 de `03-arquitectura-tecnica.md` para editor y StoragePort)

## Integraciones (Fase 6a)

- La API de integración read-only vive en `http://localhost:3001/api/v1/integration/*` (docs: `/api/v1/docs/integration`) y exige `Authorization: Bearer dvc_…`.
- Crea una cuenta y un token desde la app: **Integraciones y agentes** → Crear cuenta → Crear token read-only (el token en claro se muestra una sola vez).
- Ejemplo: `curl -H "Authorization: Bearer dvc_…" http://localhost:3001/api/v1/integration/products/kanora/nodes/PANT-02/context`.
