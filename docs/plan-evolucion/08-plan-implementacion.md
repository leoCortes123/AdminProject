# 08 · Plan de implementación

## 1. Secuencia adaptada al estado actual

Las fases 1–6a del plan original están implementadas. La evolución se organiza en 6 fases nuevas:

### Fase E1 · Fundamentos semánticos (relaciones)
- Objetivo: integridad + tipos de relación ampliados + soft delete.
- Problema: relaciones sin integridad referencial y tipos insuficientes.
- Estructuras: `relations` (migración), triggers, CHECK.
- Migraciones: `0010_relations_semantic.up.sql`.
- Backend: `TraceService`, validación.
- Frontend: sin cambios.
- MCP: sin cambios.
- Pruebas: integridad, duplicados, ciclos.
- Dependencias: ninguna.
- Riesgos: migración de datos existentes.
- Aceptación: triggers pasan pruebas; tipos nuevos disponibles.

### Fase E2 · Documentación funcional estructurada
- Objetivo: `req_functional` metadata; flujos ampliados; detección docs desactualizadas (base).
- Problema: requisitos/flows poco consultables.
- Estructuras: `content_items.metadata`, Zod schemas.
- Migraciones: ninguna (JSONB ya existe).
- Backend: `DocumentsService`, `FUNCTIONAL_DOCUMENT_METADATA_SCHEMAS`.
- Frontend: formularios tipados (opcional).
- MCP: sin cambios.
- Pruebas: validación metadata.
- Dependencias: E1.
- Riesgos: drift UI/schema.
- Aceptación: Zod valida nuevos campos.

### Fase E3 · Motor de análisis de impacto
- Objetivo: tabla `change_impact_assessments`, servicio `ImpactService`, endpoint + tool MCP.
- Problema: no hay análisis persistente.
- Estructuras: nueva tabla, servicio, controller.
- Migraciones: `0011_change_impact.up.sql`.
- Backend: `ImpactService`, `ImpactController`.
- Frontend: vista impacto.
- MCP: `analyze_impact`.
- Pruebas: recorridos, clasificación, ciclos.
- Dependencias: E1.
- Riesgos: performance.
- Aceptación: análisis reproducible e inmutable.

### Fase E4 · Escrituras controladas para agentes
- Objetivo: endpoints de escritura read-confirm.
- Problema: agentes solo leen.
- Estructuras: `integration-api` escrituras, scopes.
- Migraciones: ninguna.
- Backend: controllers, guards, auditoría.
- Frontend: gestión de permisos ya existe.
- MCP: tools `update_document`, `create_change`, `register_test_result`.
- Pruebas: permisos, auditoría.
- Dependencias: E2, E3.
- Riesgos: seguridad.
- Aceptación: escrituras auditadas y confirmadas.

### Fase E5 · Interfaz de impacto y flujos
- Objetivo: vistas compactas.
- Problema: UX incompleta.
- Estructuras: componentes web.
- Dependencias: E3.
- Aceptación: flujos navegables, impacto visible.

### Fase E6 · Detección de docs desactualizadas y comparación
- Objetivo: alertas y comparación previsto/realizado.
- Dependencias: E3, E4.
- Aceptación: docs marcadas obsoletas; reporte de discrepancias.

## 2. Modificación de secuencia justificada

E1 antes que E3 porque el motor de impacto depende de tipos de relación y integridad. E2 antes que E4 porque las escrituras operan sobre documentos estructurados.
