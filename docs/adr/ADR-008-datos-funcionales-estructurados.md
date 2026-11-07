# ADR-008 · Datos funcionales estructurados (CU, reglas, RNF, flujos)

**Estado:** Aceptada (base implementada, UI pendiente)

## Contexto

Los casos de uso, reglas de negocio, RNF y flujos se almacenan como documentos Markdown (`content_items`) vinculados a nodos. No hay campos consultables ni gestión dedicada.

## Decisión

Extender `content_items` e `item_versions` con `metadata jsonb` tipado por `docTypeKey`, validado con Zod (`FUNCTIONAL_DOCUMENT_METADATA_SCHEMAS`). No se crean tablas dedicadas.

## Alternativas

- Tablas dedicadas por kind (Option B): duplica infraestructura (versionado, adjuntos, relaciones, estados). Descartada.
- Columnas tipadas en `content_items`: explosión de NULLs y migraciones por cada nuevo campo. Descartada.
- Metadatos libres sin validación: pierde la "comodidad" de gestión. Descartada.

## Consecuencias

- Positivas: reutiliza toda la infraestructura documental; consultable vía GIN; versionado incluido; API valida por tipo.
- Negativas: la UI tipada sigue pendiente; los metadatos son JSONB (sin FK a nivel de campo).
- Riesgos: drift entre esquema Zod y UI; mitigado con un único registro compartido en `packages/shared`.
