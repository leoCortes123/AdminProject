# 09 · Backlog de implementación

## Convenciones
- ID: `E< fase >-T< número >`.
- Paralelizable: tareas sin dependencias entre sí.

## E1 · Fundamentos semánticos

| ID | Tarea | Archivos a inspeccionar/modificar | Depende de | Paralelo |
|---|---|---|---|---|
| E1-T01 | Definir subset de nuevos tipos de relación | `packages/shared/src/constants.ts`, `schemas.ts` | - | sí |
| E1-T02 | Migración 0010: ampliar CHECK relation_type + soft delete | `packages/db/migrations/0010_*.sql`, `schema.ts` | E1-T01 | no |
| E1-T03 | Triggers de integridad polimórfica | migración SQL | E1-T02 | no |
| E1-T04 | Actualizar `TraceService` para nuevos tipos | `apps/api/src/trace/trace.service.ts` | E1-T02 | sí |
| E1-T05 | Pruebas de integridad de relaciones | `apps/api/src/integration` | E1-T03 | sí |

## E2 · Documentación funcional

| ID | Tarea | Archivos | Depende de | Paralelo |
|---|---|---|---|---|
| E2-T01 | Agregar `req_functional` a metadata schemas | `packages/shared/src/schemas.ts` | - | sí |
| E2-T02 | Ampliar `flowMetadataSchema` (decisions, transitions, subprocesses) | `packages/shared/src/schemas.ts` | - | sí |
| E2-T03 | Validar en `DocumentsService` | `apps/api/src/documents/documents.service.ts` | E2-T01, E2-T02 | no |
| E2-T04 | UI tipada para flujos (opcional) | `apps/web/src/components/docs-view.tsx` | E2-T03 | no |

## E3 · Motor de impacto

| ID | Tarea | Archivos | Depende de | Paralelo |
|---|---|---|---|---|
| E3-T01 | Migración 0011 `change_impact_assessments` | `packages/db/migrations`, `schema.ts` | E1 | no |
| E3-T02 | `ImpactService` (BFS + clasificación) | nuevo `apps/api/src/impact/impact.service.ts` | E3-T01, E1 | no |
| E3-T03 | Controller + endpoint `/impact` | nuevo controller/module | E3-T02 | no |
| E3-T04 | Tool MCP `analyze_impact` | `apps/mcp-server/src/tools.ts` | E3-T03 | no |
| E3-T05 | Vista web de impacto | `apps/web/src/app/.../modificaciones` | E3-T03 | sí |
| E3-T06 | Pruebas de impacto | integration tests | E3-T02 | sí |

## E4 · Escrituras agentes

| ID | Tarea | Archivos | Depende de | Paralelo |
|---|---|---|---|---|
| E4-T01 | Endpoints escritura docs | `integration-api` | E2 | no |
| E4-T02 | Endpoints escritura changes | `integration-api` | E3 | no |
| E4-T03 | Endpoints register test result | `integration-api` | - | sí |
| E4-T04 | Tools MCP escritura | `mcp-server/src/tools.ts` | E4-T01..03 | no |
| E4-T05 | Confirmación humana flow | guards | E4-T01 | no |

## E5 · Interfaz

| ID | Tarea | Archivos | Depende de | Paralelo |
|---|---|---|---|---|
| E5-T01 | Ficha: pestaña Impacto | `arbol` page | E3 | no |
| E5-T02 | Documentación: filtro huérfanos | `docs-view.tsx` | - | sí |
| E5-T03 | Trazabilidad: filtros avanzados | `trazabilidad-view.tsx` | E1 | sí |

## E6 · Docs desactualizadas

| ID | Tarea | Archivos | Depende de | Paralelo |
|---|---|---|---|---|
| E6-T01 | Comparación de versiones en análisis | `ImpactService` | E3 | no |
| E6-T02 | Marcado "posiblemente desactualizado" en UI | `docs-view.tsx` | E6-T01 | no |
| E6-T03 | Reporte de discrepancias | `FollowupService` | E3, E4 | no |

## Bloqueos
- E3 bloquea E5/E6.
- E1 bloquea E3.
- Escrituras (E4) bloquean herramientas MCP correspondientes.
