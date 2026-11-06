# HANDOFF — DevCycle (AdminProject) · 2026-11-06 (3ª sesión)

> **Estado:** Fase 1 · Fundamentos — **≈70–75% completada**. `apps/web` (F1-T08) y `packages/ui` (F1-T09) **terminadas y verificadas manualmente en navegador real** (login, sign-up con auto-admin_global, Productos, Resumen, Arquitectura funcional con árbol LTREE real, paleta Ctrl+K, toast, logout). `lint`/`typecheck`/`test`/`build` del workspace **verdes**.
> **Sinjo prístino de demo:** BD re-sembrada (3 productos, 10 nodos, **0 usuarios**). Web en `:3000`, API en `:3001`, ambas con `setsid`.
> **⚠ Roto/no verificado:** la suite de **integración API+PG** (`apps/api/src/integration/`) está escrita pero NO verde — ver §3/§5.

## 0. Qué es el proyecto

Plataforma de gestión del ciclo de vida del software (multiproducto, trazabilidad funcional, agentes IA vía MCP). Brief en `prompt.md`; plan en `docs/planificacion/` (12 docs). Mockup UX aprobado en `muckup/` (**intocable** — `apps/web/src/app/globals.css` es su puerto fiel). Desarrollo según `docs/planificacion/07-plan-implementacion.md`, **Fase 1 · Fundamentos**.

## 1. Hecho y verificado ✅ (acumulado Fases 1-T01…T09)

### Raíz / monorepo / CI

- CI en `.github/workflows/ci.yml` (jobs `build-test`: lint+typecheck+unit+build; `db-migrations`: up→down --all→up + seed ×2 + sanity psql contra PG 16 service).
- `pnpm demo` arreglado: `up postgres → migrate → seed --demo` + mensaje de siguientes pasos.
- Prettier/ESLint raíz funcionan con import relativo (evita resolver el enlace inexistente).
- `.github/workflows/ci.yml` YAML válido; sin secrets requeridos.

### `packages/ui` ✅ (F1-T09) — nuevo esta sesión

Componentes portados del mockup (className global del design system, sin CSS propio): **Tree** (teclado completo, modo controlado, `collectExpandableIds`), **DataTable**, **Pill**, **Tabs** (ARIA tablist/tab), **EmptyState**, **CommandPalette** (filtro ANDeado, ↑↓/Enter/Esc, click-fuera).

- 25 tests @testing-library/react + jsdom, **cobertura 94.9%** (umbral ≥70% configurado en `vitest.config.ts` con `--coverage`), scripts `test` + `test:coverage`.
- Fix: el cleanup de Testing Library exige `setupFiles` (`src/test.setup.ts`) cuando vitest corre sin `globals`.
- Decisión: `CSP/STRICTS` del mockup respetados; `packages/ui` documentado como "clases globales": el consumidor importa el CSS global.

### `apps/web` ✅ (F1-T08) — nuevo esta sesión

Next.js 15 (App Router, React 19, proxy `/api/*` → API `API_INTERNAL_URL`, fallback `http://localhost:3001`):

- Shell del mockup portado: sidebar (brand, context switch org↔producto, navegación `Pronto`-disabled para vistas F2+), topbar (breadcrumb, buscador, avatar, Cerrar sesión), toast, org-banner, selección `?node=CODE` en la URL del árbol.
- **Login** (`/login`, tabs Entrar/Crear cuenta) + `better-auth/react` client (`/api/auth`, same-origin vía proxy). Middleware exige cookie `better-auth.session_token` (o `__Secure-`) → redirect a `/login?next=…`; `/login` con sesión → `/products`.
- **Productos** (vista org): tabla clicable (→ resumen), KPIs reales computados en servidor (nodos, estado, integrantes), botón **Nuevo producto** (modal, solo admin_global) — verificado en navegador: `e2e-demo` creado, API responde OK.
- **Resumen**: hero real (nombre, estado, stack, rol), descripción (EmptyState honesto), repo, avance por módulo calculado desde nodos (`done`/`total` descendientes), integrantes reales.
- **Arquitectura funcional** (read-only): árbol desde la API, filtro por tipo con conteo, expandir/contraer, leyenda real, ficha con pestañas (Resumen con KV reales + tabs vacías Fase 2/3/4 con EmptyState honestos).
- Ctrl+K paleta (navegación + nodos del producto en contexto; carga perezosa del árbol).
- Verificado en navegador real: sign-up (primer usuario → `admin_global`), login, logout, POST producto vía UI, navegación completa, `?node=PANT-02` compartible.

### `apps/api` (previo + cambios de hoy)

- **Refactor bootstrap**: `src/bootstrap.ts#createNestApp()` comparte el wiring exacto (helmet → better-auth crudo → body-parser → CORS → prefijo `/api/v1` → Swagger) entre `main.ts` y tests de integración.
- `apps/api/vitest.config.ts` (unitarios; **excluye** `*.integration.spec.ts`) · `vitest.integration.config.ts` (opt-in, `globalSetup` con drop/create+seed de `devcycle_test`) · `src/integration/` con la suite escrita (health, 401, RBAC viewer, CRUD+move+duplicate+deactivate, tenant-escape v1, **fuzz de 300 moves**).
- BD de test humilde: `devcycle_test` efímera, recreada en cada `test:integration`.

### API + web vivas para la demo

- API `:3001` (`dist/main.js` vía `setsid`, log `/tmp/opencode/api.log`) · Web `:3000` (`next start`, log `/tmp/opencode/web.log`). BD prístina.

## 2. Pendiente inmediato (retomar por aquí, en este orden)

### A · Diagnosticar y cerrar la suite de integración API (ROTO)

Síntoma: worker vitest cuelga tras la 1ª petición; `GET /api/v1/products` → **500 `responseTime:0`** (en curl con env idéntico → **401 correcto**; sign-up admin@itest.dev funciona). Los tests no fallan por assert — el proceso se queda parado tras request id=2 (health, auto-log off).

- Sospecha principal: **better-auth bajo el transform de Vite** → `auth.api.getSession` lanza en el worker. Posibles arreglos:
  1. `vitest.integration.config.ts`: `server: { deps: { inline: ['better-auth'] } }` o `deps: { interopDefault: true }`.
  2. Alternativa robusta: tests de integración con **`node --test`** contra `dist/main.js` spawneado (evita Vite por completo) o curl-driven asserts en bash.
  3. Aislar en un repro mínimo: `it('401', …)` solo con `request(app.getHttpServer()).get('/api/v1/products')` y loguear el error del guard (intercalar try/catch en `SessionGuard` con `console.log` temporal, después quitarlo).
- `apps/api/src/integration/api.integration.spec.ts` contiene los casos — no borrar; reutilizar cuando pase el diagnóstico.
- Criterio de cierre: `pnpm test:integration` verde en CI **y** el job `db-migrations` existente verde.

### B · FND-E2E con Playwright (sin empezar)

- `@playwright/test` **no** está en el workspace; **Chromium headless-shell 158.0.8127.18 descargado y ejecutable** en `~/.cache/ms-playwright` (verificado `--version`). `sudo` NO disponible → evitar `--with-deps`; las libs del sistema bastan para headless.
- Plan: añadir `@playwright/test` a `apps/web`, `playwright.config.ts` (webServer: `next start` en CI con API + PG seed), 1 spec dorado: **registro → Productos visibles → crear producto → ver nodo en árbol**. Ejecutar aparte de `turbo test`.

### C · Fuzz de movimientos (parte del criterio Fase 1)

Incluido en la suite de integración (300 ops deterministas con mulberry32) — queda bloqueado por el diagnóstico A, no por el código.

### D · Demo y criterios de aceptación Fase 1 (§2 de 07-plan)

1. ✅ login real · 2 productos aislados · árbol operativo · demo seed · strict limpio · ✅ build/lint/typecheck/unit/CI escrito.
2. Falta: **CI verde en GitHub** (primer push real pendiente) · suite integración verde · e2e · tokens/scopes (Fase 6a) fuera de scope.
3. Cuando toque demo formal: reset BD a prístino (ver §5) porque esta sesión dejó sesiones/productos de prueba ya limpiados.

### E · Deuda menor conocida

- `apps/web`: el contexto switcher (`AppShell`) no dispara `router.push` de forma fiable cuando el usuario lo cambia a mitad de carga (tests manuales OK; mismo patrón que la paleta). Revisar con `useEffect` + `startTransition` si cuaja en demo.
- KPIs de Productos no cubren "Tareas/Incidencias" (dominios que llegan en Fases 3–5) — son honestos y etiquetados como Fase 1.
- `Integrantes` muestra membresías `product_members` explícitas; el `admin_global` NO aparece listado como miembro (acceso implícito) — comportamiento correcto aunque confunda en demo.
- pnpm en este PC perdió `~/.config/pnpm/rc` (apuntaba a `/run/media/leonardo/Datos/.pnpm-store/v10`); instalar con `CI=true pnpm --store-dir=/run/media/leonardo/Datos/.pnpm-store/v10 …` o recrear el rc.
- **no usar `pkill -f` con cadenas que aparezcan en la propia shell** (mató 3 shells esta sesión); usar PIDs en `/tmp/opencode/*.pid` o `ss -ltnp`.

## 3. Estado de la BD esta sesión

- Reset completo (`down -v`) y re-sembrado: **3 productos, 10 nodos kanora, 0 usuarios, 0 actividad**. El usuario de pruebas `leonardo@example.com` y el producto `e2e-demo` creados vía web fueron eliminados en el reset (el FK append-only de `activity_log` impedía borrar el usuario, por eso el reset).
- `devcycle_test` efímera: la recrea/borra cada `test:integration` vía `global-setup.ts` (drop/create); no tocar a mano.

## 4. Comandos de recuperación (nueva sesión)

```bash
cd /mnt/datos/Programacion/AdminProject
docker compose up -d postgres
for i in $(seq 1 150); do docker compose exec -T postgres psql -U devcycle -d devcycle -c 'select 1' >/dev/null 2>&1 && echo ready && break; sleep 2; done
export DATABASE_URL=postgres://devcycle:devcycle@localhost:5432/devcycle
# si pnpm aborta por store: CI=true pnpm install --store-dir=/run/media/leonardo/Datos/.pnpm-store/v10
cd apps/api && setsid bash -c 'set -a; . ./.env; set +a; exec node dist/main.js' </dev/null > /tmp/opencode/api.log 2>&1 &
cd ../web && setsid bash -c 'exec npx next start -p 3000' </dev/null > /tmp/opencode/web.log 2>&1 &
curl localhost:3001/api/v1/health   # {"status":"ok","db":"up"}
open http://localhost:3000          # web; registra el primer usuario (será admin_global)
```

## 5. Decisiones y trampas de esta sesión (no repetir)

- **Vitest unitario vs integración**: `pnpm test` jamás debe incluir `*.integration.spec.ts` (cuelga el runner). Unitarios excluyen integración; integración es opt-in (`vitest.integration.config.ts`).
- **Better-auth bajo Vitest/Vite**: peticiones autenticadas pueden fallar silenciosamente en el worker aunque `dist/` (curl) funcione. Para tests de auth, o inline `better-auth` en deps del transform, o invocar la app spawneada.
- **`useSearchParams()` + Suspense** en Next 15 produjo un boundary `B:0` al que el cliente no hidrató (contenido entregado server-side pero `hidden` eterno). SSR-safe pattern usado: `searchParams` como prop del Server Component + estado cliente init-una-vez + `history.replaceState` para `?node=…` sin re-render servidor.
- **next build exige entorno saneado**: `betterAuth({ baseURL })` no acepta rutas relativas; en SSR prerender usar absolute default y `window.location.origin` en cliente.
- **Testing Library en vitest sin `globals`** ⇒ cleanup no corre; `setupFiles` obligatorio.
- **`--with-deps` de Playwright requiere sudo** → usar headless shell (ya instalado, funciona).
- **Admin_global seed**: `seed --demo` crea org+productos AL MISMO TIEMPO que `users=0` → el primer `POST /api/auth/sign-up/email` recibe `admin_global` (hook `databaseHooks`). En BD con usuarios, el primero registrado se queda admin y los demás no.
- **`activity_log` es append-only de verdad**: FK desde actores impide borrar usuarios con historia → reset con `down -v` es la única vía limpia.
- **pkill self-match** → shells suicidadas 3 veces; de ahora en adelante PIDs en `/tmp/opencode/`.

## 6. Referencias

- Plan de Fase 1 y criterios: `docs/planificacion/07-plan-implementacion.md` §2 (F1-T01…T12).
- Estrategia de pruebas (FND-U/I/E2E/SEC/MIG): `docs/planificacion/08-estrategia-pruebas.md` §3–4.
- ADRs: `docs/adr/ADR-001..005`. Mockup (intocable): `muckup/`. Plan UI: `README.md`.
- Reset BD: §5 HANDOFF anterior (Volumen `devcycle_pgdata`); demo-clean: `docker compose down -v && up -d postgres && pnpm --filter @devcycle/db migrate up && pnpm --filter @devcycle/db exec tsx src/seed.ts --demo`.
