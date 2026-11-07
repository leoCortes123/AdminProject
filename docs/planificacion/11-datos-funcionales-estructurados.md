# 11 · Datos funcionales estructurados (CU, reglas, RNF, flujos)

> Estado: **Diseño + base implementada (migración 0009, metadatos tipados en `content_items`/`item_versions`, validación en API).** La UI tipada y la integración con la ficha quedan como siguiente iteración.

## 1. Problema

Hoy los casos de uso, reglas de negocio, requisitos no funcionales y flujos se almacenan como **documentos** (`content_items` con `docTypeKey ∈ {use_case, business_rule, req_non_functional, workflow}`) vinculados a nodos mediante `item_node_links`. El cuerpo es Markdown libre, por lo que:

- No hay campos consultables (actor, condición/acción, métrica/umbral, pasos del flujo).
- La ficha de Funcionalidad solo muestra enlaces `DOC-xxx · título`.
- Los agentes (`get_product_context`) reciben solo `code + title` para reglas y casos de uso.
- La gestión obliga a abrir el editor de Documentación y recordar la convención de cada tipo.

Se busca **guardar estos datos de forma estructurada en la base de datos** y **visualizarlos/administrarlos cómodamente en la aplicación**, sin romper el versionado, los vínculos a nodos, las relaciones ni la búsqueda existentes.

## 2. Decisión

**No crear tablas paralelas ni un nuevo tipo de entidad.** Se extiende el supertipo documental existente (`content_items`) con una columna `metadata jsonb` tipada por `docTypeKey`, y se valida contra esquemas Zod por tipo. Se reutiliza así:

- Versionado (`item_versions`) — ahora también congela `metadata`.
- Vínculos a nodos (`item_node_links`) y relaciones (`relations`, kind = `item`).
- Estados de publicación, adjuntos, comentarios, auditoría y FTS.
- Toda la infraestructura de Documentación (editor, diff, permisos).

Esto es **Option A** (metadatos tipados sobre documentos). La Option B (tablas dedicadas por kind) se descarta por duplicar infraestructura; se reserva como evolución si aparecen consultas/reportes que el JSONB no resuelva.

## 3. Modelo de datos

### 3.1 Migración `0009_functional_metadata`

```sql
ALTER TABLE content_items  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE item_versions  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX content_items_metadata_gin_idx ON content_items USING gin (metadata);
```

Reversible (`0009_functional_metadata.down.sql`). Ya aplicada en demo.

### 3.2 Drizzle (`packages/db/src/schema.ts`)

- `contentItems.metadata: jsonb('metadata').notNull().default(sql"'{}'::jsonb")`
- `itemVersions.metadata: jsonb('metadata').notNull().default(sql"'{}'::jsonb")`

### 3.3 Esquemas tipados (`packages/shared/src/schemas.ts`)

| docTypeKey           | Campos estructurados                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `use_case`           | `actor`, `goal`, `preconditions[]`, `mainFlow[]`, `alternativeFlows[]`, `postconditions[]`, `priority`                                             |
| `business_rule`      | `condition`, `action`, `scope`, `exceptions[]`, `owner`                                                                                            |
| `req_non_functional` | `category` (performance/security/usability/availability/maintainability/portability/other), `metric`, `threshold`, `measurementMethod`, `priority` |
| `workflow`           | `trigger`, `steps[] { order, action, actor?, system? }`, `exceptions[]`                                                                            |

Registro exportado: `FUNCTIONAL_DOCUMENT_METADATA_SCHEMAS` (`Record<docTypeKey, zodSchema>`).

## 4. API

- `DocumentDto` y `DocumentVersionDto` incluyen `metadata: Record<string, unknown>`.
- `createDocumentSchema` / `updateDocumentSchema` / `createVersionSchema` aceptan `metadata` (opcional en update/version, default `{}` en create).
- El servicio valida `metadata` contra el esquema del `docTypeKey` efectivo (create: `input.docTypeKey`; update/version: el tipo efectivo tras resolver el documento). Inválido → `422` con detalle por campo.
- `publishDocument` congela `metadata` en `item_versions`.
- `createVersion` congela `input.metadata ?? current.metadata`.

## 5. UI / gestión cómoda (siguiente iteración)

### 5.1 Editor de Documentación

- Al seleccionar uno de los cuatro tipos en el diálogo de alta/edición, mostrar un panel **"Datos estructurados"** encima del editor Markdown con los campos del esquema (inputs, textareas, listas editables).
- El Markdown sigue siendo la narrativa (flujo detallado, ejemplos, criterios de aceptación); `metadata` es el resumen consultable.
- Autosave del borrador incluye `metadata`.

### 5.2 Ficha de Funcionalidad (`tree-view.tsx`)

- Sustituir la lista plana de enlaces por tarjetas compactas por tipo:
  - **Casos de uso**: código · título · actor · objetivo (goal) · Nº de pasos del flujo principal.
  - **Reglas de negocio**: código · título · condición → acción.
  - **RNF**: código · título · categoría · métrica/umbral.
  - **Flujos**: código · título · disparador · Nº de pasos.
- Cada tarjeta enlaza al documento (edición) y permite expandir el flujo completo.
- CTA "Añadir caso de uso/regla/…" abre el editor con el tipo preseleccionado y el nodo vinculado.

### 5.3 Búsqueda y agentes

- `get_product_context`: para `rules` y `useCases` incluir `actor`, `condition`/`action`, `category`/`threshold` además de `code + title`. Añadir sección `nonFunctionalRequirements` (hoy ausente).
- FTS: incluir `metadata` (valores textuales) en `search_tsv` de `content_items` en una migración futura si se requiere búsqueda por actor/condición.

## 6. Por qué no tablas dedicadas (Option B)

- Duplicaría versionado, adjuntos, comentarios, relaciones, estados y auditoría.
- Rompería la relación `relations kind=item` y la búsqueda unificada.
- El JSONB + GIN cubre las consultas previsibles (por actor, por categoría, por umbral) sin nuevas tablas.

Si en el futuro se necesitan reportes agregados (p. ej. "todos los RNF de performance sin umbral"), se puede añadir una vista materializada sobre `content_items.metadata` sin cambiar el modelo.

## 7. Criterios de aceptación (cuando se cierre la UI)

1. Crear un caso de uso desde la ficha de un nodo y rellenar actor/flujo principal; se guarda en `content_items.metadata` y se versiona.
2. La ficha muestra el resumen estructurado, no solo el enlace.
3. `get_product_context` devuelve los campos estructurados.
4. Metadatos inválidos (p. ej. `priority: 'foo'`) → 422 con detalle.
5. Migración up/down reversible (ya verificado).

## 8. Tareas sugeridas

| ID     | Tarea                                                      | Tam       |
| ------ | ---------------------------------------------------------- | --------- |
| F7-T01 | Migración 0009 + Drizzle + shared schemas + validación API | S (hecho) |
| F7-T02 | UI editor: panel de datos estructurados por tipo           | M         |
| F7-T03 | UI ficha: tarjetas estructuradas en Funcionalidad          | M         |
| F7-T04 | Integración context service + sección NFR                  | S         |
| F7-T05 | FTS sobre metadata (opcional)                              | S         |
| F7-T06 | Pruebas: validación, versionado de metadata, context       | M         |
