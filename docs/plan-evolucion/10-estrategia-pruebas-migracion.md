# 10 · Estrategia de pruebas y migración

## 1. Migración

- Incremental, sin eliminar datos.
- Cada migración con `.up.sql` y `.down.sql`.
- Defaults para columnas nuevas (`metadata='{}'`).
- Backfill defensivo.
- Validación de integridad antes/después:
  - conteos de filas.
  - relaciones huérfanas (query).
  - documentos sin tipo.
- No modificar datos existentes sin backup.

## 2. Pruebas de base de datos

- Integridad de relaciones (triggers).
- Prevención de duplicados (unique).
- Validación documental (CHECK status/scope).
- Versionado (append-only).
- Consultas recursivas (CTE) y prevención de ciclos.
- Restricciones por producto (tenant-escape).

## 3. Pruebas de backend

- Creación/actualización de documentos.
- Relaciones (crear/listar/eliminar).
- Consultas contextuales (`get_product_context`).
- Análisis de impacto (clasificación).
- Historial (inmutable).
- Permisos (RBAC + scopes).

## 4. Pruebas de frontend

- Navegación funcional.
- Visualización documental y filtros.
- Edición de flujos (metadata).
- Exploración de relaciones.
- Análisis de cambios.

## 5. Pruebas de agentes

- Recuperación de contexto.
- Exactitud de referencias (códigos).
- Análisis de impacto.
- Permisos (sin scopes de escritura por defecto).
- Auditoría (`agent_executions`, `activity_log`).
- Prevención de modificaciones no autorizadas.

## 6. Criterios de aceptación por fase

- E1: triggers pasan; tipos nuevos en CHECK.
- E2: Zod valida; documentos creados con metadata.
- E3: análisis reproducible; tabla inmutable.
- E4: escrituras auditadas; confirmación para sensibles.
- E5: vistas funcionales.
- E6: docs marcadas; reporte disponible.
