# ADR-006 · Seguimiento: avance por conteo, FTS global, cursor y CSV Excel-ES (`M-08`)

- **Estado:** ✅ Aceptada (Fase 5)
- **Fecha:** 2026-11-07
- **Relacionado:** [02-arquitectura-funcional.md](../planificacion/02-arquitectura-funcional.md) §M-08 · [04-modelo-datos.md](../planificacion/04-modelo-datos.md) §4.6 · [07-plan-implementacion.md](../planificacion/07-plan-implementacion.md) §6 (F5-T01…T06)

## Contexto

La Fase 5 debe dar visibilidad operativa con tablas/listas (sin dashboards saturados), búsqueda global madura y cobertura documental/de pruebas, reutilizando F2 (FTS), F3 (trabajo) y F4 (relaciones). El plan proponía «vistas materializadas `product_overview` + refresh incremental», una métrica de avance subjetiva a decidir (R-09) y CSV para comité.

## Decisión

1. **Avance = conteo simple de tareas completadas** (`is_terminal` / total). Por módulo, tareas vinculadas al subárbol `ltree`; módulos sin tareas caen al % de nodos `done` del subárbol (paridad con `/resumen`). Sin ponderación subjetiva (R-09 cerrado: documentado y testeado — «tras completar 1 tarea» cambia el %).
2. **Sin vista materializada**: el overview calcula agregados por SQL bajo demanda (vistas lógicas en el servicio). En la escala v1 (≤ 10 productos × 5.000 nodos) una sola query de conteos + una por módulo es < 10 ms y nunca queda stale; una materializada añadiría refresh sin beneficio demostrable.
3. **Cobertura por ausencia**: «sin docs» = nodo sin `item_node_links` ni `relations` item↔node; «sin pruebas» = sin `relations` test_case↔node ni test→item→node (cubre la cadena `verifies` de Q5). Listados exactos con fixtures.
4. **Activity cursor-paginado** sobre `activity_log` (orden `(created_at, id) desc`, 50/pág, cursor base64) con filtros `actorType`/`entityKind`/`actionPrefix` e índice `(product_id, created_at desc, id desc)`.
5. **Búsqueda global FTS en 6 kinds** (`document,node,task,issue,change,test_case`) con `search_tsv` + GIN en `tasks/issues/changes/test_cases/product_nodes`, `websearch_to_tsquery('spanish')` + `ts_rank` + boost de código exacto (+5) para «PANT-02». Estado real (`workflow_states.key`) en hits (antes hardcodeado en task/issue).
6. **CSV Excel-ES**: BOM `\uFEFF` + separador `;` + cabeceras en español + `Content-Disposition` por kind. Grafo multi-salto BFS hasta `depth ≤ 3` (cierra la deuda F4 de 1 salto) y `test_results` append-only por trigger.

## Alternativas evaluadas

| Alternativa                           | A favor                               | En contra                                                                   | Veredicto                             |
| ------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------- |
| Vista materializada + refresh         | Lecturas rápidas con muchos productos | Stale entre refreshes, trigger/cron extra, invalidation al completar tareas | Descartada (query fresca basta en v1) |
| Avance ponderado por estimación       | «Esfuerzo» más fino                   | Estimaciones inconsistentes, R-09 abierto, no testeable sin fixtures        | Descartada (conteo simple)            |
| `ILIKE` también en tareas/incidencias | Sin migración                         | Sin ranking, sin stemming español, contradice F5-T05                        | Descartada (FTS en los 6 kinds)       |
| CSV `,` sin BOM                       | RFC 4180 puro                         | Excel-ES parsea mal UTF-8 y `;` es el separador local                       | Descartada (BOM + `;`)                |

## Consecuencias

- Migración `0006_followup`: 5 columnas `search_tsv` + GIN + triggers + backfill, índice cursor de `activity_log`, trigger append-only en `test_results`.
- API nueva: `GET /products/:slug/overview`, `/coverage`, `/activity`, `/export?kind=` (tenant-escape por construcción con `ProductGuard`).
- La paleta Ctrl+K integra los 6 kinds (listas de issues/changes/tests además de nodos/docs/tareas) y el sidebar habilita Seguimiento (`v0.5 · Fase 5`).
