# 10 · Backlog inicial

> Épicas (E#) → Historias de usuario (HU-###) → tareas de [07-plan-implementacion.md](07-plan-implementacion.md). Prioridad: **P0** imprescindible · **P1** necesaria para cerrar fase · **P2** diferible. Estimación: S/M/L igual que 07. Los criterios de aceptación por HU son verificables y heredan los de su fase.

## 1. Épicas y mapa de fases

| Épica | Nombre                              | Fase  | Objetivo                                   |
| ----- | ----------------------------------- | ----- | ------------------------------------------ |
| E1    | Cimientos del monorepo y CI         | F1    | Repo listo para código protegido por CI    |
| E2    | Identidad, organizaciones y RBAC    | F1    | Entrada segura y aislamiento base          |
| E3    | Gestión multiproducto               | F1    | Espacios de trabajo + organización general |
| E4    | Arquitectura funcional (árbol)      | F1    | Árbol configurable y ficha integral        |
| E5    | Documentación versionada            | F2    | Conocimiento tipado y auditable            |
| E6    | Tareas e incidencias                | F3    | Trabajo vinculado y tablero                |
| E7    | Modificaciones y trazabilidad       | F4    | Historia y relaciones de primer orden      |
| E8    | Seguimiento y búsqueda              | F5    | Visibilidad y cobertura                    |
| E9    | Integración con agentes (MCP + Git) | F6    | Colaboración humano-agente con gobierno    |
| E10   | Calidad transversal                 | todas | Pruebas, seguridad, migraciones, docs      |

## 2. Historias de usuario (resumen ejecutable)

| ID     | HU                                                                                                 | Épica | Pri | Est | Dep            | Criterios de aceptación (resumen)                                   |
| ------ | -------------------------------------------------------------------------------------------------- | ----- | --- | --- | -------------- | ------------------------------------------------------------------- |
| HU-001 | Como desarrollador quiero monorepo con CI obligatorio para que nada roto llegue a main             | E1    | P0  | M   | —              | PR verde exige lint+typecheck+test; `main` protegida                |
| HU-002 | Como desarrollador quiero migraciones reversibles para desplegar sin miedo                         | E1    | P0  | M   | —              | up/down en CI con seed realista                                     |
| HU-003 | Como usuario quiero registro/login con sesión persistente y revocable                              | E2    | P0  | M   | HU-001         | Login ok; sesión revocada expira en < 1 min                         |
| HU-004 | Como admin quiero asignar roles por producto para controlar quién hace qué                         | E2    | P0  | M   | HU-003         | Matriz permisos aplicada; rol Consulta no escribe (test allow/deny) |
| HU-005 | Como admin quiero invitar por email a miembros con token de un solo uso                            | E2    | P1  | M   | HU-004         | Invitación expira 7 días; un solo uso                               |
| HU-006 | Como admin de org quiero ver métricas agregadas de todos los productos sin ver contenido           | E3    | P0  | M   | HU-001         | Vista orgánica sin datos de dominio (solo agregados)                |
| HU-007 | Como admin quiero crear producto con espacio completo (tipos, estados, MCP off) en un paso         | E3    | P0  | M   | HU-004         | Producto operativo < 1 min tras creación                            |
| HU-008 | Como arquitecto funcional quiero definir nodos de tipos propios (color/icono) además de los 8 base | E4    | P0  | M   | HU-007         | Tipo personalizado aparece en árbol, ficha y filtros                |
| HU-009 | Como arquitecto quiero mover nodos entre ramas sin romper códigos ni historia                      | E4    | P0  | L   | HU-008         | Move conserva hijos, relaciones e ltree íntegro (fuzz test)         |
| HU-010 | Como arquitecto quiero duplicar un subárbol (p. ej. PANT-xx → PANT-yy)                             | E4    | P1  | M   | HU-008         | Duplicado copia códigos nuevos; original intocado                   |
| HU-011 | Como usuario quiero abrir la ficha del elemento con sus 7 pestañas y ver datos reales              | E4    | P0  | L   | HU-009         | Pestañas con contadores reales; vacías con CTA                      |
| HU-012 | Como redactor técnico quiero crear documentos con 13+ tipos y estados                              | E5    | P0  | M   | HU-011         | Los 14 tipos creables; borrador→vigente con permiso                 |
| HU-013 | Como revisor quiero comparar versiones de un documento (diff)                                      | E5    | P1  | M   | HU-012         | Diff visible entre vN y vN+1                                        |
| HU-014 | Como redactor quiero adjuntar diagramas/adjuntos seguros                                           | E5    | P1  | M   | HU-012         | MIME+size validados; SVG sanitizado                                 |
| HU-015 | Como usuario quiero buscar en todo el producto (docs, códigos, texto)                              | E5    | P1  | M   | HU-012         | "PANT-02" y texto libre < 100 ms                                    |
| HU-016 | Como desarrollador quiero crear tareas vinculadas a N nodos desde la ficha                         | E6    | P0  | M   | HU-011         | Tarea visible en kanban global y en ambas fichas                    |
| HU-017 | Como desarrollador quiero tablero kanban con drag&drop que respete transiciones                    | E6    | P0  | L   | HU-016         | DnD a estado no permitido → 409 con aviso                           |
| HU-018 | Como responsable quiero dependencias entre tareas con detección de ciclos                          | E6    | P1  | M   | HU-016         | Ciclo rechazado con mensaje                                         |
| HU-019 | Como QA quiero registrar incidencias con pasos, severidad y evidencias                             | E6    | P0  | M   | HU-011         | Flujo completo reproducir→adjuntar→vincular                         |
| HU-020 | Como dev quiero transicionar incidencias Abierta→…→Verificada controladamente                      | E6    | P0  | M   | HU-019         | Transiciones inválidas bloqueadas (test matriz)                     |
| HU-021 | Como tech lead quiero ver MOD propuesta/ejecutada con evidencia Git enlazada                       | E7    | P0  | M   | HU-017         | MOD enlaza commit/PR; estado visible                                |
| HU-022 | Como tech lead quiero ejecutar la MOD resolviendo SUS incidencias en una transacción               | E7    | P0  | M   | HU-021         | MOD executed + INC verificada atómicas                              |
| HU-023 | Como arquitecto quiero consultar "¿qué tareas afectan esta pantalla?"                              | E7    | P0  | M   | HU-021         | Endpoint + UI; p95 < 300 ms                                         |
| HU-024 | Como arquitecto quiero grafo de relaciones del elemento con navegación                             | E7    | P1  | L   | HU-023         | Grafo renderiza y cada nodo abre su ficha                           |
| HU-025 | Como usuario quiero ver avance por módulo y del producto (tablas, no tarjetas)                     | E8    | P1  | M   | HU-016         | Avance exacto tras cerrar tareas (e2e)                              |
| HU-026 | Como PM quiero cobertura documental y de pruebas por nodo                                          | E8    | P1  | M   | HU-013         | Listados "sin doc"/"sin pruebas" exactos                            |
| HU-027 | Como admin quiero activar integración MCP read-only para mi producto                               | E9    | P0  | M   | HU-004         | Token mostrado 1 vez; `claude mcp list` OK                          |
| HU-028 | Como agente quiero get_product_context de un nodo para preparar implementación                     | E9    | P0  | M   | HU-027         | ≤ 32 KB; ≤ 500 ms; auditado con actor=agent                         |
| HU-029 | Como agente quiero registrar pruebas ejecutadas vinculadas al caso                                 | E9    | P1  | M   | HU-028         | Resultado visible en cobertura del CU                               |
| HU-030 | Como admin quiero aprobar/rechazar acciones sensibles propuestas por agente                        | E9    | P1  | L   | HU-029         | Sin aprobación no se ejecuta; auditoría completa                    |
| HU-031 | Como dev quiero que commits con MOD-031 vinculen automáticamente la MOD                            | E9    | P2  | M   | HU-021, HU-027 | Commit → relación creada (test webhook)                             |
| HU-032 | Como admin quiero exportar CSV de avance para comité                                               | E8    | P2  | S   | HU-025         | CSV válido                                                          |

**Totales:** 32 HU · P0 = 21 · P1 = 8 · P2 = 3 · cobertura de las 9 épicas funcionales.

## 3. Descomposición en tareas

Las tareas verificables (`F#-T##`, dependencias, criterios) están en [07-plan-implementacion.md](07-plan-implementacion.md) §2–§7: F1 12 tareas · F2 9 · F3 9 · F4 8 · F5 6 · F6a 3 · F6b 6 · F6c 3 · F6d 2 = **58 tareas**. Mapeo épico ↔ tareas: E1→F1-T01..03,T10 · E2→F1-T04,05,06 · E3→F1-T06,08,12 · E4→F1-T07,08,09 + F4-T04,06 · E5→F2-* · E6→F3-* · E7→F4-* · E8→F5-* · E9→F6a..d · E10→cobertura transversal (CI, suites de [08](08-estrategia-pruebas.md)).

## 4. Priorización y secuencia de entrega sugerida

```
Semana 1–4   F1 (P0)              → HU-001..011
Semana 3–6   F2 (P0 parcial: T01–T04, T06, T08)
Semana 5–6   F6a (P0) en paralelo
Semana 6–9   F3 (P0)              → HU-016..020
Semana 9–11  F4 (P0)              → HU-021..024
Semana 11–13 F5 (P1)              → HU-025, HU-026
Semana 13–16 F6b/c/d (P1)         → HU-027..031
Semana 16+   P2 backlog           → HU-005, HU-010(?), HU-031, HU-032
```

(El orden F2 antes de F3 es recomendado pero intercambiable; ver nota de capacidad en [07](07-plan-implementacion.md) §0.)

## 5. Dependencias críticas externas

- Cuenta/infra de despliegue (PP-002) → bloquea F1-T10 (deploy staging), no el desarrollo local.
- Acceso a Claude Code para validar F6b (HU-027) → bloquea cierre de Fase 6, no su desarrollo.
- Decisión PP-009 sobre `ltree` → bloquea F1-T02 (elección de migración 001) — resolver antes del día 3.
- PP-004 better-auth → bloquea F1-T04 — resolver en la misma sesión de validación.
