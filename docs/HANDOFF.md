# HANDOFF — DevCycle (AdminProject) · 2026-11-07 (11ª sesión)

> **Estado:** Fase 6b · Servidor MCP read-only (stdio) — **CERRADA (criterios cumplidos en local)**. `apps/mcp-server` implementado (SDK oficial, transporte **stdio**): 23 tools read-only + 11 recursos `devcycle://` + 4 prompts, presupuesto 32 KB, verificado punta a punta con cliente stdio (`scripts/test-stdio.cjs` → `get_product_context` + `search_product_knowledge` + auditoría). Integración API+PG **verde (37/37, incluye fuzz de 1.000 movimientos de Fase 1 y 5 tests F6a)** y **E2E Playwright verde (7/7: golden + perf + documentación + tareas + trazabilidad + seguimiento + integraciones)**. `lint`/`typecheck`/`test`/`build`/`format:check` verdes en el workspace. Fases 1–6a siguen intactas y verdes.
> **Servidores demo vivos:** web `:3000` (proxy → :3001), API `:3001`. BD `devcycle` con seed demo (3 productos, árbol + 3 documentos + 3 tareas + 1 incidencia + 2 modificaciones + 1 caso de prueba en kanora) y **1 usuario existente** (`drleocortex@gmail.com`, admin) — no resetear a mano sin confirmación. Migraciones `0007_integration` y `0008_node_functional` (ficha: `description`+`objective` en `product_nodes`) aplicadas en demo (up/down probados).
> **Entornos efímeros:** `devcycle_test` (integración API, la recrea su globalSetup) · `devcycle_e2e` (E2E, la recrea su globalSetup).

## 0. Qué es el proyecto

Plataforma de gestión del ciclo de vida del software (multiproducto, trazabilidad funcional, agentes IA vía MCP). Brief en `prompt.md`; plan en `docs/planificacion/` (12 docs). Mockup UX aprobado en `muckup/` (**intocable** — `apps/web/src/app/globals.css` es su puerto fiel). Desarrollo según `docs/planificacion/07-plan-implementacion.md`, **Fase 6b · Integraciones (M-09)** (MCP read-only sobre la API de 6a; 6c MCP escrituras + confirmación es el siguiente paso).

## 1. Hecho y verificado ✅ (Fase 6b: F6b-T01…T05; Fases 6a/0008 intactas)

### F6b-T01 · `apps/mcp-server`: stdio + `--token`/`--product`/`--api-base` (sin BD)

- Paquete `@devcycle/mcp-server` (bin `devcycle-mcp`, CJS): `src/{config,api-client,tools,resources,prompts,index}.ts` + SDK oficial `@modelcontextprotocol/sdk` v1.32.2 + **zod v4 local** (el SDK 1.32 da `TS2589` con zod v3 en su API de alto nivel; el workspace sigue en zod v3 y no choca porque MCP solo consume constantes de `@devcycle/shared`).
- Transporte **stdio** elegido: stdout es JSON-RPC, logs a stderr, token nunca impreso (sin token → stderr + exit 1, stdout 0 bytes). Config CLI > env (`DEVCYCLE_TOKEN`/`DEVCYCLE_PRODUCT`/`DEVCYCLE_API_BASE`, defecto `http://localhost:3001/api/v1`).

### F6b-T02 · 23 tools read-only (zod + presupuesto 32 KB)

- Los 21 endpoints `GET /integration/*` (`list_products` … `get_product_overview`) + 2 compuestas sin endpoint propio (`search_documents` vía `list_documents?q=`, `get_task_relations` vía `get_task`). Todas con `readOnlyHint=true`, `productSlug` opcional (defecto de arranque) y `limit`/`depth`/`sections` según tool. Salida: `content[0].text` JSON + `structuredContent` solo si no trunca a 32 KB (`api-client.ts:toToolResult`).

### F6b-T03 · Resources JSON `devcycle://{producto}/…` (11 patrones)

- `products`, `structure`, `nodes/{code}` + `context|documents|rules|decisions|api-contracts`, `documents/{code}`, `tasks/{code}`, `changes`. `resources/list` enumera para el producto por defecto vía la API (best-effort `[]` ante error); `read` devuelve JSON (`mimeType: application/json`, 32 KB).

### F6b-T04 · 4 prompts

- `analyze-screen-before-change` (`nodeCode`) · `prepare-implementation` (`taskCode`) · `analyze-issue` (`issueCode`) · `verify-acceptance-criteria` (`taskCode`). Plantillas que ordenan llamar a las tools (no consultan la API).

### F6b-T05 · `get_product_context` vía MCP + auditoría sin duplicar

- El MCP no audita por su cuenta: cada `tools/call` va por `/integration/*` y deja su fila `agent_executions` + `activity_log` (`actor_type='agent'`). Verificado en vivo (`scripts/test-stdio.cjs` → `get_product_context PANT-02` + `search_product_knowledge` → auditoría con `serviceAccountId`).

### F6b-T06 · Cliente de prueba stdio + guía

- `apps/mcp-server/scripts/test-stdio.cjs` (F6b-T06): levanta `dist/index.js` y ejercita `initialize` + `tools/list` (23, todas `readOnlyHint`) + `get_product_context` + `search_product_knowledge` + `resources/list` (69 URIs en demo) + `prompts/list`. Guía validada: `docs/agentes/conectar-claude-code.md` (5 minutos). UI Integraciones muestra ahora el comando `claude mcp add …`.

### Ficha funcional (migración 0008, sin cambios desde su cierre)

- `product_nodes.description` + `product_nodes.objective` (`0008_node_functional.{up,down}.sql`, up/down probados). Resumen/Funcionalidad de la ficha ya no son placeholder: Definición/objetivo nativos + CU/reglas/RNF/flujos derivados de documentos vinculados. `duplicate` hereda la ficha y el FTS la indexa.

### Resto acumulado (Fases 1–6a, sin cambios)

### F6a-T01 · service_accounts + api_tokens (hash, scopes, expiración, revocación, rate-limit)

- `packages/db/migrations/0007_integration.{up,down}.sql` (up/down probados en demo): tablas `service_accounts` (por producto, UNIQUE producto+nombre) y `api_tokens` (`token_hash` sha256 UNIQUE, `token_prefix` legible, `scopes` JSONB, `expires_at`, `last_used_at`, `revoked_at`). Down probado (`migrate down` → `up`).
- `packages/shared` (`INTEGRATION_SCOPES`, `READ_SCOPES`, `WRITE_SCOPES`, `createServiceAccountSchema`, `createApiTokenSchema`, `CONTEXT_SECTIONS/MAX_BYTES`) — scopes `read:*`, `write:*`, `changes:propose`, `issues:resolve`, `agent:confirm` (este último nunca otorgable por token).
- `apps/api/src/integration-api/` — `IntegrationTokenService` (creación con token en claro **una sola vez**, patrón GitHub; listados sin secretos; revoke instantáneo; `rate-limit` en memoria 120 req/min por token; `validateBearer` con check `revoked_at IS NULL` en cada request) + `IntegrationTokenGuard` (Bearer, tenant-escape por `:slug`, scopes `@IntegrationScopes(...)`).
- Gestión humana (`@Permissions('integrations:manage')`): `POST /products/:slug/integration/service-accounts`, `POST .../tokens`, `GET .../tokens`, `POST .../tokens/:id/revoke`, `GET .../executions`. Probado: token mostrado una vez, listado sin claro, revocado → 401 en la siguiente llamada.

### F6a-T02 · Endpoints `/integration/*` read-only + OpenAPI integration-v1

- 21 endpoints `GET /integration/*` reutilizando servicios de dominio sin lógica duplicada (`ProductsService`, `NodesService`, `DocumentsService`, `TasksService`, `IssuesService`, `ChangesService`, `TestCasesService`, `TraceService`, `FollowupService`, `SearchService`): `list_products`, `get_product`, `get_product_structure`, `get_node`, `get_product_context`, `list_documents`, `get_document`, `get_document_history`, `list_tasks`, `get_task`, `list_issues`, `get_issue`, `get_node_history`, `get_node_relations`, `get_dependencies` (grafo BFS), `list_changes`, `get_change`, `list_test_cases`, `get_test_case`, `search_product_knowledge`, `get_product_overview`. Scopes `read:*` por área.
- `get_product_context` (`IntegrationContextService`): `target {code,name,path,status,nodeTypeKey}` + `sections[]` (default todas menos `history` completo) + listas capadas a 10 + `functional` ≤ 4 KB + presupuesto 32 KB con `truncated: true` (06 §6).
- OpenAPI separado `integration-v1` en `/api/v1/docs/integration` (Bearer), además del doc principal con `addBearerAuth`. Contrato: sin sesión web válida sin token (`@Public()` + guard).
- UI: `/products/[slug]/integraciones` (`integraciones-view.tsx`: crear cuenta/token, copiar token una vez, revocar, auditoría). Sidebar «Integraciones y agentes», footer `v0.6 · Fase 6a`.

### F6a-T03 · Auditoría `agent_executions` + `activity_log` (actor agent)

- `agent_executions` enriquecida (`request_args` JSONB redactado — sin tokens/cuerpos, `result_summary`, `ip`); `activity_log.actor_service_account_id` con `actor_type='agent'`. Cada `/integration/*` deja fila en ambas (args redactados, `request_summary` truncado).
- Probado: `GET /products/:slug/integration/executions` muestra `get_product`/`get_product_context` con `serviceAccountId`; `GET /activity?actorType=agent` devuelve solo entradas agent con `action` prefijado `integration.`; la auditoría nunca contiene el token en claro.

### F6a-T04 · Pruebas (ver §5)

- Integración ampliada **dentro del único** `api.integration.spec.ts`: 5 tests F6a (tokens/listados/revoke/tenant-escape + scopes insuficientes → 403 · 12 endpoints read-only + context ≤ 32 KB · auditoría doble · revoke instantáneo · OpenAPI + admin sin sesión → 401 / outsider → 403). Total **37/37** (32 previos + 5).
- E2E `zzz-integraciones.spec.ts` (crear cuenta → token UI → `GET context PANT-02` con ese token → auditoría visible tras reload) con retry con backoff (patrón Fase 4). Total **7/7**.
- Unidades, `lint`/`typecheck`/`build`/`format:check` verdes.

### Resto acumulado (Fases 1–5, sin cambios)

Monorepo+CI (4 jobs) · `packages/db` (migraciones reversibles) · `packages/shared` · `packages/ui` · better-auth · RBAC + guards · products + nodes (ltree) · documentos versionados (F2) · trabajo con kanban (F3) · trace con 7 consultas + grafo BFS + sweep (F4) · followup con overview/coverage/activity/export/search (F5) y `ProductGuard`/`PermissionsGuard` reutilizados para la gestión humana de tokens (tenant-escape por construcción).

## 2. Pendiente inmediato (en este orden)

### A · CI verde en GitHub — ⚠️ bloqueado por la cuenta de GitHub (no por el código)

**Push hecho en Fase 1** (2026-11-06, run [42292587175](https://github.com/leoCortes123/AdminProject/actions/runs/42292587175)): los 4 jobs arrancan pero **ninguno se ejecuta** — GitHub responde _"The job was not started because your account is locked due to a billing issue"_ (repo público, `allowed_actions: all`, token con `repo`+`workflow`: no es el `ci.yml`).

**Qué hacer (solo el dueño de la cuenta puede):** `https://github.com/settings/billing` (regularizar método de pago / cuota) → `…/billing/payment-history` (pago fallido) → tras desbloquear, `gh workflow run CI` y confirmar los 4 jobs verdes. Todo lo que ejecuta la CI está verificado en local: `lint` · `typecheck` · `test` · `build` · `format:check` · migraciones up/down + seed idempotente (incl. todo el demo) · integración 37/37 (fuzz 1.000) · E2E 7/7.

### B · Criterios de aceptación de Fase 6b (07-plan §7, F6b-T01…T05) — **todos cumplidos en local**

1. ✅ `claude mcp list` puede ver `devcycle` (el comando está en la UI y en la guía; verificado con cliente stdio equivalente `scripts/test-stdio.cjs`). ✅ Cada tool con test de contrato (unidades 11/11 + stdio de punta a punta contra demo). ✅ `resources/list`/`read` funcionan (69 URIs demo). ✅ Prompts visibles en cliente MCP (`prompts/list` con los 4). ✅ `get_product_context` < 500 ms (PANT-02: ~1,5 KB) y ≤ 32 KB (truncado verificado en unidades).
2. ⏳ Solo queda **CI verde en GitHub** (ver A).

### C · Siguiente paso: Fase 6c (MCP escrituras con confirmación) — no iniciado

- Modo confirmación (`confirmation_required` + UI Agentes IA Aprobar/Rechazar), writes v2 (`create/update_document`, `create/update_task`, status, `create/update/resolve issue`, `register_change`, `link_items`, `register_test_result` con `idempotencyKey`) y rate-limit de escritura por token. Detalle en `07-plan-implementacion.md` §7 (F6c-T01…T03).
- Los tokens de 6a/6b son el formato `--token` que el servidor MCP ya recibe.

### D · Deuda menor conocida (sin bloquear 6b)

- Benchmark p95 con 100k `relations` sigue pendiente como script de carga sintética (índices + grafo BFS ya verificados; no se mete en la suite de integración por tiempo).
- `POST /trace/sweep` sigue a demanda (permiso `audit:read`); el job semanal cron + métrica `orphan_relations` llega con el watcher de Agentes (Fase 6).
- E2E: el rate-limit de auth con bucket compartido obliga a retry (implementado en `z-trazabilidad`, `zz-seguimiento` y `zzz-integraciones`; si una spec `z` futura falla con 429, copiar el patrón antes de tocar `playwright.config.ts`).
- Kanban HTML5 DnD sigue sin `@dnd-kit` (opción si Fase 6 necesita ordenamiento, R-04).
- API: rate-limit de better-auth bajo proxy sin IP (warning cosmético). pnpm en este PC: `CI=true pnpm --store-dir=/run/media/leonardo/Datos/.pnpm-store/v10 …`.
- ✅ Web reconstruida por defecto tras E2E y demo :3000 vivo (con la ruta `/integraciones` de 6a).
- **Nunca** `pkill -f` con cadenas de la propia shell; `pnpm format` no toca `muckup/` (`.prettierignore`). Para reiniciar la API usa `node dist/main.js` en background tras `kill <pid>` específico; para la web usa `npx next start` en background (no `pkill -f next-server`: mata también otros procesos `next` locales).

## 3. Estado de las BDs

- `devcycle` (demo): 3 productos, árbol kanora, **3 documentos kanora** (`DOC-101` v2 vigente, `DOC-118` v1 vigente, `DOC-124` v1 en revisión), **3 tareas kanora** (`TAR-231` en curso · `TAR-232` pendiente · `TAR-240` en curso con `is_blocked_by TAR-231`), **1 incidencia kanora** (`INC-087` abierta con tarea correctiva TAR-231), **2 modificaciones kanora** (`MOD-031` propuesta con `resolves` a INC-087 + `MOD-030` ejecutada con git `a3f9c21`), **1 caso de prueba kanora** (`TC-014` passed), **ficha funcional 0008** (`MODULO-01`/`PANT-02` con `description`+`objective`) + **1 usuario** (el dueño, admin — ⚠️ no resetear sin confirmación; `down -v` borraría su usuario e historia). BD `devcycle` con `0007_integration` + `0008_node_functional` aplicadas — `pnpm demo` las migra de todos modos (idempotente). Cuenta `mcp-check` (deshabilitada, verificación 6b) con 7+ filas de auditoría append-only. Reset limpio si se confirma: `docker compose down -v && up -d postgres && pnpm --filter @devcycle/db migrate up && pnpm --filter @devcycle/db exec tsx src/seed.ts --demo`.
- `devcycle_test` y `devcycle_e2e`: efímeras, drop/create en cada `test:integration` / `e2e`. No tocar a mano. Subidos locales quedan en `apps/api/data/uploads/` (gitignored).

## 4. Comandos de recuperación

```bash
cd /mnt/datos/Programacion/AdminProject
docker compose up -d postgres
# Demo:
cd apps/api && setsid bash -c 'set -a; . ./.env; set +a; exec node dist/main.js' </dev/null > /tmp/opencode/api.log 2>&1 &
cd ../web && setsid bash -c 'exec npx next start -p 3000' </dev/null > /tmp/opencode/web.log 2>&1 &
# Tests pesados (fuera de turbo test):
cd apps/api && pnpm test:integration   # 37 tests, PG efímero (~2-3 min con fuzz 1.000)
cd ../web && API_INTERNAL_URL=http://localhost:3101 pnpm build && pnpm e2e   # ¡recordar rebuild por defecto después!
```

## 5. Decisiones y trampas de esta sesión (no repetir)

- **Los specs de integración comparten BD y «primer usuario admin_global»**: dos archivos (`api…` + `documents…`) en una sola invocación → el primero que registra es admin y el otro falla (403/404 en cascada). Decisión: **un solo** `api.integration.spec.ts` con seis `describe` (Fase 1 + Fase 2 + Fase 3 + Fase 4 + Fase 5 + Fase 6a) y agentes compartidos. La Fase 6a no añade usuarios — reutiliza `admin/outside` y productos `itest-integration-alpha/beta` — no renombrar emails.
- **E2E comparten BD e2e y admin**: la primera spec que registra es admin; `golden.spec.ts` no es idempotente (rompe si otra spec registró antes). Decisión: `z-documentacion.spec.ts`, `z-tareas.spec.ts` y `z-trazabilidad.spec.ts` corren **después** (g < p < z) y `zz-seguimiento.spec.ts` **la última de z** (zz > z-trazabilidad) con login idempotente (patrón `perf.spec.ts`) **+ retry con backoff en `z-trazabilidad`, `zz-seguimiento` y `zzz-integraciones`** (better-auth 429 con bucket compartido tras 4 specs; sin retry la 5ª/6ª/7ª falla). `zzz-integraciones` corre la última (zzz > zz) y reutiliza el mismo admin. No renombrar a algo anterior a `golden`.
- **Token en claro nunca en listados ni auditoría**: el guard redacts (`api_tokens` solo `token_hash`); `AgentAuditService` redacta args (`token`, `body`, `secret` → `[REDACTED]`) y trunca strings largos. Un test F6a-T03 verifica que ni `executions` ni `activity` contienen el token.
- **Auditoría síncrona (await)**: cada `/integration/*` hace `await audit.record()` antes de responder; con `void` (fire-and-forget) el E2E hacía `reload` antes del insert y no veía `get_product_context` en la tabla. No volver a `void` en este guard.
- **ALS no propaga del guard al handler en Nest**: se intentó `AsyncLocalStorage.enterWith(req)` en `IntegrationTokenGuard`; con Nest 11 el handler corría sin store (500 `reqProduct undefined`). Decisión: cada handler lleva `@Req() req` explícito y pasa `req.agent` a la auditoría. No reintroducir ALS/global.
- **Códigos con regex numérico**: `MOD-[0-9]{1,6}` / `TC-[0-9]{1,6}` / `TAR|INC-[0-9]{1,6}`. Los E2E y tests usan códigos numéricos (`MOD-481`, `TC-481`); `MOD-E2E` → 400.
- **Q6 por subárbol `ltree` y grafo BFS**: `issues-for-module` + overview por módulo consultan `path <@` del módulo (nodo hijo aparece al consultar el padre); `/trace/graph` ahora es BFS hasta `depth ≤ 3` (la `depth` ya no se ignora).
- **Trampas reales cazadas en Fases 5–6a (no repetir):**
  - `db.execute` devuelve `timestamptz` como **string** (`'2026-11-07 02:18:19.770305+00'`), no `Date`. En servicio raw-SQL: envolver con `new Date(...)` antes de responder/serializar o `toISOString()` fallará.
  - postgres-js **no acepta `Date` como param** (`Buffer.byteLength` → `ERR_INVALID_ARG_TYPE`). Con `sql` crudo, pasar ISO string: `${cursor.createdAt.toISOString()}::timestamptz`.
  - `tasks.due_date` es `date` en PG aunque el schema Drizzle diga `text` (`dueDate: text('due_date')`). `coalesce(due_date, '')` → 22007 invalid input; usar `coalesce(due_date::text, '')`.
  - BOM en fuente: escribir `\uFEFF` en código (`\uFEFF` en string), nunca el carácter literal (eslint `no-irregular-whitespace`).
  - E2E `getByText` con substring pisa el KPI y el panel («Tareas bloqueadas» aparece dos veces): usar `{ exact: true }` para el KPI o `.first()`. En 6a, el selector de token debe ser `code` con regex `^dvc_[A-Za-z0-9_-]{20,}$` para no pisar el hint `devcycle-mcp --token dvc_…`.
- **Sweep sin SQL dinámico peligroso**: `sql.raw(tableName)` solo sobre la lista cerrada de 6 identificadores internos (nunca input del usuario); el resto de la API usa parámetros Drizzle.
- **Regla de Fase 1 (no repetir):** esbuild/Vite no soporta `emitDecoratorMetadata` (SWC en integración); `request.agent(fn)` cuelga; Next hornea rewrites en build (E2E: `API_INTERNAL_URL` en build **y** start); `retries: 0` por el primer-usuario-admin. Ver §1 F1 y commit Fase 1.
- **MCP (6b, no repetir):** `@modelcontextprotocol/sdk` 1.32 + **zod v3** → `TS2589` (inhibición infinita) en `registerPrompt`/`registerTool` (repro mínimo: `mini.ts` de 4 líneas). Solución: `zod ^4` local en `@devcycle/mcp-server` (aislado por pnpm; `@devcycle/shared` sigue en v3 y solo aporta constantes). Además: `new URL(path, base)` pisa el path — usar ``new URL(`${base}${path}`)`` con `base` sin `/` final; y con `exactOptionalPropertyTypes`, los params zod `{ x?: string }` exigen `x?: string | undefined` en el helper. pnpm en este PC exige `--store-dir=/run/media/leonardo/Datos/.pnpm-store/v10` (si no, error `ERR_PNPM_UNEXPECTED_STORE` o limpieza lenta de `node_modules`).

## 6. Referencias

- Plan: `docs/planificacion/07-plan-implementacion.md` §7 (F6b-T01…T05) y criterios de fase §7; backlog `10-backlog-inicial.md` (M-09, E9).
- Integración: `apps/api/src/integration-api/` (guard + token service + audit + context + controllers + module) · `apps/api/src/integration/api.integration.spec.ts` (37 tests). MCP: `apps/mcp-server/` (tools/resources/prompts + `scripts/test-stdio.cjs` + `src/mcp-server.spec.ts`) · guía `docs/agentes/conectar-claude-code.md`. E2E: `apps/web/{playwright.config.ts,e2e/}` (golden + perf + `z-documentacion` + `z-tareas` + `z-trazabilidad` + `zz-seguimiento` + `zzz-integraciones`). API: `apps/api/src/bootstrap.ts` (OpenAPI `integration-v1`). UI: `apps/web/src/{components/integraciones-view.tsx,app/(app)/products/[slug]/integraciones/page.tsx}`. Migraciones: `packages/db/migrations/0007_integration.*` + `0008_node_functional.*`.
- ADRs: `docs/adr/ADR-001..007` (ADR-007: API de integración read-only con service tokens). Mockup (intocable): `muckup/`. CI: `.github/workflows/ci.yml` (4 jobs).
