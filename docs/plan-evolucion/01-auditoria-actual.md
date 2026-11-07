# 01 · Auditoría del estado actual

> DevCycle (AdminProject) — análisis realizado sobre el repositorio en la rama `main` tras el commit `aeaa5ea` (push publicado).  
> Fuentes: código real (`apps/*`, `packages/*`), migraciones `0001`–`0009`, ADR-006/007/008 y docs archivados en `docs/archive/planificacion-creacion-proyecto/`.  
> Regla aplicada: ninguna afirmación se basa en documentación sin contraste con código.

## 1. Resumen ejecutivo

DevCycle **ya no es un repositorio vacío**. El plan de creación original (archivado) se ejecutó y dejó un monolito modular TypeScript operativo con 9 migraciones, API NestJS, frontend Next.js, servidor MCP independiente y pruebas de integración/E2E.

Estado por fase original (evidencia en código):

| Fase original | Estado | Evidencia |
|---|---|---|
| F1 Fundamentos | **Implementado** | `packages/db/migrations/0001_extensions.up.sql`, `0002_core.up.sql`; `apps/api/src/iam`, `products`, `nodes` |
| F2 Documentación | **Implementado** | `0003_documents.up.sql`; `apps/api/src/documents`; `packages/shared` metadata Zod |
| F3 Trabajo | **Implementado** | `0004_work.up.sql`; `apps/api/src/work` |
| F4 Trazabilidad | **Implementado** | `0005_traceability.up.sql`; `apps/api/src/trace` |
| F5 Seguimiento | **Implementado** | `0006_followup.up.sql`; `apps/api/src/followup` |
| F6a Integración | **Implementado** | `0007_integration.up.sql`; `apps/api/src/integration-api`; `apps/mcp-server` |
| F6b MCP read-only | **Implementado** | `apps/mcp-server/src/tools.ts` (23 tools) |
| F6c Escrituras agente | **No implementado** | scopes `write:*` existen en `packages/shared/src/constants.ts` pero no hay endpoints de escritura en `integration-api` |
| F6d Webhook Git | **No implementado** | sin código |

El objetivo del nuevo plan no es reescribir lo existente, sino **evolucionar** la plataforma hacia un sistema de conocimiento semántico con análisis de impacto, flujos estructurados y escrituras controladas para agentes.

## 2. Stack tecnológico (verificado)

| Capa | Tecnología | Evidencia |
|---|---|---|
| Monorepo | pnpm 10 + Turborepo | `package.json`, `turbo.json` |
| Frontend | Next.js (App Router) + React | `apps/web/src/app` |
| Backend | NestJS modular | `apps/api/src/app.module.ts`, `main.ts` |
| Base de datos | PostgreSQL 16 (extensiones `citext`, `ltree`, `pgcrypto`) | `packages/db/migrations/0001_extensions.up.sql` |
| ORM | Drizzle (SQL-first) | `packages/db/src/schema.ts`, `migrate.ts` |
| Auth humanos | better-auth (sesiones en DB) | `apps/api/src/iam/auth.ts`, tabla `sessions` |
| Auth agentes | service accounts + api_tokens (sha256) | `packages/db/src/schema.ts` (`service_accounts`, `api_tokens`) |
| Validación | Zod compartido | `packages/shared/src/schemas.ts` |
| MCP | servidor stdio independiente | `apps/mcp-server/src/index.ts`, `tools.ts` |
| Pruebas | Vitest (unit/api), Playwright (E2E) | `apps/web/e2e`, `apps/api/src/integration` |

## 3. Estructura de directorios relevante

```text
apps/
  api/src/
    common/            activity, auth guards, problem details
    documents/         documentos, versionado, transiciones
    nodes/             árbol funcional (ltree), ficha integral
    products/          productos
    work/              tasks, issues, comments
    trace/             changes, testcases, relations, dependencias, grafo, historial
    followup/          overview, cobertura, actividad, export CSV
    search/            FTS global multi-kind
    integration-api/   API read-only para agentes + service tokens + contexto
  mcp-server/src/      23 tools MCP read-only
  web/src/
    app/(app)/products/[slug]/
      arbol, documentacion, tareas, incidencias, trazabilidad,
      modificaciones, seguimiento, integraciones, resumen
    components/        vistas por dominio
packages/
  db/                  schema Drizzle + migraciones + seed
  shared/              constantes, Zod, tipos
  ui/                  design system
```

## 4. Responsabilidades por capa

- **Base de datos**: integridad estructural (FK, CHECK, UNIQUE parciales, índices GIN/GiST implícitos), `ltree`, FTS `tsvector`, append-only `activity_log`/`item_versions`/`test_results`.
- **Backend**: reglas de negocio, autorización (RBAC + permisos), transiciones, auditoría, contexto para agentes, consultas transitivas (BFS en aplicación).
- **Frontend**: navegación por producto, árbol, edición documental, tableros, trazabilidad, seguimiento, integraciones.
- **MCP**: adaptador read-only sobre `/integration/*`, sin acceso directo a PostgreSQL.

## 5. Auditoría de base de datos

### 5.1 Tablas existentes (verificadas en `packages/db/src/schema.ts`)

Todas las tablas solicitadas por el prompt existen:

| Tabla | Propósito actual | Claves/índices relevantes |
|---|---|---|
| `products` | Producto/proyecto | `slug` único, `org_id` FK, status CHECK |
| `product_nodes` | Árbol funcional (jerarquía) | `path ltree`, `parent_id`, `code` único por producto, `search_tsv` GIN |
| `content_items` | Documentos versionables | `doc_type_id`, `status`, `scope`, `code` único parcial, `metadata jsonb` GIN, `search_tsv` GIN |
| `item_versions` | Snapshots inmutables | `(item_id, version)` único; metadata snapshot |
| `item_node_links` | Vínculo documento↔nodo | PK `(item_id, node_id)` |
| `relations` | Grafo polimórfico | unique `(product, source kind/id, target kind/id, type)`; índices source/target |
| `tasks` | Tareas | state FK, priority CHECK, `search_tsv` |
| `issues` | Incidencias | severity/priority CHECK, `search_tsv` |
| `changes` | Modificaciones propuestas/ejecutadas | kind/status CHECK, git fields, `search_tsv` |
| `test_cases` | Casos de prueba | type/status CHECK, `search_tsv` |
| `test_results` | Ejecuciones (append-only por trigger) | FK test_case, status CHECK |
| `comments` | Comentarios polimórficos | índice `(parent_kind, parent_id, created_at)` |
| `attachments` | Adjuntos | `storage_key` único, índice owner |
| `service_accounts` | Identidad de agente por producto | unique `(product_id, name)` |
| `api_tokens` | Tokens hash sha256 | `token_hash` único, scopes jsonb |
| `agent_executions` | Auditoría de operaciones MCP/API | status CHECK, índices |
| `activity_log` | Auditoría append-only | actor type CHECK, índice `(product_id, created_at)` |

Tablas adicionales relevantes: `organizations`, `users`, `sessions`, `accounts`, `verifications`, `roles`, `permissions`, `role_permissions`, `user_roles`, `product_members`, `node_types`, `document_types`, `workflow_states`, `state_transitions`.

### 5.2 Integridad real de `relations`

- `source_kind`/`target_kind` CHECK limitado a `node,item,task,issue,change,test_case`.
- `relation_type` CHECK limitado a 13 tipos: `affects, documents, specifies, implements, resolves, blocks, is_blocked_by, verifies, depends_on, relates_to, modifies, references, applies_rule`.
- **No existen FKs polimórficas** hacia las tablas fuente/destino (integridad por convención + triggers no verificados para relations). Se valida en servicios.
- Unique parcial/global por producto + extremos + tipo.
- Sin columnas de historial en `relations` (creación registrada en `activity_log`).
- Sin peso/confianza.

### 5.3 Catálogo documental real

`document_types` (seed, 13 tipos): `spec, screen_desc, use_case, workflow, business_rule, req_functional, req_non_functional, data_model, api_contract, tech_spec, adr, tech_manual, test_doc`.

Estados: `draft, in_review, published, archived`. Alcance: `node, global`.

Versionado: `content_items.version` + `item_versions` append-only; publicar congela snapshot. Metadata JSONB tipada por docType para `use_case, business_rule, req_non_functional, workflow` (ADR-008). No hay metadata tipada para `req_functional` (solo Markdown).

## 6. Auditoría de relaciones

- Tipos semánticos disponibles: los 13 anteriores (no incluyen `contains, realizes, uses, triggers, validates, governed_by, executed_in, participates_in, calls, reads, writes, tested_by, supersedes`).
- Dirección: explícita (source→target), con algunos inversos manuales (`is_blocked_by`).
- Bidireccionalidad: no automática; se crean relaciones explícitas.
- Duplicados: prevenidos por unique index.
- Historial: no en tabla; actividad en `activity_log`.
- Transitividad: BFS en aplicación (`TraceService.graphForNode`, `dependentsForNode`), profundidad máx 3.
- Ciclos: evitados por `seen` Set en BFS; no hay constraint de aciclicidad en BD.

## 7. Auditoría documental

- Creación/edición/versionado implementados en `DocumentsService`.
- Vínculo a nodos vía `item_node_links` y códigos de nodo.
- Validación de metadata Zod en create/update/version.
- Consulta por tipo/estado/ámbito/nodo/texto (`listDocuments`), FTS global en search.
- Frontend: `docs-view.tsx`, pestaña documentación en árbol.

## 8. Auditoría de interfaz

Pantallas existentes (`apps/web/src/app/(app)/products/[slug]/`):
`resumen, arbol, documentacion, tareas, incidencias, trazabilidad, modificaciones, seguimiento, integraciones`.

Componentes reutilizables: `tree-view.tsx`, `docs-view.tsx`, `tasks-view.tsx`, `issues-view.tsx`, `trazabilidad-view.tsx`, `modificaciones-view.tsx`, `seguimiento-view.tsx`, `integraciones-view.tsx`, `markdown-editor.tsx`.

No hay vistas dedicadas para: editor de flujos visual, mapa de relaciones filtrado por contexto, análisis de impacto histórico.

## 9. Integración con agentes

- API read-only `/integration/*` con Bearer tokens y scopes.
- MCP 23 tools read-only.
- Contexto empaquetado `get_product_context` (32 KB).
- Auditoría doble `agent_executions` + `activity_log`.
- Escrituras: scopes declarados pero no implementados.

## 10. Pruebas

- Integración API: `apps/api/src/integration/api.integration.spec.ts`.
- Unitarias: `tree.utils.spec`, `document-transitions`, `work-transitions`, `svg-sanitize`, `diff/markdown`.
- E2E Playwright: `z-tareas`, `z-trazabilidad`, `zz-seguimiento`, `zzz-integraciones`.
- Migraciones verificadas por runner `packages/db/src/migrate.ts`.

## 11. Limitaciones reales observadas

1. No existe motor de análisis de impacto persistente ni tabla de evaluaciones.
2. No existe representación estructurada de pasos/transiciones de flujo más allá de arrays JSON en metadata.
3. No existen tipos de relación semántica amplios ni pesos.
4. No hay validación de integridad referencial polimórfica en BD para `relations`.
5. No hay endpoints ni tools MCP de escritura.
6. No hay detección automática de documentación desactualizada.
7. No hay requisitos funcionales estructurados (solo Markdown).
8. No hay tabla `change_impact_assessments`.
9. Consultas transitivas en aplicación (BFS), no en SQL recursivo.
10. No hay ADRs de impacto/versionado de relaciones.

## 12. Hechos vs hipótesis

- **Hecho**: tablas y endpoints listados existen y están registrados en módulos.
- **Hecho**: metadata tipada solo para 4 tipos documentales.
- **Hipótesis (a validar en desarrollo)**: el BFS en aplicación será suficiente para productos medianos; puede requerir CTE recursivo si crece el volumen.
- **Hipótesis**: la UI compacta actual soporta nuevas vistas sin rediseño completo.
