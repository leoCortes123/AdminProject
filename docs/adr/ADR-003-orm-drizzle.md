# ADR-003 · Drizzle ORM + migraciones SQL versionadas

- **Estado:** ✅ Aceptada (Fase 1)
- **Fecha:** 2026-11-06
- **Relacionado:** [03-arquitectura-tecnica.md](../planificacion/03-arquitectura-tecnica.md) §4.4 · [04-modelo-datos.md](../planificacion/04-modelo-datos.md) §1 · [07-plan-implementacion.md](../planificacion/07-plan-implementacion.md) F1-T02

## Contexto

El dominio hace uso intensivo de capacidades de PostgreSQL: `ltree` (árbol), `jsonb`, índices parciales únicos, GiST, CTEs recursivas y funciones agregadas sobre paths. Necesitamos SQL predecible y revisable en PR, con tipos estrictos en TypeScript y migraciones reversibles probadas (up/down) en CI.

## Decisión

**Drizzle ORM** como único cliente de acceso (en `packages/db`), con:

- Esquema fuente en `src/schema.ts` (pg-core).
- **Migraciones SQL escritas a mano** en `migrations/NNNN_nombre.{up,down}.sql`, aplicadas por un runner propio (`src/migrate.ts`) transaccional con tabla `schema_migrations` (`up | down [--all] | status`).
- **Seed idempotente** (`src/seed.ts`): roles 4, 14 permisos + matriz, 8 tipos de nodo, 13 document_types; `--demo` añade organización y 3 productos con workflow por defecto.
- Toda la API pasa por `getDb()` (pool singleton postgres.js, max 10); web jamás importa `packages/db`.

## Alternativas evaluadas

| Alternativa    | A favor                                                                      | En contra                                                                     | Veredicto                               |
| -------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------- |
| **Drizzle**    | SQL-first y predecible, tipado sin generación, migraciones en SQL revisables | Menos “magia”; joins explícitos                                               | **Aceptada**                            |
| Prisma         | DX inicial y Studio                                                          | Abstracción dificulta ltree/CTE; migraciones menos auditables; N+1 silencioso | Descartada                              |
| Kysely         | Query builder impecable, cero magia                                          | Sin capa esquema/migración integrada (añadir `kysely-ctl`)                    | Alternativa válida si Drizzle no encaja |
| SQL crudo (pg) | Control total                                                                | Pierde tipado y productividad del CRUD masivo                                 | Descartada                              |

## Consecuencias

- `packages/db` publica CJS + `dist/*.d.ts` (declarations activadas) para que NestJS importe con tipos; `migrate.ts`/`seed.ts` se excluyen del build y corren con `tsx`.
- `pnpm test:integration` en `packages/db` apunta a PG efímero (FND-I); el job `db-migrations` de CI prueba up → down --all → up + seed ×2.
- `activity_log` y `item_versions` son append-only (trigger `forbid_mutation()`); las bajas son soft-delete (`deleted_at`).
