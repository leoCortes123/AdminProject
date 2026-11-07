# 02 · Brechas arquitectónicas

> Comparación entre el estado actual (ver `01-auditoria-actual.md`) y los objetivos del prompt `docs/new_plan001.md`.  
> Clasificación: **Crítica / Alta / Media / Baja / Opcional**. Justificación basada en código.

## 1. Matriz de brechas

| ID | Brecha | Clasificación | Evidencia actual | Consecuencia |
|---|---|---|---|---|
| G-01 | No existe motor de análisis de impacto persistente | **Crítica** | `TraceService` tiene BFS (`graphForNode`, `dependentsForNode`) pero no clasificación ni historial | No se puede responder "qué se rompe si cambio X" de forma trazable |
| G-02 | No existe tabla `change_impact_assessments` | **Crítica** | Ausente en `schema.ts` y migraciones | El análisis no es inmutable ni comparable |
| G-03 | Relaciones polimórficas sin integridad referencial en BD | **Crítica** | `relations` solo CHECK de kinds; sin FK a tablas origen/destino | Riesgo de huérfanos si se borran entidades sin cascada |
| G-04 | No hay flujos estructurados con transiciones/decisiones | **Alta** | `flowMetadataSchema` solo array de pasos (`order, action, actor, system`) | No se pueden consultar bifurcaciones/decisiones ni vincular pasos a entidades |
| G-05 | `req_functional` sin metadata estructurada | **Alta** | `FUNCTIONAL_DOCUMENT_METADATA_SCHEMAS` no incluye `req_functional` | Requisitos funcionales solo en Markdown; no consultables |
| G-06 | Tipos de relación semántica insuficientes | **Alta** | 13 tipos en CHECK; faltan `contains, realizes, uses, triggers, validates, governed_by, executed_in, participates_in, calls, reads, writes, tested_by, supersedes` | No se puede expresar el grafo semántico completo |
| G-07 | No hay detección de documentación desactualizada | **Alta** | No existe comparación de versiones documento↔relación | Riesgo de docs obsoletas tras cambios |
| G-08 | No hay endpoints/tools MCP de escritura | **Alta** | scopes `write:*` declarados pero sin implementación en `integration-api` | Agentes no pueden actualizar docs ni registrar resultados |
| G-09 | No hay validación JSON Schema de metadata por tipo | **Media** | Validación Zod en servicio, sin schema versionado | Drift posible entre clientes |
| G-10 | Consultas transitivas en aplicación, no SQL recursivo | **Media** | BFS con N+1 queries en `TraceService` | Rendimiento y complejidad para grafos grandes |
| G-11 | No hay relación explícita `contains` jerárquica vs semántica | **Media** | Jerarquía vía `parent_id`/`ltree`, relaciones semánticas en `relations` | Riesgo de duplicar jerarquía en `relations` |
| G-12 | No hay UI de análisis de impacto histórico | **Media** | No existe vista dedicada | UX incompleta para el objetivo central |
| G-13 | No hay tipos documentales operativos/completos | **Media** | Faltan `acceptance_criteria, security_requirement, operational_process, scheduled_job, error_handling, integration, permission_rule, validation_rule, ui_behavior` | Cobertura documental parcial |
| G-14 | No hay `code`/`status` en relaciones | **Baja** | `relations` no tiene código ni estado | Trazabilidad de cambios de relación limitada |
| G-15 | No hay pesos en relaciones | **Baja** | `metadata` libre, sin `weight` | Clasificación de impacto menos precisa |
| G-16 | No hay herramienta MCP `analyze_impact` | **Alta** | No existe tool ni endpoint | Agentes no pueden analizar cambios |
| G-17 | No hay comparación previsto vs realizado | **Media** | No existe tabla ni proceso | Mejora continua no medida |
| G-18 | No hay UI de mapa de relaciones filtrado | **Baja** | `trazabilidad-view` muestra grafo pero sin filtros avanzados por contexto | Riesgo de grafos ilegibles |

## 2. Lo que ya resuelve necesidades (no duplicar)

| Necesidad | Estructura existente |
|---|---|
| Jerarquía funcional Producto→Módulo→Pantalla→Pestaña→Funcionalidad | `product_nodes` + `ltree` + `node_types` |
| Identificador estable | `product_nodes.code` + UUID |
| Documentos versionados | `content_items` + `item_versions` |
| Vínculo documento↔nodo | `item_node_links` |
| Relaciones genéricas | `relations` |
| Tareas/incidencias/cambios/pruebas | `tasks`, `issues`, `changes`, `test_cases`, `test_results` |
| Auditoría | `activity_log`, `agent_executions` |
| Contexto para agentes | `IntegrationContextService.getProductContext` |
| FTS global | `search_tsv` + GIN en 6 kinds |

## 3. Riesgos de evolución

- **Riesgo de duplicación**: crear tablas dedicadas para CU/reglas/RNF/flujos duplicaría versionado/relaciones. ADR-008 ya decidió metadata JSONB; mantener.
- **Riesgo de explosión de tipos de relación**: agregar todos los tipos del prompt de golpe aumenta complejidad. Fase incremental.
- **Riesgo de performance**: BFS en aplicación; migrar a CTE recursivo solo si se demuestra necesidad.
- **Riesgo de UI**: no rediseñar; adaptar vistas existentes.

## 4. Dependencias entre brechas

- G-01/G-02 dependen de G-06 (tipos de relación) y G-03 (integridad).
- G-04 depende de G-05/G-13 para tipos documentales.
- G-08 depende de G-01 (analyze_impact) y políticas de confirmación.
- G-07 depende de versionado existente + relaciones.

## 5. Prioridad de abordaje

1. Integridad de relaciones + tipos semánticos mínimos.
2. Motor de impacto persistente.
3. Flujos estructurados y requisitos funcionales.
4. Detección de docs desactualizadas.
5. Escrituras de agentes.
6. UI de impacto/flujos.
