# ADR-001 · Monorepo pnpm + Turborepo

- **Estado:** ✅ Aceptada (Fase 1)
- **Fecha:** 2026-11-06
- **Relacionado:** [03-arquitectura-tecnica.md](../planificacion/03-arquitectura-tecnica.md) §3 · [09-riesgos-y-decisiones.md](../planificacion/09-riesgos-y-decisiones.md) D-011

## Contexto

DevCycle es un monolito modular con varios entregables que comparten código: `apps/web` (Next.js), `apps/api` (NestJS), `apps/mcp-server` (futuro), y librerías `packages/{db,shared,ui,config}`. Necesitamos builds incrementales, un único gestor de versiones por dependencia, y límites de módulo verificables.

## Decisión

Monorepo en una única raíz git con **pnpm workspaces** (`apps/*`, `packages/*`) + **Turborepo** (tareas `build/dev/lint/typecheck/test` con caché y grafo de dependencias). Node ≥ 22 (engines), pnpm fijado con `packageManager` (10.34.5).

- `packages/shared` y `packages/db` compilan a **CJS en `dist/`** (`tsconfig.build.json`) porque NestJS consume `require()`; web y mcp-server también consumen CJS sin problema.
- TypeScript estricto (`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`) vía `packages/config`.

## Alternativas evaluadas

| Alternativa                     | A favor                                           | En contra                                                 | Veredicto    |
| ------------------------------- | ------------------------------------------------- | --------------------------------------------------------- | ------------ |
| **pnpm workspaces + Turborepo** | Rápido, caché fiable, layout simple, CI con cache | Turbo cachea mejor si los `outputs` están bien declarados | **Aceptada** |
| Nx                              | Grafos y generadores potentes                     | Complejidad/peso > beneficio en equipo 1–2 devs           | Descartada   |
| npm/yarn workspaces sin Turbo   | Cero dependencias extra                           | Sin caché de build/lint; scripting manual                 | Descartada   |
| Repos separados (polyrepo)      | Aislamiento total                                 | Versionado cruzado de `@devcycle/*` ingobernable en v1    | Descartada   |

## Consecuencias

- Un único lockfile (`pnpm-lock.yaml`) y `pnpm install` reproducible en CI (`--frozen-lockfile`).
- `pnpm demo` en raíz arranca el entorno de datos completo en < 5 min (Docker + migrate + seed).
- La caché de Turbo requiere declarar `outputs` correctas; ignoramos ruido de `node_modules` (`.gitignore`).
- Los paquetes internos referencian `workspace:*`; publicar a un registry no es necesario en v1.
