# 05 · Análisis de impacto

## 1. Objetivo

Diseñar el motor de análisis de impacto: a partir de cualquier elemento, recorrer relaciones y clasificar el impacto, conservando historial inmutable.

## 2. Entrada

Cualquier entidad: nodo, documento, tarea, incidencia, cambio, prueba, (futuro) API/entidad técnica. Identificador por código o UUID + tipo.

## 3. Algoritmo

```text
input: (entityKind, entityId, relationTypes?, maxDepth=3)
visited = {entityId}
frontier = [entityId]
depth = 0
direct = []
transitive = []
potential = []
while depth < maxDepth and frontier not empty:
  next = []
  for node in frontier:
    rels = relaciones salientes/entrantes de node (filtradas por relationTypes)
    for r in rels:
      other = extremo opuesto
      if other not in visited:
        visited.add(other)
        classify(node, other, r, depth+1) -> direct/transitive/potential
        next.append(other)
  frontier = next
  depth++
```

Clasificación:
- **Impacto confirmado**: relación directa de dependencia (`depends_on`, `implements`, `uses`, `calls`, `reads`, `writes`, `governed_by`, `executed_in`).
- **Impacto probable**: relación indirecta a ≤2 saltos por dependencias confirmadas.
- **Requiere revisión**: relación documental/informativa (`documents`, `references`, `relates_to`, `applies_rule`) o elementos sin prueba asociada.

## 4. Prevención de ciclos

- `visited` Set global por análisis.
- Profundidad máxima configurable (default 3, máx 5).
- No bloquear ciclos en BD; control en aplicación/CTE.

## 5. Resultado

Para el elemento inicial, listar:
1. Elementos directamente relacionados.
2. Dependientes indirectos.
3. Potencialmente afectados.
4. Pruebas a revisar (`verifies`/`tested_by`).
5. Documentos potencialmente desactualizados (versiones).
6. Módulos/pantallas involucrados.

## 6. Tabla `change_impact_assessments` (nueva)

```sql
change_impact_assessments (
  id uuid PK,
  product_id uuid FK,
  change_id uuid FK (nullable),
  start_kind text,
  start_id uuid,
  depth int,
  relation_types jsonb,
  confirmed jsonb,        -- array de {kind,id,code}
  probable jsonb,
  review jsonb,
  tests jsonb,
  documents jsonb,
  modules jsonb,
  versions_consulted jsonb, -- versiones de documentos analizadas
  analyzed_by text FK users,
  analyzed_at timestamptz,
  approved_by text FK users (nullable),
  approved_at timestamptz (nullable)
)
```

Inmutable: sin UPDATE/DELETE (trigger o convención). Nueva evaluación crea nueva fila.

Tabla auxiliar opcional `change_impact_elements` para consultas; o mantener arrays JSONB. Recomendación v1: JSONB para simplicidad; normalizar solo si se requieren consultas por elemento.

## 7. Detección de documentación desactualizada

- Comparar `content_items.version` en el momento del análisis con versión actual.
- Si un documento vinculado cambió de versión tras el análisis, marcar "posiblemente desactualizado".
- Mostrar en UI y en `get_product_context`.

## 8. Comparación previsto vs realizado

- Al ejecutar un cambio (`changes.status='executed'`), comparar elementos reales modificados (git_files, nodos) con `confirmed/probable` del análisis.
- Registrar discrepancias en `activity_log` o en nueva evaluación.

## 9. Integración con cambios

- `create_change` puede disparar análisis automático opcional.
- `analyze_impact` tool MCP/API.

## 10. Rendimiento

- Índices existentes en `relations` (source/target/product/type).
- CTE recursivo con `depth` limitado.
- Cache por (start, depth, relation_types) opcional en aplicación.
- Permisos por producto vía `product_id`.

## 11. Estado actual vs objetivo

| Capacidad | Estado |
|---|---|
| BFS transitivo | Implementado (app) |
| Clasificación de impacto | No implementado |
| Historial persistente | No implementado |
| Detección docs desactualizadas | No implementado |
| Comparación previsto/realizado | No implementado |
| Tool MCP analyze_impact | No implementado |
