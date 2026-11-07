# HANDOFF — DevCycle (AdminProject) · 2026-11-07 (6ª sesión)

> **Estado:** Fase 2 · Conocimiento — **CERRADA (criterios cumplidos en local)**. Integración API+PG **verde (15/15, incluye fuzz de 1.000 movimientos de Fase 1)** y **E2E Playwright verde (3/3: golden + perf + documentación)**. `lint`/`typecheck`/`test`/`build`/`format:check` verdes en el workspace. Fase 1 sigue intacta y verde.
> **Servidores demo vivos:** web `:3000` (proxy → :3001, web reconstruida por defecto), API `:3001`. BD `devcycle` con seed demo (3 productos, árbol + 3 documentos kanora) y **1 usuario existente** (`drleocortex@gmail.com`, admin) — no resetear a mano sin confirmación.
> **Entornos efímeros:** `devcycle_test` (integración API, la recrea su globalSetup) · `devcycle_e2e` (E2E, la recrea su globalSetup).

## 0. Qué es el proyecto

Plataforma de gestión del ciclo de vida del software (multiproducto, trazabilidad funcional, agentes IA vía MCP). Brief en `prompt.md`; plan en `docs/planificacion/` (12 docs). Mockup UX aprobado en `muckup/` (**intocable** — `apps/web/src/app/globals.css` es su puerto fiel). Desarrollo según `docs/planificacion/07-plan-implementacion.md`, **Fase 2 · Conocimiento (M-03)**.

## 1. Hecho y verificado ✅ (Fase 2: F2-T01…T09; Fase 1 intacta)

### F2-T01 · Esquema + migración `0003_documents` (up/down + seed idempotente)

- `packages/db/migrations/0003_documents.{up,down}.sql`: `content_items` (status/scope CHECK, código parcial-único, `search_tsv` + GIN, FKs compuestas `(id, product_id)`), `item_versions` (UNIQUE + append-only vía `forbid_mutation()` de 0002), `item_node_links` (N:M + trigger valida mismo producto), `relations` base (kinds 6 en CHECK pero trigger valida **node/item**; resto se endurece en Fases 3–4), `comments` base (`parent_kind=item`; Fase 3 extiende), `attachments` (`owner_kind=item`, ver F2-T05). Down probado (`migrate down` → `up`).
- `search_tsv` con **trigger** (`to_tsvector` no es IMMUTABLE, no cabe en GENERATED); `document_types` ya traía los 13 del prompt §5.3 (con `adr` incluido): el "14 (13+adr)" del plan 07 §3 **no se aplica** — prompt y seed coinciden en 13, añadir uno duplicaría. Decisión documentada aquí.
- Modelos Drizzle en `packages/db/src/schema.ts`; esquemas zod compartidos + `DOCUMENT_SCOPES`/`ATTACHMENT_*` en `packages/shared`.

### F2-T02…T03 · CRUD con estados + versionado (F2-T09: 409 concurrente)

- `apps/api/src/documents/` — `documents.service.ts` (CRUD, transiciones, publish, versions, vínculos), `document-transitions.ts` (máquina pura: draft→in_review→published→archived, `canTransition`, unit-testeada), `documents.controller.ts` (incl. `NodeDocumentsController` para `GET nodes/:code/documents` — pestaña de ficha), `documents.module.ts`.
- Semántica (documentada en OpenAPI): crear → draft + snapshot **v1**; `PATCH` edita el trabajo en curso **sin** crear versión; `POST :id/versions` congela snapshot (opt. `expectedVersion`); `POST :id/publish` exige `@Permissions('docs:publish')`, congela la siguiente versión y marca `published` (desde draft cruza in_review; desde published re-publica v+1 — el flujo de aceptación v1→v2). Editar/publicar con `expectedVersion` obsoleto (o UNIQUE 23505) → **409 `document.version_conflict`**. Versiones inmutables por trigger + sin endpoint UPDATE/DELETE.
- Permisos: lectura `docs:read` (viewer incluido); crear/editar/vincular/subir `docs:write`; publicar `docs:publish` (guard en `/publish` + comprobación en servicio en `/transition` para publicar por ahí). Todas las escrituras emiten `activity_log` (`doc.created/updated/transitioned/published/version_published/version_created/deleted/node_linked/…, relation.added/removed`).

### F2-T04 · Editor CodeMirror 6 + preview sanitizada + autosave local + diff

- `apps/web/src/components/markdown-editor.tsx` (CodeMirror 6 + `markdown()` + wrap; controlado) y `docs-view.tsx` (modo Editar ↔ Vista previa, autosave local en `localStorage` con debounce 500 ms, banner de borrador sin guardar).
- `lib/markdown.ts`: `unified().use(remarkParse).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify)` — HTML crudo nunca se interpreta (`allowDangerousHtml: false` por defecto); unit tests XSS (script/javascript:/on*). `lib/diff.ts`: `diffLines` (paquete `diff`, no `jsdiff` — ver §5) con timeline, radios "desde/hasta vN" y panel +N/−N.
- Vista Documentación paridad mockup (§5.3): `view-head` + `filter-bar` (tipo/estado/búsqueda) + `split-list-detail` (`.doc-item` + preview + `Historial de versiones` timeline) + pestaña Documentación de la ficha con contador real. Ruta `/products/[slug]/documentacion`; sidebar habilitada; entrada de docs en paleta Ctrl+K; exportar a Markdown (Blob).

### F2-T05 · Adjuntos — StoragePort (FS dev / S3 SDK prod)

- `apps/api/src/attachments/`: `storage.port.ts` (`STORAGE_PORT {put,get,delete}`), `filesystem.storage.ts` (traversal-safe, `UPLOADS_DIR`, defecto `apps/api/data/uploads/`), `s3.storage.ts` (`@aws-sdk/client-s3`, env `S3_*`, MinIO `forcePathStyle`), fábrica `S3_BUCKET ? S3 : FS`. Servicio valida allowlist MIME + tamaño 15 MB + magic-bytes + SVG sanitizado (`svg-sanitize.ts`, unit-testeado); si la fila no se guarda tras `put`, compensa borrando el binario. Descarga **siempre** `Content-Disposition: attachment` + `CSP: default-src 'none'; sandbox` + `nosniff`. Endpoints `POST/GET /attachments` + `GET :id/download` + `DELETE :id` (multipart vía `FileInterceptor`).
- Dependencias añadidas: `@aws-sdk/client-s3` (api); web: `@codemirror/*`, `unified`, `remark-parse`, `remark-rehype`, `rehype-sanitize`, `rehype-stringify`, `diff` + `@types/diff`.

### F2-T06 · Vínculos doc↔nodo y doc↔doc

- `item_node_links`: `POST/DELETE /documents/:id/nodes[/:nodeCode]` + `GET :id/nodes`; código de nodo inexistente → **422 problem+json** (prevalidación + trigger). `relations`: `POST /documents/:id/relations` (target item mismo producto, anti-auto-relación, duplicado → 409) + `GET ?direction=out|in|both` + `DELETE :id/relations/:relationId`. La Fase 4 endurecerá `relations` (triggers para task/issue/change/test_case + 7 consultas `/trace/*`).

### F2-T07 · Búsqueda global v1 (FTS español + códigos)

- `apps/api/src/search/` — `GET /products/:slug/search?q=&kinds=document&limit=` con `websearch_to_tsquery('spanish', …)` + `ts_rank` + fallback `ILIKE` (código/título) + código del nodo vinculado. "PANT-02" (o `PANT-51`) y "asignación" encuentran el documento (integración). La búsqueda global completa de Fase 5 reutiliza `search_tsv`.

### F2-T08…T09 · Pruebas

- Integración ampliada **dentro del único** `api.integration.spec.ts` (ver §5: dos archivos comparten BD y "primer usuario admin_global" → carrera): 8 tests F2 (catálogo 13 · CRUD + visible en ambos lados · transiciones · v1→v2→publish v3 · 422/409 vínculos · adjuntos + headers · FTS · F2-SEC outsider 403 + collaborator escribe-pero-no-publica). Total **15/15** (~132 s con fuzz 1.000). Unitarios: `document-transitions.spec.ts` (5), `svg-sanitize.spec.ts` (3), `markdown.spec.ts` (3, XSS), `diff.spec.ts` (2).
- E2E `z-documentacion.spec.ts` (crear vía UI vinculado a PANT-02 → publicar con `dialog.accept()` → Vigente → visible en ficha): **3/3 verde** (~42 s; golden 3,0 s, perf 114 ms). Seed demo: 3 documentos kanora (`DOC-101` vigente multi-nodo v2, `DOC-118` vigente, `DOC-124` en revisión; idempotente por código).

### Resto acumulado (Fase 1, sin cambios)

Monorepo+CI (4 jobs) · `packages/db` (migraciones reversibles) · `packages/shared` · `packages/ui` · better-auth · RBAC + guards · products + nodes (ltree) · web Fase 1 (Productos, Resumen, Árbol read-only, Ctrl+K, login) · demo seeds. Cliente de API compartido (SSR con cookie + proxy Next) y `ProductGuard`/`PermissionsGuard` reutilizados tal cual para documentos/adjuntos/search (tenant-escape por construcción).

## 2. Pendiente inmediato (en este orden)

### A · CI verde en GitHub — ⚠️ bloqueado por la cuenta de GitHub (no por el código)

**Push hecho en Fase 1** (2026-11-06, run [42292587175](https://github.com/leoCortes123/AdminProject/actions/runs/42292587175)): los 4 jobs arrancan pero **ninguno se ejecuta** — GitHub responde _"The job was not started because your account is locked due to a billing issue"_ (repo público, `allowed_actions: all`, token con `repo`+`workflow`: no es el `ci.yml`).

**Qué hacer (solo el dueño de la cuenta puede):** `https://github.com/settings/billing` (regularizar método de pago / cuota) → `…/billing/payment-history` (pago fallido) → tras desbloquear, `gh workflow run CI` y confirmar los 4 jobs verdes. Todo lo que ejecuta la CI está verificado en local: `lint` · `typecheck` · `test` · `build` · `format:check` · migraciones up/down + seed idempotente (incl. docs demo) · integración 15/15 (fuzz 1.000) · E2E 3/3.

### B · Criterios de aceptación de Fase 2 (§3 de 07-plan) — **todos cumplidos en local**

1. ✅ Publicar DOC v1→v2 y ver diff (timeline + diff v3/v2 en UI; integración v1→v2→v3). ✅ 13 tipos operativos. ✅ Doc a N nodos visible en ambos (listado + ficha). ✅ Búsqueda ("asignación" y código de nodo) devuelve resultados. ✅ Publicación requiere permiso (403 a collaborator/viewer). ✅ Adjunto servido de forma segura (attachment + CSP + SVG malicioso 422).
2. ⏳ Solo queda **CI verde en GitHub** (ver A).

### C · Deuda menor conocida (sin bloquear Fase 3)

- Editor/diff/sanitizado pasan unitarios + E2E; el bundle de `/documentacion` es ~230 kB (CodeMirror): el presupuesto TTI < 1,5 s solo cubre Productos (F1-T08), pero vigilar si se añade más tooling.
- `app-shell`: entradas Tareas/Incidencias/Modificaciones/Trazabilidad/Seguimiento/Agentes/Config siguen en "Pronto" (Fases 3–6) — correcto.
- `relations`/`comments`/`attachments` validan hoy solo kinds `node/item`; task/issue/change/test_case llegan en Fases 3–4 (documentado en migración).
- API: rate-limit de better-auth bajo proxy sin IP (warning cosmético; `advanced.ipAddress` si hay proxy real). pnpm en este PC: `CI=true pnpm --store-dir=/run/media/leonardo/Datos/.pnpm-store/v10 …` (sin el store-dir falla: node_modules enlazado desde `/run/media/…`).
- ✅ Web reconstruida por defecto tras E2E (`pnpm --filter @devcycle/web build` → proxy :3001) y demo :3000 vivo.
- **Nunca** `pkill -f` con cadenas de la propia shell; `pnpm format` no toca `muckup/` (`.prettierignore`).

## 3. Estado de las BDs

- `devcycle` (demo): 3 productos, árbol kanora, **3 documentos kanora** (`DOC-101` v2 vigente, `DOC-118` v1 vigente, `DOC-124` v1 en revisión) y **1 usuario** (el dueño, admin — ⚠️ no resetear sin confirmación; `down -v` borraría su usuario e historia). Reset limpio si se confirma: `docker compose down -v && up -d postgres && pnpm --filter @devcycle/db migrate up && pnpm --filter @devcycle/db exec tsx src/seed.ts --demo`.
- `devcycle_test` y `devcycle_e2e`: efímeras, drop/create en cada `test:integration` / `e2e`. No tocar a mano. Subidos locales quedan en `apps/api/data/uploads/` (gitignored).

## 4. Comandos de recuperación

```bash
cd /mnt/datos/Programacion/AdminProject
docker compose up -d postgres
# Demo:
cd apps/api && setsid bash -c 'set -a; . ./.env; set +a; exec node dist/main.js' </dev/null > /tmp/opencode/api.log 2>&1 &
cd ../web && setsid bash -c 'exec npx next start -p 3000' </dev/null > /tmp/opencode/web.log 2>&1 &
# Tests pesados (fuera de turbo test):
cd apps/api && pnpm test:integration   # 15 tests, PG efímero (~2 min con fuzz 1.000)
cd ../web && API_INTERNAL_URL=http://localhost:3101 pnpm build && pnpm e2e   # ¡recordar rebuild por defecto después!
```

## 5. Decisiones y trampas de esta sesión (no repetir)

- **Los specs de integración comparten BD y "primer usuario admin_global"**: dos archivos (`api…` + `documents…`) en una sola invocación → el primero que registra es admin y el otro falla (403/404 en cascada). Decisión: **un solo** `api.integration.spec.ts` con dos `describe` (Fase 1 + Fase 2) y agentes compartidos.
- **E2E comparten BD e2e y admin**: la primera spec que registra es admin; `golden.spec.ts` no es idempotente (rompe si otra spec registró antes). Decisión: `z-documentacion.spec.ts` corre **después** (g < p < z) con login idempotente (patrón `perf.spec.ts`). No renombrar a algo anterior a `golden`.
- **`unified().processSync` sin compilador**: el pipeline Markdown exige `rehype-stringify` para la salida HTML; sin él → `Cannot processSync without compiler` (vitest lo manifestó, `next build` no lo avisó).
- **`jsdiff` no tiene `@types/jsdiff`** (registry 404 y paquete obsoleto v1): se usa **`diff`** (+ `@types/diff`). Los docs del plan dicen "jsdiff" genéricamente.
- **Regex de código documental**: `DOC-nnn` numérico obligatorio (`/^[A-Z][A-Z0-9_]{0,15}-[0-9]{1,6}$/`); `DOC-E2E` → 400. Los demo usan `DOC-101/118/124` (números, como el mockup).
- **E2E locators**: el título aparece en lista + preview (strict mode) → `.first()`; "Vigente" también es `<option>` del filtro (hidden) → asertar **dentro** de `.doc-item`.
- **`search_tsv` debe ser por trigger**, no GENERATED (`to_tsvector` es STABLE, no IMMUTABLE). FTS + fallback `ILIKE` + nodos vinculados cubre códigos con guion (`PANT-02`).
- **Regla de Fase 1 (no repetir):** esbuild/Vite no soporta `emitDecoratorMetadata` (SWC en integración); `request.agent(fn)` cuelga; Next hornea rewrites en build (E2E: `API_INTERNAL_URL` en build **y** start); `retries: 0` por el primer-usuario-admin. Ver §1 F1 y commit Fase 1.

## 6. Referencias

- Plan: `docs/planificacion/07-plan-implementacion.md` §3 (F2-T01…T09) y criterios de fase §3; backlog `10-backlog-inicial.md` (M-03).
- Técnica/datos: `04-modelo-datos.md` §4.3–4.5 y §6–§7 (relations/triggers), `03-arquitectura-tecnica.md` §4.6–4.7 (editor + StoragePort), `08-estrategia-pruebas.md` §3 (concurrencia 409, tenant-escape).
- Integración: `apps/api/src/integration/api.integration.spec.ts` (15 tests). E2E: `apps/web/{playwright.config.ts,e2e/}` (golden + perf + `z-documentacion`). Migración: `packages/db/migrations/0003_documents.*`.
- ADRs: `docs/adr/ADR-001..005`. Mockup (intocable): `muckup/`. CI: `.github/workflows/ci.yml` (4 jobs).
