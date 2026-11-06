# 09 · Riesgos y decisiones

Convención: **Estado** = ✅ Confirmada (prompt) · 🔷 Propuesta (esta planificación) · ⏳ Pendiente de validación. Riesgos con probabilidad × impacto (A/M/B) y mitigación verificable.

## 1. Riesgos técnicos

| ID | Riesgo | P | I | Mitigación |
|---|---|---|---|---|
| R-01 | El modelo polimórfico de `relations` corrompe integridad o degenera en datos basura (cross-kind mistakes) | M | A | Triggers de existencia por kind ([04](04-modelo-datos.md) §6–7); property-tests ([08](08-estrategia-pruebas.md) §6); barrido semanal con métrica y alerta; revisión de kinds nuevos vía ADR |
| R-02 | MCP/agentes como vía de ataque o fuga (token filtrado, tool mal diseñada, prompt-injection vía documentos) | M | A | v1 read-only; scopes mínimos por token; confirmación imposible vía token; redacción de args en auditoría; contenido de documentos = **datos no confiables**, nunca instrucciones para el agente (documentado en prompts MCP y AGENTS.md del repo gestionado); rate-limit; revisión trimestral de tokens |
| R-03 | Alcance v1 desborda al equipo (6 grandes áreas + MCP) | A | A | Fases con cortes verticales ([07](07-plan-implementacion.md)); 6a anticipada controlada; backlog recortable P2; mockup ya fija UX evitando retrabajo |
| R-04 | Kanban drag&drop y árbol virtualizado generan bugs sutiles de estado concurrente | M | M | `@dnd-kit` con tests de integración; estado kanban derivado del servidor (optimista con rollback); tree virtualizado solo sobre ≥ 200 nodos visibles |
| R-05 | Permisos granulares de documentación mal diseñados → over-fetching de datos a "Consulta" | B | A | Matriz única de permisos ([05](05-experiencia-usuario.md) §8); pruebas allow/deny por permiso en CI; principio: negar por defecto |
| R-06 | XSS vía Markdown/adjuntos (SVG, HTML inline) | M | A | remark/rehype + rehype-sanitize; DOMPurify para SVG servido; `Content-Disposition` y CSP estricta (`default-src 'self'`) |
| R-07 | better-auth joven: cambios de API propios o bugs de sesión | M | M | Fijar versión exacta; envolver en módulo `iam` propio (solo esa capa habla con better-auth); sesión en DB propia visible/revocable; fallback documentado a implementación ligera (PP-004) |
| R-08 | Confirmaciones de agentes saturan al usuario y se aprueban sin leer ("click-through approval") | M | A | Confirmación solo para sensibles (resolver INC, ejecutar MOD, publicar); resumen diff corto en la confirmación; auditoría muestra quién confirmó; métrica de confirmaciones/minuto con alerta si supera umbral |
| R-09 | Definición subjetiva de "avance" desorienta métricas | M | B | Conteo simple documentado (tareas completadas/(total)) y opción por producto de ponderar por estimación (campo preparado, desactivado v1); sin gráficos decorativos |
| R-10 | Migraciones Drizzle en prod con datos reales fallan a medias | B | A | Up/down probado en CI con seed realista; patrón expand-contract para drops; `pg_dump` previo obligatorio; runbook `docs/operar/migraciones.md` |
| R-11 | `ltree` no disponible/deseado en host gestionado (p. ej. algunos Postgres gestionados restringen extensiones) | B | M | PP-009 pendiente; Plan B documentado: closure table `node_closure` (mismo servicio `TreeService`); capa de datos nunca expone ltree a la aplicación (siempre `TreeService`) |
| R-12 | Dependencia de un único desarrollador (bus factor) | A | M | Decisiones ADR obligatorias; arquitectura simple; TypeScript estricto; mockup como contrato visual; plan por fases entregable por revisión externa |

## 2. Riesgos funcionales

| ID | Riesgo | Mitigación |
|---|---|---|
| RF-R1 | El modelo no soporta el *flujo real* de un producto cuando cambie la metodología del usuario | Tipos de nodo y estados configurables; doc_types ampliables sin migración (tablas catálogo); arquitectura de relaciones genérica |
| RF-R2 | Los agentes ensucian el workspace con tareas/MOD basura ("chat of tasks") | v1 read-only; writes solo con token dedicado revisable; rate-limit; badge AGENTE IA + filtro "ocultar trabajo IA"; política en AGENTS.md |
| RF-R3 | Pérdida de confianza en la trazabilidad si la MOD ejecutada no enlaza incidencia realmente cerrada | Flujo MOD→INC con `resolves` explícito y transición INC→Verificada separada (verificación humana o test) |
| RF-R4 | Usuarios siguen gestionando fuera de la plataforma (shadow IT) si la captura de datos es costosa | Ctrl+K, creación desde cualquier ficha ("+ tarea" inline), importación desde Markdown (Fase 2), Git linking (Fase 6) |
| RF-R5 | Expectativa de "AI mágica": el agente promete pero no entrega | Comunicación: el MCP proporciona contexto y rigor, no autonomía; todos los resultados pasan por revisión/confirmación humana; métricas de aceptación de confirmaciones |
| RF-R6 | Deriva entre mockup y producción (el equipo "mejora" el diseño y rompe coherencia) | `muckup/` congelado como referencia; todo cambio de UX requiere actualizar el mockup o ADR |

## 3. Alternativas consideradas y descartadas

| Alternativa | Por qué se descartó |
|---|---|
| Microservicios desde el inicio | Sin necesidad demostrable; 10× coste operativo; el prompt lo prohíbe explícitamente (RE-003) |
| MongoDB / documental | Sacrificaría integridad referencial y relaciones (núcleo del producto) |
| Prisma como ORM | Abstracción que penaliza ltree/CTE recursivas; migraciones menos auditables; D-004 |
| GraphQL como API pública | Autorización fina por campo compleja; cacheo y rate-limit difusos; REST+OpenAPI sirve a humanos y a MCP; revisable con datos |
| WebSockets en v1 | Unidireccionalidad suficiente (SSE); SU-008 excluye edición colaborativa |
| Better Auth / Auth.js con JWT stateless | Revocación imposible para disciplina de agentes; sesiones en DB obligatorias para revocar service accounts |
| DDD con 5 capas por módulo | Sobre-ingeniería; dominio puro + servicios de aplicación bastan a esta escala |
| Nested sets para el árbol | Movimientos O(n) con bloqueos — conflicto con concurrencia esperada |
| Construir el módulo de IA dentro de la API ("/mcp embebido") | Contradice la separación MCP del prompt; acoplamiento de ciclo de vida; ver [06](06-integraciones-agentes.md) §1 |
| Almacenar documentos como ficheros .md en Git como fuente de verdad | El prompt exige versionado documental con autores/fechas/estados y consulta desde UI; Git sería espejo, no fuente |

## 4. Decisiones pendientes (requieren tu validación)

| ID | Pregunta / decisión | Impacto si se difiere |
|---|---|---|
| PP-001 | Nombre del producto (placeholder "DevCycle") | Rebranding costoso tras más artefactos |
| PP-002 | Objetivo de despliegue v1 (VM única + Compose vs PaaS gestionado vs Coolify/Kamal) | Fase 1 (CI/CD) y [03](03-arquitectura-tecnica.md) §11 |
| PP-003 | SSO en v1 (Google/Microsoft) vs solo email+contraseña | Alcance Fase 1 |
| PP-004 | better-auth vs implementación propia de auth ligera | F1-T04 |
| PP-005 | WYSIWYG para docs en el futuro o Markdown-first permanente | Editor (D-012), expectativa de usuarios |
| PP-006 | Quién confirma acciones sensibles de agentes (mismo titular del token vs aprobador distinto) | Flujos de confirmación ([06](06-integraciones-agentes.md) §2–3) |
| PP-007 | ¿Agentes podrán lanzar CI/tests reales (webhook a CI) o solo registrar resultados? | RF-089 y diseño de `register_test_result` |
| PP-008 | Códigos de entidad por producto vs globales | Esquema (`code` UNIQUE por producto o global) |
| PP-009 | Aceptar extensión `ltree` en Postgres (vs closure table) | D-005, R-11 |
| PP-010 | Almacenamiento de adjuntos: FS local vs MinIO Compose vs S3 gestionado | Fase 2 (adjuntos) |

> Ninguna pregunta bloquea Fase 1 salvo PP-004 (elección de librería de auth) y PP-009 (árbol). Trabajo propuesto: validación en 1 sesión de 45 min antes de arrancar Fase 1.

## 5. Registro de decisiones (ADR resumido · D-xxx)

| ID | Decisión | Estado | Justificación breve |
|---|---|---|---|
| D-001 | Monolito modular TypeScript | ✅ | §7/§14; equipo pequeño; límites por módulos NestJS |
| D-002 | Next.js + NestJS | 🔷 | TS-first end-to-end; límites claros; tabla comparativa en [03](03-arquitectura-tecnica.md) §4.1–4.2 |
| D-003 | PostgreSQL 16 | ✅ | §7; integridad, ltree, FTS, jsonb |
| D-004 | Drizzle ORM | 🔷 | SQL-first; auditabilidad de migraciones; spike en Fase 1 confirma |
| D-005 | Adjacency + `ltree` para árbol | 🔷 | §5 modelo-datos; mejor lectura suabbárbol; move raro |
| D-006 | Relaciones polimórficas con triggers de integridad | 🔷 | Único modelo que equilibra §8 (integridad) y flexibilidad de kinds |
| D-007 | UUIDv7 internos + códigos legibles por producto | 🔷 | ordenación natural; UX humana (`PANT-02`); APIs públicas legibles |
| D-008 | Sesiones DB (humanos) + service tokens (agentes) | 🔷 | Revocación y scopes; MCP exige identidad de servicio |
| D-009 | Servidor MCP independiente consumiendo API | ✅ | Sección MCP §1 del prompt |
| D-010 | MCP v1 read-only; writes en v2 con confirmación | ✅ | MCP §8 "prioriza consulta antes que modificaciones" |
| D-011 | Monorepo pnpm + Turborepo | 🔷 | Un solo lenguaje y tooling; límites de paquete reforzables |
| D-012 | CodeMirror 6 + preview (Markdown-first) | 🔷 | §5.3 del prompt "Evalúa un editor Markdown"; WYSIWYG en discusión PP-005 |
| D-013 | SSE en lugar de WebSocket | 🔷 | Unidireccionalidad suficiente; menor complejidad (SU-008) |
| D-014 | Mockup `muckup/` como contrato UX | ✅ | Validado por usuario 2026-11-05 |
| D-015 | `organizations` desde v1 aunque haya una sola org | 🔷 | Evolución SaaS sin migración destructiva (§3.1) |
| D-016 | Soft-delete en dominio; append-only en auditoría/versiones | 🔷 | §5.2 desactivar sin borrar historia; §9 auditar |
| D-017 | Estados de tarea/incidencia en tablas (no enum) | 🔷 | "Estados configurables" §5.4 |
| D-018 | TypeScript estricto + zod en bordes | 🔷 | §11 RNF-001/002 |
| D-019 | CI GitHub Actions + Docker Compose self-host | 🔷 | PP-002 pendiente; reversible sin tocar dominio |
| D-020 | Sin analítica de terceros; telemetría propia en activity_log | 🔷 | Bajo costo operativo; privacidad |

## 6. Criterios de escalado/cambio de decisión

- Revisar D-002 si el spike de árbol en Next.js demuestra problemas de rendimiento; D-004 si Drizzle bloquea consultas recursivas (pasar a Kysely); D-005 si PP-009 rechaza ltree; D-013 si se aprueba colaboración real-time (pasa a WS/CRDT con ADR).
