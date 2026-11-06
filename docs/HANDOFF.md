# HANDOFF — DevCycle (AdminProject) · 2026-11-06 (5ª sesión)

> **Estado:** Fase 1 · Fundamentos — **CERRADA (criterios cumplidos en local)**. Integración API+PG **verde (7/7, fuzz de 1.000 movimientos)** y **E2E Playwright verde** (camino dorado + presupuesto TTI). CI con 4 jobs (`build-test`, `db-migrations`, `integration-tests`, `e2e`). `lint`/`typecheck`/`test`/`build`/`format:check` verdes en el workspace.
> **Servidores demo vivos:** web `:3000` (proxy → :3001), API `:3001`. BD `devcycle` con seed demo prístino en usuarios (0 usuarios hasta registrar el primero, que recibe `admin_global`).
> **Entornos efímeros:** `devcycle_test` (integración API, la recrea su globalSetup) · `devcycle_e2e` (E2E, la recrea su globalSetup).

## 0. Qué es el proyecto

Plataforma de gestión del ciclo de vida del software (multiproducto, trazabilidad funcional, agentes IA vía MCP). Brief en `prompt.md`; plan en `docs/planificacion/` (12 docs). Mockup UX aprobado en `muckup/` (**intocable** — `apps/web/src/app/globals.css` es su puerto fiel). Desarrollo según `docs/planificacion/07-plan-implementacion.md`, **Fase 1 · Fundamentos**.

## 1. Hecho y verificado ✅ (acumulado Fases 1-T01…T12 + esta sesión)

### Raíz / monorepo / CI — esta sesión: `integration-tests` y `e2e` (4 jobs)

- `.github/workflows/ci.yml`: jobs `build-test` · `db-migrations` · **`integration-tests`** (PG 16 service → build shared+db → `pnpm --filter @devcycle/api test:integration`) · **`e2e`** (PG 16 service → build con `API_INTERNAL_URL=http://localhost:3101` horneada → `npx playwright install --with-deps chromium-headless-shell` → `pnpm --filter @devcycle/web e2e`). YAML validado.
- `pnpm test:integration` (api) y `pnpm e2e` (web) ejecutan sus suites **fuera** de `turbo test` (las BD efímeras se autogestionan).

### `apps/api` — integración API+PG **verde (7 tests, incl. fuzz 300 movimientos)** — esta sesión

Causas raíz diagnosticadas y corregidas (todas verificadas):

1. **`emitDecoratorMetadata` no existe en esbuild/Vite** (docs oficiales) → la DI de Nest resolvía `undefined` en runtime (`SessionGuard.reflector` → TypeError → 500). Fix: transform de integración con **SWC** (`unplugin-swc` + `@swc/core`, `legacyDecorator` + `decoratorMetadata`) en `vitest.integration.config.ts`.
2. **`request.agent(fn)` de supertest interpreta la función como request-listener** (crea `http.Server(fn)` que nunca responde) → toda petición con agente colgaba para siempre (el síntoma "cuelga tras request id=2"). Fix: agentes creados en `beforeAll` pasando **el servidor real** (`request.agent(app.getHttpServer())`).
3. **POST de acción devolvía 201** (default Nest) → `move` y `deactivate` ahora `@HttpCode(200)` (semántica REST correcta; el spec y la API coherentes).
4. Handler crudo better-auth: si better-auth lanza, responder **500 JSON** en vez de colgar (blindaje en `bootstrap.ts`; jamás dejar la petición sin respuesta).
5. Spec corregido a la realidad: códigos de nodo (`MOD-1`, regex del schema), anti-ciclo sobre PANT-11 (COMP-11 se movió a raíz antes), duplicado zero-padded (`MOD-02`). El "hang" del worker era en realidad el test del agente supertest colgado (nunca el código de dominio).

Suite: `src/integration/api.integration.spec.ts` — health · 401 problem+json · seed demo · CRUD+move+duplicate+deactivate (ltree íntegro) · FND-SEC tenant-escape (403 sin membresía; viewer lee sí/escribe no) · **fuzz determinista de 300 moves (mulberry32)** con invariantes cada 25 iteraciones (path único, padre-hijo conexo, profundidad consistente). ~60–70 s en frío.

### `apps/web` + `e2e/` — **FND-E2E verde** — esta sesión

- `playwright.config.ts`: API `:3101` (dist/main.js) + web `:3100` (`next start`) como `webServer`; `retries: 0` (la spec no es idempotente: el PRIMER registro recibe `admin_global` y la BD solo se recrea por invocación).
- `e2e/global-setup.ts`: drop/create **`devcycle_e2e`** → `migrate up` → seed demo (0 usuarios). Valida nombre de BD (identificador SQL simple).
- `e2e/golden.spec.ts` — **camino dorado FND-E2E**: registro (primer usuario → admin_global) → Productos visibles (Kanora/Verdana/Núcleo del seed) → crear producto desde la UI (modal solo admin) → crear módulo vía API con la cookie del contexto → **nodo visible en Arquitectura funcional** → árbol real de kanora (MODULO-01) → logout → /login. ~35 s.
- **Trampas documentadas:** las rewrites de Next se hornean en `next build` (`.next/routes-manifest.json`) → el build E2E exige `API_INTERNAL_URL=http://localhost:3101`; **y** los RSC leen `API_INTERNAL_URL` en **runtime** (`lib/api.ts`, no horneada) → el `next start` del E2E la recibe también en env. Sin la runtime, las fetches SSR van a la demo :3001 → 401 → redirect /login (síntoma: heading "Productos" ausente).
- `vitest.config.ts` en web: unitarios **solo** `src/**` (playwright no es vitest).

### Cierre de Fase 1 — esta sesión

- **Fuzz de 1.000 movimientos** (plan 07 §2 / 08 §2): `apps/api/src/integration/api.integration.spec.ts` — 1.000 ops deterministas (mulberry32) con invariantes cada 25 y timeout de 15 min; verde en 109 s. Parametrizable con `MOVE_FUZZ_OPS` / `MOVE_FUZZ_CHECK_EVERY`. `hookTimeout` de integración a 10 min (`vitest.integration.config.ts`) y `timeout-minutes: 20` en el job de CI.
- **F1-T08 · TTI < 1.5 s**: `apps/web/e2e/perf.spec.ts` — login/registro vía API (idempotente respecto a `golden.spec.ts`), navegación a `/products` sobre `next start` de producción y aserción `domContentLoaded < 1500 ms` + contenido real visible. Medido: **≈ 91 ms**.
- **Calidad de formato**: `pnpm format:check` ahora verde en todo el repo (antes 47 archivos con drift). `.prettierignore` excluye `muckup/` (mockup intocable), `prompt.md` y lockfiles/workspace.
- README actualizado (web entregada, comandos, fuzz 1.000, format).

### Resto acumulado (Fase 1-T01…T12) — sin cambios esta sesión

Monorepo+CI · packages/db (migraciones up/down reversibles, seed idempotente) · packages/shared (zod, RFC 9457) · packages/ui (Tree/DataTable/Tabs/… · 25 tests · cobertura 94,9%) · better-auth (sesiones PG, cookie HttpOnly, primer usuario admin_global) · RBAC (admin_global/admin_product/collaborator/viewer + permissions granulares + productGuard) · products CRUD + miembros · nodes CRUD + move/duplicate/deactivate (ltree, anti-ciclo, serializable) · apps/web (Productos con KPIs reales, Resumen, Arquitectura funcional read-only, paleta Ctrl+K, login/signup/logout) · demo seeds (kanora/verdana/nucleo).

## 2. Pendiente inmediato (en este orden)

### A · CI verde en GitHub

Remoto configurado: `https://github.com/leoCortes123/AdminProject.git` (5ª sesión, primer push). Falta confirmar los 4 jobs en GitHub Actions (`build-test` · `db-migrations` · `integration-tests` · `e2e`). Riesgo bajo; revisar logs del job `e2e` (install de chromium-headless-shell con `--with-deps` usa sudo del runner — permitido en GH Actions).

### B · Criterios de aceptación de fase (§2 de 07-plan) — **todos cumplidos en local**

1. ✅ login real · ✅ crear 2 productos aislados · ✅ árbol operativo (ltree íntegro, **fuzz 1.000** — `apps/api/src/integration`, ~110 s) · ✅ demo seed (`pnpm demo` en 5 min) · ✅ strict limpio · ✅ build/lint/typecheck/unit/integration/e2e verdes.
2. ✅ **TTI < 1.5 s en Productos** — medido por `apps/web/e2e/perf.spec.ts` sobre el build de producción: **≈ 91 ms** (presupuesto 1.500 ms; el test falla si se supera).
3. Tokens/scopes → Fase 6a, fuera de scope de Fase 1.
4. ⏳ Solo queda **CI verde en GitHub** (ver A).

### C · Deuda menor conocida

- `apps/web`: el context switcher (`AppShell`) quedó corregido (`useEffect` + `startTransition`, commit `3aee6b5`); validar visualmente en la demo.
- KPIs de Productos no cubren "Tareas/Incidencias" (llegan en Fases 3–5) — etiquetados honestamente como Fase 1.
- `Integrantes` lista membresías `product_members` explícitas; `admin_global` no aparece (acceso implícito) — correcto aunque confunda en demo.
- API: rate-limit de better-auth bajo proxy sin IP (warning cosmético; configurar `advanced.ipAddress` si se pone tras proxy real).
- Rewrites horneadas en build: **tras correr E2E local, reconstruir la web con env por defecto** (`pnpm --filter @devcycle/web build`) para que la demo proxye a :3001. (Esta sesión ya dejó la web reconstruida por defecto y :3000 vivo.)
- pnpm en este PC: instalar con `CI=true pnpm --store-dir=/run/media/leonardo/Datos/.pnpm-store/v10 …`.
- **Nunca** `pkill -f` con cadenas que aparezcan en la propia shell — PIDs en `/tmp/opencode/*.pid` o `ss -ltnp`.
- `pnpm format` reescribía el mockup (intocable) y `prompt.md` → ahora `.prettierignore` los excluye; si se añade tooling nuevo, comprobar que no toque `muckup/`.
- Fuzz de integración parametrizable: `MOVE_FUZZ_OPS=100 pnpm test:integration` para una pasada rápida en local (CI y por defecto: 1.000).

## 3. Estado de las BDs

- `devcycle` (demo): 3 productos, 10 nodos kanora, **0 usuarios**. Reset limpio: `docker compose down -v && up -d postgres && pnpm --filter @devcycle/db migrate up && pnpm --filter @devcycle/db exec tsx src/seed.ts --demo`.
- `devcycle_test` y `devcycle_e2e`: efímeras, drop/create en cada `test:integration` / `e2e`. No tocar a mano.

## 4. Comandos de recuperación

```bash
cd /mnt/datos/Programacion/AdminProject
docker compose up -d postgres
# Demo:
cd apps/api && setsid bash -c 'set -a; . ./.env; set +a; exec node dist/main.js' </dev/null > /tmp/opencode/api.log 2>&1 &
cd ../web && setsid bash -c 'exec npx next start -p 3000' </dev/null > /tmp/opencode/web.log 2>&1 &
# Tests pesados (fuera de turbo test):
cd apps/api && pnpm test:integration   # 7 tests, PG efímero
cd ../web && API_INTERNAL_URL=http://localhost:3101 pnpm build && pnpm e2e   # ¡recordar rebuild por defecto después!
```

## 5. Decisiones y trampas de esta sesión (no repetir)

- **esbuild/Vite NO soporta `emitDecoratorMetadata`** → DI de Nest rota en runtime bajo vitest aunque el tipochequeo pase. Fix de referencia: SWC con `legacyDecorator`+`decoratorMetadata` (o probar el artefacto compilado).
- **`request.agent(fn)`** en supertest ≠ factory: `fn` es el request-listener (nunca responde) → "cuelga para siempre". Pasar el `http.Server` real.
- **Playwright arranca `webServer` ANTES que `globalSetup`** → la API bootea contra la BD aún inexistente (health 503) y los tests esperan a que tenga datos; funciona porque el health-check de Playwright reintenta, pero no asumir orden contrario.
- **Next hornea `rewrites` en build** y RSC leen env en runtime → el E2E necesita `API_INTERNAL_URL` **en ambos** (build y start), apuntando a :3101.
- **Retries de Playwright y "primer usuario admin_global"** son incompatibles en un retry → `retries: 0` por diseño.
- Seeds/migraciones son idempotentes; el reset duro (`down -v`) sigue siendo la única vía si hay usuarios de prueba con historia (`activity_log` es append-only).
- El diagnóstico real salió de **loguear la excepción en el filtro global** y del `grep` de la red — ojo con "cuelgues" que son en realidad tests fallidos que nunca reciben respuesta.

## 6. Referencias

- Plan e implementación: `docs/planificacion/07-plan-implementacion.md` §2 (F1-T01…T12). Criterios de fase §2.
- Estrategia de pruebas: `docs/planificacion/08-estrategia-pruebas.md` §3–4 (FND-U/I/E2E/SEC/MIG — todos implementados y verdes).
- ADRs: `docs/adr/ADR-001..005`. Mockup (intocable): `muckup/`.
- CI: `.github/workflows/ci.yml` (4 jobs). E2E: `apps/web/{playwright.config.ts,e2e/}` (golden + perf). Integración: `apps/api/src/integration/`.
