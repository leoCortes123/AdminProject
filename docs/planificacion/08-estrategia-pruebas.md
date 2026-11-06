# 08 · Estrategia de pruebas

> Objetivo: que ninguna entrega viole (a) aislamiento multiproducto, (b) integridad referencial, (c) RBAC, (d) reversibilidad de migraciones. Framework: **Vitest** (unit/integration), **Testing Library** (component), **Supertest** (API), **Playwright** (E2E), **testcontainers** (Postgres efímero), **@faker-js/faker + fast-check** (property-based). Seeds deterministas (`seed:run --profile test`).

## 1. Pirámide y proporción objetivo

| Capa | % | Ejemplos |
|---|---|---|
| Unitarias (dominio puro) | 45% | TreeService (ciclos, ltree), StateMachine, ChangelogService, DiffService, PermissionsGuard logic |
| Integración (API + PG real) | 30% | CRUD + transacciones + triggers de relations + FTS |
| Contrato API / OpenAPI | 10% | Esquema OpenAPI valida respuestas; breaking changes detectados (openapi-diff) |
| Componentes (React) | 5% | Tree, DataTable, Tabs, KanbanBoard (dnd), CommandPalette |
| E2E (Playwright) | 10% | Flujos dorados (§4) |

Cobertura mínima CI: **dominio core 80%**, **permisos 100%** (todo permiso declarado tiene test allow+deny), ramas de `relations` trigger 100%.

## 2. Pruebas unitarias

- `packages/db` puro excluido salvo generadores; dominio en `apps/api/src/modules/*/domain` como funciones puras testables sin Nest.
- `TreeService.move`: fuzzing con 1.000 operaciones aleatorias (fast-check) → invariantes: árbol siempre conexo, sin ciclos, `path` consistente con `parent_id` (consulta verificadora).
- `StateMachine`: matriz exhaustiva estado×evento×permiso → permitido/prohibido.
- `diff`/`versioning`: caso base + conflictos `expectedVersion`.

## 3. Pruebas de integración (PostgreSQL real)

- testcontainers levanta PG16 + migraciones `up` desde cero; cada suite en transacción con rollback.
- Casos: CRUD completos; transacción MOD→INC→TASK atómica (fallo intermedio ⇒ rollback total); triggers de `relations` (kind inexistente/elemento de otro producto ⇒ excepción y rollback); `item_versions` append-only (UPDATE ⇒ error); `activity_log` append-only; FTS con acentos/mayúsculas; concurrencia optimista (2 updates mismo doc ⇒ uno gana, otro 409).

## 4. Contratos y E2E

- **Contrato:** validación de respuestas contra OpenAPI en cada endpoint de test; snapshot de `openapi.json` revisado en PR.
- **E2E Playwright (flujos dorados):**
  1. Registro → crear producto "Demo" → crear M01 → crear PANT-01 → publicar DOC-001 v1.
  2. Tarea desde ficha → arrastre kanban Pendiente→En curso → transición rechazada a estado no permitido.
  3. Incidencia → vincular tarea → MOD ejecutada → INC verificada.
  4. Trazabilidad: ejecutar Q1 "¿qué tareas afectan esta pantalla?" → tabla no vacía.
  5. MCP v1 (cliente MCP de test): `get_product_context(PANT-02)` devuelve presupuesto ≤ 32 KB; `create_task` **rechazada** (read-only) y auditada.
- E2E corre en CI sobre Compose de prueba (web+api+postgres+minio).

## 5. Pruebas de componentes

Testing Library + MSW: Tree (expandir/seleccionar/teclado), DataTable (ordenar/filtrar), Tabs (ARIA), CommandPalette (filtrar/Enter/Esc), Toast (aria-live). Sin tests de estilos salvo tokens semánticos.

## 6. Integridad de relaciones y multiproducto (suites dedicadas)

**Tenant-escape (matriz endpoints × productos):** parametrizado con 2 productos (Kanora, Verdana): crear datos en ambos; cada endpoint con auth de A intenta tocar recursos de B (id conocido) ⇒ esperar 404/403, jamás 200 ni fuga parcial (p. ej. contadores globales). Añadir fuzz de ids aleatorios.
**Integridad de relaciones:** property test: universo de 6 elementos por tipo; 5.000 operaciones aleatorias (crear/vincular/borrar elemento/rel); tras cada batch: `relations` sin huérfanos (orphan sweep debe devolver 0); borrar nodo con historia ⇒ soft-delete y relaciones conservadas.
**Permisos:** tabla-driven: para cada permiso×endpoint: token/sesión sin él ⇒ 403; con permiso ⇒ 2xx. Incluir el permiso «implícito» de leer recursos ajenos al producto.
**Inyección/XSS:** bodies con `<script>` y `javascript:` en Markdown y en nombres de nodo ⇒ render seguros (preview sanitizado; React escapa por defecto; sin `dangerouslySetInnerHTML` salvo sanitizado).

## 7. Rendimiento (smoke, no exhaustivas)

- k6 (opcional Fase 5): 50 usuarios concurrentes leyendo árbol con 5.000 nodos (ltree) — p95 < 500 ms; búsqueda con GIN < 200 ms en 50k docs sintéticos.
- Budgets web: Productos < 1.5 s TTI; árbol SSR < 300 ms; editor preview < 100 ms.

## 8. Convenciones de TypeScript y calidad de código

- `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noFallthroughCasesInSwitch`; `any` prohibido salvo justificación con comentario `// any-justify:`.
- Errores de dominio como valores discriminados (`Result<T, DomainError>` en capa pura; excepciones solo en bordes).
- Validación exclusivamente con zod en bordes (HTTP, MCP, webhooks); tipos de dominio no llevan zod embebido.
- Nombres: entidades SQL singular snake_case en tablas, plural convención Drizzle, tipos TS singular PascalCase; endpoints plurales kebab (`/api/v1/product-members`).
- Estructura por módulo NestJS: `module.ts`, `controller.ts`, `service.ts`, `domain/` (puro), `dto.ts` (zod), `module.spec.ts`.
- Commits: Conventional Commits; PR con plantilla (qué/por qué/cómo probar/screenshot si UI).
- Carpetas: `apps/web/src/app/(app)/productos/[slug]/…` respetando segmentos del mockup; colocalizar `__tests__` donde se usan.

## 9. Migraciones de base de datos

- Drizzle ORM + `drizzle-kit generate` (migraciones SQL revisables en PR, nunca `db push` en prod).
- En CI: job "migrate-up-down": clean → migrate up → seed test → migrate down → migrate up de nuevo.
- Reglas de escritura de migraciones: siempre transaccionales (`BEGIN`); `CREATE INDEX CONCURRENTLY` cuando aplique (fuera de tx); `NOT NULL` nuevo campo ⇒ dos pasos (default + backfill); drop de columna ⇒ primero `DEPRECATED` release, después drop.
- `schema_migrations` + `seed_runs` como tablas operativas; nunca editar migración ya mergeada.

## 10. Definición de "Done" por historia (checklist)

`[ ]` Criterios de aceptación verdes · `[ ]` unit + integración para la lógica afectada · `[ ]` permisos probados (allow+deny) · `[ ]` tenant-escape si expone endpoint · `[ ]` a11y: foco, roles ARIA, contraste · `[ ]` activity_log emitido en escrituras · `[ ]` OpenAPI actualizado · `[ ]` mockup/docs coherentes · `[ ]` migración reversible probada · `[ ]` sin TODOs sin ticket · `[ ]` demo seed actualizado si aplica.

## 11. Herramientas resumidas

Vitest · @testing-library/react · Supertest · Playwright · testcontainers · fast-check · faker · k6 (smoke) · ESLint + Prettier · `drizzle-kit` · `openapi-diff` · GitHub Actions (CI) · Lighthouse CI (páginas clave: productos, árbol, kanban).
