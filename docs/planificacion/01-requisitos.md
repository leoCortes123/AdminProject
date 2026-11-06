# 01 · Requisitos

Convención de IDs: `RF-###` funcional · `RNF-###` no funcional · `RE-###` restricción · `SU-###` supuesto · `PP-###` pregunta pendiente.
Origen: `prompt.md` §2–§15 y sección *Integración MCP*. Nada de lo aquí listado se inventa fuera de esas fuentes.

## 0. Análisis del entorno (Paso 1)

| Aspecto | Estado observado (2026-11-05) |
|---|---|
| Repositorio | **No es repositorio Git.** Contiene solo `prompt.md` (985 líneas, ampliado con MCP) y `muckup/` (mockup aprobado como referencia UX) |
| Código fuente | Ninguno |
| Dependencias / configuración | Ninguna |
| Documentación | `prompt.md` + `muckup/README.md` |
| Herramientas disponibles | Entorno local Linux, Node/npm sin verificar instalación; sin Docker Compose definido aún |
| Riesgo derivado | Fase 1 debe incluir `git init`, estructura de monorepo, CI mínimo y `.gitignore` antes de tocar funcionalidad |

## 1. Requisitos funcionales

### 1.1 Organización y multiproducto

| ID | Requisito | Origen |
|---|---|---|
| RF-001 | Crear, editar y desactivar productos; cada producto es un espacio de trabajo aislado | §3.1, §5.1 |
| RF-002 | Vista de **organización general** con consulta transversal (métricas agregadas) sin mezclar datos de productos | §3.1 |
| RF-003 | Configuración general por producto: descripción, objetivos, estado, información tecnológica (stack, repos, entornos), integrantes, documentación global, actividad | §5.1 |
| RF-004 | El producto es la entidad central: toda tabla de dominio lleva `product_id` y las relaciones entre productos están prohibidas | §4, §3.1, §9 |
| RF-005 | Arquitectura preparada para evolución SaaS (tenant = producto u organización, sin reescritura de esquema) | §3.1 |

### 1.2 Arquitectura funcional (árbol)

| ID | Requisito | Origen |
|---|---|---|
| RF-010 | Árbol funcional jerárquico configurable por producto: Módulo, Submódulo, Pantalla, Pestaña, Componente, Proceso, Servicio y tipos personalizados | §5.2 |
| RF-011 | Operaciones sobre nodos: crear, modificar, reorganizar jerarquía, mover (incl. entre ramas), duplicar estructura, desactivar (soft-delete, conserva historial) | §5.2 |
| RF-012 | Los productos no están obligados a usar la misma jerarquía ni los mismos tipos de nodo | §5.2 |
| RF-013 | Diferencia entre **nodos estructurales** (product_nodes) y **elementos documentales** (content_items): vinculables pero no intercambiables | §5.2 |
| RF-014 | Cada nodo expone ficha integral con pestañas: Resumen · Funcionalidad · Documentación · Tareas · Incidencias · Relaciones · Historial; las pestañas se adaptan al tipo de elemento | §6 |
| RF-015 | Consultar historial y relaciones desde cualquier nodo | §5.2, §5.7 |
| RF-016 | Códigos legibles únicos por producto y nodo (`M01`, `SM01`, `PANT-02`, `CMP-118`) además del UUID interno | §5, §8 |

### 1.3 Documentación

| ID | Requisito | Origen |
|---|---|---|
| RF-020 | Los 13 tipos documentales: especificación funcional, descripción de pantalla, caso de uso, flujo de trabajo, regla de negocio, requisito funcional, requisito no funcional, modelo de datos, contrato API, especificación técnica, decisión arquitectónica, manual técnico, documentación de pruebas | §5.3 |
| RF-021 | Varios documentos por nodo; varios nodos por documento; relación documento↔documento (p. ej. RF → RN → CU) | §5.3 |
| RF-022 | Versionado documental completo: autor, fecha, mensaje de cambio, diff; versiones inmutables; sin sobreescritura | §5.3 |
| RF-023 | Editor Markdown con vista previa; almacenamiento de adjuntos y diagramas (archivos en storage S3-compatible, metadatos en DB) | §5.3 |
| RF-024 | Estados de documento: borrador → en revisión → vigente (transiciones controladas); búsqueda full-text | §5.3, §5.8 |
| RF-025 | Markdown export bajo demanda (ficheros fuera de la aplicación) e **importación** desde repo en Fase 6 (Git) | §3.3, MCP §3 |

### 1.4 Tareas

| ID | Requisito | Origen |
|---|---|---|
| RF-030 | Tarea con: título, descripción, tipo (desarrollo, análisis, documentación, mantenimiento), estado, prioridad, responsable, creación, fecha límite, estimación | §5.4 |
| RF-031 | Dependencias entre tareas (bloquea/está bloqueada por); criterios de aceptación; relaciones con nodos y documentos | §5.4 |
| RF-032 | Una tarea puede vincular **varios** elementos funcionales y viceversa | §5.4, §4 |
| RF-033 | Estados configurables por producto con transiciones controladas; estado especial `Bloqueada` transversal | §5.4 |
| RF-034 | Comentarios, historial de cambios e indicadores de asignación; menciones | §5.4 |
| RF-035 | Vista global de tareas con alternancia **Árbol / Tabla / Kanban**; filtros por producto, tipo, estado, prioridad, responsable y nodo funcional | §6 |

### 1.5 Incidencias

| ID | Requisito | Origen |
|---|---|---|
| RF-040 | Registro de incidencia con: descripción, comportamiento esperado, observado, pasos de reproducción, severidad, prioridad, estado, responsable | §5.5 |
| RF-041 | Vínculo incidencia ↔ elementos afectados, ↔ tareas, ↔ modificaciones correctivas, ↔ evidencias (adjuntos) | §5.5 |
| RF-042 | Estados configurables reutilizando el motor de flujos (§5.4) o propio; `Verificada` como estado terminal | §5.5 |

### 1.6 Modificaciones

| ID | Requisito | Origen |
|---|---|---|
| RF-050 | Registro de modificaciones funcionales y técnicas; estado **Propuesta** vs **Ejecutada** | §5.6 |
| RF-051 | Vínculo modificación ↔ elementos afectados, tareas, incidencias resueltas, documentos modificados, decisiones, referencias Git (repo, rama, commit, PR, ficheros) | §5.6, MCP §7 |
| RF-052 | Historia consultable por pantalla/elemento ("¿qué cambios tocó PANT-02?") | §5.6, §5.7 |
| RF-053 | Un cambio ejecutado mediante agente queda marcado con `actor_type = agent` y referencia a la ejecución | §5.9, MCP §5 |

### 1.7 Trazabilidad

| ID | Requisito | Origen |
|---|---|---|
| RF-060 | Sistema de relaciones genérico entre elementos de tipos heterogéneos (nodo, documento, tarea, incidencia, modificación, decisión, prueba, caso de uso, regla) | §4, §5.7 |
| RF-061 | Consulta bidireccional ("salientes"/"entrantes") y transitiva acotada (profundidad ≤ 3) | §5.7 |
| RF-062 | Las 7 consultas canónicas implementadas como endpoints + vista: tareas de una pantalla, pantallas de una regla, documentos de un proceso, modificaciones de una funcionalidad, pruebas de un caso de uso, incidencias de un módulo, dependientes de un componente | §5.7 |
| RF-063 | Vista de relaciones/grafo por elemento; integridad de relaciones verificada y sin huérfanos | §5.7, §11 |

### 1.8 Seguimiento

| ID | Requisito | Origen |
|---|---|---|
| RF-070 | Panel por producto: actividad reciente, pendientes, bloqueadas, incidencias abiertas, avance por módulo y por producto, sin documentación, sin pruebas, modificaciones recientes | §5.8 |
| RF-071 | Presentación en tablas, listas y vistas jerárquicas; sin tarjetas saturadas ni gráficos decorativos | §5.8, §6 |
| RF-072 | Búsqueda global (full-text + códigos) sobre nodos, documentos, tareas, incidencias y cambios | §5.8, §6 |
| RF-073 | Cobertura documental y cobertura de pruebas por nodo/módulo/producto | §5.8 |

### 1.9 Agentes e MCP

| ID | Requisito | Origen |
|---|---|---|
| RF-080 | Capa de integración independiente: la plataforma no se acopla a un proveedor de agentes; Claude Code es el primer cliente | §3.3, §5.9 |
| RF-081 | Servidor MCP independiente en TypeScript (SDK oficial), consume la API central con token de servicio por producto; **nunca** acceso directo a PostgreSQL | MCP §1 |
| RF-082 | 32 herramientas MCP en 6 grupos (consulta producto, documentación, tareas, incidencias, trazabilidad, pruebas) con contratos de entrada/salida, versionado y validación | MCP §2 |
| RF-083 | Recursos MCP con URIs estables (árbol, doc de módulo/pantalla, reglas, ADRs, contratos API, tareas asignadas, historial); un recurso permite contexto completo de pantalla | MCP §3 |
| RF-084 | 7 prompts MCP reutilizables (analizar pantalla, preparar implementación, analizar incidencia, revisar modificación, actualizar documentación, generar pruebas, revisar criterios de aceptación) | MCP §4 |
| RF-085 | Operación `get_product_context`: contexto estructurado por módulo/pantalla/componente sin información innecesaria | MCP §6 |
| RF-086 | Autorización por producto y permiso (scopes de lectura/escritura); auditoría de cada operación; distinción humano/agente; confirmación para operaciones sensibles | §5.9, MCP §5 |
| RF-087 | MCP v1 = solo consulta; escrituras (crear/actualizar) en v2 con confirmación humana; `register_change`/`resolve_issue` requieren confirmación | MCP §8 |
| RF-088 | Integración Git: vincular commits/PRs con MOD y elementos funcionales; Git no sustituye el historial funcional | MCP §7 |
| RF-089 | Registro de pruebas ejecutadas por agentes (`register_test_result`) vinculado al caso de prueba y al contexto de ejecución | MCP §2, §5 |

### 1.10 Seguridad y administración

| ID | Requisito | Origen |
|---|---|---|
| RF-090 | Roles: Administrador global, Administrador de producto, Colaborador, Consulta; permisos por producto | §9 |
| RF-091 | Permisos granulares para documentación (leer/editar/publicar/borrar versiones) y operaciones sensibles | §9 |
| RF-092 | Aislamiento estricto: ninguna consulta devuelve datos de otro producto; verificado por pruebas §08 | §3.1, §9 |
| RF-093 | Auditoría append-only de operaciones sensibles (quién, qué, cuándo, sobre qué entidad, desde dónde) | §9, §5.9, MCP §5 |
| RF-094 | Integraciones externas controladas: tokens con hash, revocación, scopes, rate-limit, rotación | §9, MCP §5 |

## 2. Requisitos no funcionales

| ID | Requisito | Objetivo verificable |
|---|---|---|
| RNF-001 | TypeScript estricto en todo el monorepo | `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`; `tsc --noEmit` limpio en CI |
| RNF-002 | Validación de entradas en los bordes (HTTP/MCP) con esquemas (zod); errores RFC 9457 (`application/problem+json`) | 100% endpoints validados; fuzzing de payloads en CI |
| RNF-003 | Latencia API p95 | < 300 ms lectura, < 500 ms escritura (sin adjuntos), medida en staging |
| RNF-004 | Disponibilidad del despliegue self-host | ≥ 99.5% mensual; RPO ≤ 24 h (backup diario), RTO ≤ 4 h |
| RNF-005 | Integridad referencial sin huérfanos | 0 filas huérfanas en barrido semanal automatizado |
| RNF-006 | Aislamiento multiproducto | 0 fugas cross-tenant en suite de aislamiento (100% de endpoints × 2 productos) |
| RNF-007 | Acceso concurrente | 50 usuarios por producto con degradación lineal en kanban y árbol |
| RNF-008 | Trazabilidad auditada | Toda escritura genera `activity_log`; consulta "quién tocó X" en O(log n) |
| RNF-009 | Mantenibilidad | Cobertura ≥ 80% en dominio core; ≤ 2 dependencias de infraestructura nuevas por fase sin ADR |
| RNF-010 | Seguridad | OWASP ASVS nivel 2 para auth/permisos; secretos solo en variables de entorno; sin secretos en repo |
| RNF-011 | Costos operativos | Self-host en 1 VM (2 vCPU/4 GB) + Postgres gestionado opcional; MCP server < 100 MB RSS idle |
| RNF-012 | Escabilidad del árbol | Subárbol de 5.000 nodos renderizado en < 100 ms (SSR + virtualización cliente) |

## 3. Restricciones

| ID | Restricción | Origen |
|---|---|---|
| RE-001 | TypeScript como lenguaje principal en web, API y MCP | §7 |
| RE-002 | PostgreSQL como primera alternativa de base de datos | §7 |
| RE-003 | No microservicios sin necesidad demostrable; monolito modular inicial | §7, §14 |
| RE-004 | Sin instalar dependencias ni ejecutar migraciones antes de autorización (esta fase no implementa nada) | §14 |
| RE-005 | No modificar ficheros existentes fuera de `docs/planificacion/` (muckup aprobado se conserva intacto) | §14, decisión usuario 2026-11-05 |
| RE-006 | Cada decisión arquitectónica debe documentarse con justificación | §14 |
| RE-007 | El árbol funcional no se convierte en tablero de tareas; sincronizados solo por relaciones | §3.2 |
| RE-008 | Los agentes no acceden a la base de datos directamente; toda operación pasa por API central | MCP §1 |
| RE-009 | Git no sustituye el historial funcional (`activity_log`/`changes`); es una fuente auxiliar enlazada | MCP §7 |
| RE-010 | El plan distingue decisiones Confirmadas (prompt) / Propuestas (esta planificación) / Pendientes de validación | §14 |

## 4. Supuestos (no confirmados — no son requisitos)

- **SU-001** El equipo es pequeño (1–5 devs) y TypeScript es la competencia principal. → Impacta elección NestJS sobre alternativas.
- **SU-002** El primer objetivo de despliegue es self-host / on-premise o VM única, con SaaS como horizonte, no como v1.
- **SU-003** El volumen previsto v1 es bajo: ≤ 10 productos, ≤ 5.000 nodos por producto, ≤ 100 usuarios concurrentes.
- **SU-004** Claude Code es el primer (y por ahora único) cliente MCP; otros clientes (Cursor, OpenCode, Cline) llegarán sin cambios de contrato.
- **SU-005** El idioma funcional del dominio es español (códigos, tipos de nodo, estados); la UI puede internacionalizarse más tarde.
- **SU-006** Los ADRs (decisiones arquitectónicas) viven como documentos (doc_type=`adr`), no como entidad separada.
- **SU-007** Las pruebas automatizadas del proyecto (unit/integration/e2e) viven en el repo del producto gestionado; la plataforma solo registra resultados, no los ejecuta (salvo lanzar suites vía CI en fase 6, opcional).
- **SU-008** No habrá edición colaborativa en tiempo real en v1 (sin CRDT/OT).

## 5. Preguntas pendientes de validación

| ID | Pregunta | Bloquea / afecta |
|---|---|---|
| PP-001 | ¿Nombre del producto? (placeholder actual: "DevCycle") | Branding, dominios, repo |
| PP-002 | ¿Objetivo de despliegue real para v1: VM única, Docker Compose en servidor propio, o gestionado (p. ej. Coolify/Kamal)? | [03](03-arquitectura-tecnica.md) §11, §07 Fase 1 |
| PP-003 | ¿Se requiere SSO (Google/Microsoft) ya en v1 o basta email+contraseña? | Auth en Fase 1 |
| PP-004 | ¿better-auth como librería de auth o implementación propia ligera sobre sesiones en DB? | D-008 |
| PP-005 | ¿El editor de documentos debe admitir WYSIWYG en algún momento, o Markdown-first permanente? | Elección CodeMirror (D-012) |
| PP-006 | ¿MCP v2 (escrituras) se habilita por producto o global? ¿Quién confirma: el mismo usuario titular del token o un aprobador distinto? | [06](06-integraciones-agentes.md) §permisos |
| PP-007 | ¿Los agentes podrán ejecutar pruebas E2E/CI por webhook, o solo registrar resultados manuales/externos? | RF-089, Fase 6 |
| PP-008 | ¿Se parametrizarán los códigos de entidad por producto (`PANT-02`) o serán globales? | RF-016 |
| PP-009 | ¿Se acepta la extensión `ltree` de PostgreSQL (requiere `CREATE EXTENSION`) o se exige 100% core? | D-005, [04](04-modelo-datos.md) §8 |
| PP-010 | ¿Evidencias y adjuntos: almacenamiento local en VM, MinIO self-host o S3 gestionado? | [03](03-arquitectura-tecnica.md) §9 |

> Las preguntas pendientes **no se responden aquí**: se documentan para tu validación. Ver [09-riesgos-y-decisiones.md](09-riesgos-y-decisiones.md) §4.
