# ADR-005 · `ltree` para el árbol funcional (`product_nodes`)

- **Estado:** ✅ Aceptada (Fase 1)
- **Fecha:** 2026-11-06
- **Relacionado:** [04-modelo-datos.md](../planificacion/04-modelo-datos.md) §5 · [03-arquitectura-tecnica.md](../planificacion/03-arquitectura-tecnica.md) §4.3 · [07-plan-implementacion.md](../planificacion/07-plan-implementacion.md) F1-T07

## Contexto

El árbol funcional (módulo → pantalla → componente…) es la columna vertebral de DevCycle: miles de nodos por producto, reordenamientos frecuentes (`move`), borrado lógico de subárboles y consultas de subárbol completas con índice GiST. El requisito §5 de 04-modelo-datos exige integridad y rendimiento sin inventar numeración frágil.

## Decisión

**PostgreSQL `ltree`** con `path` materializado en `product_nodes.path` + `depth` denormalizado:

- Label = `code` en minúsculas con `-` → `_` (los códigos `PANT-02` son inválidos como label `ltree` por el guión).
- Camino **único por producto** (índice único sobre `(product_id, path)`).
- Movimiento de subárbol en **transacción serializable**: validación anti-ciclo (`nuevoPadre` no puede ser el nodo ni un descendiente suyo) y recomputado de `path`/`depth` de todo el subárbol con `subpath()`/`nlevel()` en un solo `UPDATE ... FROM (CTE)`.
  - Nota de implementación: `subpath(path, nlevel(path))` es inválido para el nodo raíz del subárbol; el CTE usa `CASE` para tratarlo aparte (incidente real en desarrollo, cubierto por tests).
- Soft-delete del subárbol completo vía `UPDATE ... WHERE path <@ nodo.path` (los hijos quedan fuera de las consultas).
- Duplicado: códigos nuevos con el **siguiente número libre por prefijo** en el producto (incluye borrados históricos), preservando estructura y hermanos.
- `depth` se mantiene denormalizado (`nlevel(path) - 1`) para ordenar y validar sin splits en cliente.

## Alternativas evaluadas

| Alternativa                        | A favor                                                                       | En contra                                                                                                                               | Veredicto                                  |
| ---------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **ltree**                          | Consultas de subárbol `path <@ x` indexadas (GiST), re-paths en una sentencia | Requiere labels válidos y recomputado consistente                                                                                       | **Aceptada**                               |
| Tabla adyacencia + CTEs recursivas | Estándar SQL, sin extensión                                                   | Reordenar subárbol = actualizar `depth`/`path` de todos los descendientes igual; sin operadores de path nativos; índices menos directos | Descartada (peor rendimiento y más código) |
| `nested_set`                       | Subárbol = rango trivial                                                      | Mantenimiento caro en inserts masivos; huecos frágiles                                                                                  | Descartada                                 |
| `parent_id` + `path` en cliente    | Simple                                                                        | Consultas de subárbol y anti-ciclo en aplicación (race-prone)                                                                           | Descartada                                 |

## Consecuencias

- La migración 0001 habilita la extensión `ltree`; la API usa `path <@`, `subpath`, `nlevel` vía SQL explícito (Drizzle customType `ltree` para lectura/escritura de valores).
- Mover un nodo **dentro de sí mismo o de un descendiente** → 422 (`node.move_into_descendant`); mover a destino inexistente → 422 (`node.parent_not_found`); mover a sí mismo → 422 (`node.move_to_self`).
- Los códigos (`code`) son **inmutables** tras creación (§11.4) — garantiza la estabilidad de enlaces `/kanora/nodes/PANT-02`.
- Fuzz de 1.000 movimientos aleatorios (FND-T07/E2E) pendiente como prueba de Fase 1 completa.
