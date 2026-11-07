# 00 · Resumen ejecutivo

> Plataforma de gestión del ciclo de vida del software · Planificación técnica
> Fuente de verdad de requisitos: [`../../prompt.md`](../../prompt.md) (versión ampliada con la sección _Integración MCP y herramientas para agentes de programación_).
> Referencia de UX aprobada: [`../../muckup/`](../../muckup/) (mockup navegable en HTML, 12 vistas).

## 1. Problema

Las herramientas tradicionales de gestión de proyectos (Jira, Trello, Asana, Linear) no representan la metodología del producto:

1. La metodología **comienza por la definición funcional** (módulos → pantallas → funcionalidades), no por las tareas.
2. El **modelo de datos y el API se diseñan después**, y el desarrollo sigue esa estructura.
3. Lo que se necesita es un **sistema de conocimiento y trazabilidad** que relacione documentación, funcionalidades, tareas, modificaciones e incidencias — y conserve la historia de evolución de cada parte del software.

Ninguna herramienta genérica centra el producto en su **arquitectura funcional** como eje del conocimiento, ni diferencia el trabajo de agentes IA del trabajo humano con trazabilidad completa.

## 2. Objetivos

| #   | Objetivo                                                                                                                                      | Medible mediante                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| O-1 | Gestionar varios productos independientes en un único espacio (preparado para SaaS multi-tenant)                                              | Aislamiento verificado por pruebas de tenant-escape (ver [08](08-estrategia-pruebas.md) §7)                                 |
| O-2 | Mantener el **árbol funcional** como estructura central del conocimiento, separado del tablero de trabajo                                     | Cada elemento funcional acumula docs, tareas, incidencias, cambios y relaciones                                             |
| O-3 | Trazabilidad bidireccional entre cualquier par de elementos (pantalla, regla, caso de uso, tarea, incidencia, modificación, decisión, prueba) | Las 7 consultas canónicas ([01](01-requisitos.md) §RF-070) resueltas en < 300 ms                                            |
| O-4 | Documentación versionada e vinculada a la arquitectura funcional                                                                              | 100% de elementos de pantalla con documentación asociada en productos en uso                                                |
| O-5 | Historial inmutable de evolución por elemento                                                                                                 | `activity_log` append-only + `item_versions` inmutables                                                                     |
| O-6 | Integración con agentes de programación (Claude Code primero) mediante un servidor MCP independiente                                          | 32 herramientas MCP contratadas, lecturas habilitadas prima, escrituras confirmadas (ver [06](06-integraciones-agentes.md)) |
| O-7 | Entrega incremental por fases, sin construir todo simultáneamente                                                                             | 6 fases con criterios de aceptación verificables (ver [07](07-plan-implementacion.md))                                      |

## 3. Alcance

**Incluido en la versión planificada (v1):
** multiproducto, arquitectura funcional, documentación con versionado, tareas (árbol/tabla/kanban), incidencias, registro de modificaciones, trazabilidad y consultas inversas, seguimiento (tablas/listas), integración con agentes vía MCP + REST + Git, RBAC por producto, auditoría.

**Excluido explícitamente (v1):** facturación/SaaS comercial, SSO empresarial (SAML/SCIM), apps móviles nativas, tiempo real colaborativo (edición simultánea), automatización de despliegues (CD propio del producto), marketplace de plugins, soporte offline.

**Análisis del entorno (Paso 1):** el repositorio de trabajo está **prácticamente vacío**: contiene únicamente `prompt.md` y `muckup/` (mockup aprobado como referencia de UX). No existe código, configuración, dependencias ni `.git`. **No se inventan componentes existentes.** La estructura de monorepo propuesta en [03](03-arquitectura-tecnica.md) se crea en la Fase 1.

## 4. Decisiones principales (detalle y justificación en [09](09-riesgos-y-decisiones.md))

| ID    | Decisión                                                                                                         | Estado                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| D-001 | Monolito modular TypeScript (no microservicios)                                                                  | ✅ Confirmada por el prompt §7/§14                                             |
| D-002 | Frontend Next.js (React) + Backend NestJS, API REST/OpenAPI                                                      | 🔷 Propuesta (comparada con Remix/SvelteKit + Fastify/Hono)                    |
| D-003 | PostgreSQL 16 como única base de datos                                                                           | ✅ Confirmada por el prompt §7                                                 |
| D-004 | Drizzle ORM (SQL-first, migraciones versionadas)                                                                 | 🔷 Propuesta (comparada con Prisma y Kysely)                                   |
| D-005 | Jerarquía por adyacencia + `ltree` materializado para el árbol funcional                                         | 🔷 Propuesta (comparada con closure table / nested sets)                       |
| D-006 | Relaciones polimórficas con **integridad referencial garantizada por triggers** en Postgres (no por convención)  | 🔷 Propuesta                                                                   |
| D-007 | IDs internos **UUIDv7** + códigos legibles por producto (`PANT-02`, `TAR-231`)                                   | 🔷 Propuesta                                                                   |
| D-008 | Sesiones en servidor (DB) para humanos + **service tokens** por producto para agentes; nada de DB para agentes   | 🔷 Propuesta                                                                   |
| D-009 | Servidor **MCP independiente** (`apps/mcp-server`) que consume la API central; nunca acceso directo a PostgreSQL | ✅ Confirmada por prompt (sección MCP §1)                                      |
| D-010 | MCP **read-only primero** (v1), escrituras en v2 con confirmación humana para operaciones sensibles              | ✅ Confirmada por prompt MCP §8 ("prioriza consulta antes que modificaciones") |
| D-011 | Monorepo pnpm + Turborepo (`apps/web`, `apps/api`, `apps/mcp-server`, `packages/*`)                              | 🔷 Propuesta                                                                   |
| D-012 | Editor Markdown con CodeMirror 6 + vista previa (no WYSIWYG)                                                     | 🔷 Propuesta (comparada con TipTap)                                            |
| D-013 | Sin WebSockets en v1: SSE para feeds de actividad; polling para kanban                                           | 🔷 Propuesta                                                                   |
| D-014 | El mockup `muckup/` es la **referencia oficial de navegación y pantallas** para la Fase 1+                       | ✅ Confirmada por el usuario (2026-11-05)                                      |

## 5. Las 8 preguntas del informe final

1. **Arquitectura propuesta:** monolito modular (web + api + mcp-server) sobre PostgreSQL, límites por módulo de dominio; integraciones en paquetes aislados. Ver [03](03-arquitectura-tecnica.md).
2. **Stack:** Next.js 15 · NestJS 11 · PostgreSQL 16 · Drizzle ORM · better-auth (sesiones DB) · CodeMirror 6 · SSE · Vitest/Playwright · Docker Compose. Ver [03](03-arquitectura-tecnica.md).
3. **Estructura funcional:** 9 módulos de la plataforma, cada uno con funcionalidades, rutas y pantallas; la arquitectura funcional del _producto gestionado_ es el eje del dominio. Ver [02](02-arquitectura-funcional.md).
4. **Modelo de datos:** ~28 entidades, árbol jerárquico `ltree`, relaciones polimórficas con triggers, multiproducto por `product_id` en toda tabla de dominio + FKs compuestas. Ver [04](04-modelo-datos.md).
5. **Fases:** 6 fases (Fundamentos → Conocimiento → Trabajo → Trazabilidad → Seguimiento → Integraciones), ajustadas con la secuencia MCP read-only antes de escrituras. Ver [07](07-plan-implementacion.md).
6. **Riesgos:** 12 riesgos técnicos/funcionales con mitigación; 3 riesgos de prioridad alta. Ver [09](09-riesgos-y-decisiones.md).
7. **Decisiones pendientes:** 9 decisiones abiertas (nombre del producto, hosting, SSO, editor WYSIWYG futuro…). Ver [09](09-riesgos-y-decisiones.md) §4.
8. **Ubicación:** este directorio `docs/planificacion/`, 11 documentos con referencias cruzadas.

## 6. Qué NO hace este plan

No implementa código, no instala dependencias, no ejecuta migraciones, no crea repositorio Git ni CI, no toca `muckup/`. Todo lo anterior pertenece a la **Fase 1** y requiere tu autorización explícita.

## 7. Referencias

- Requisitos y preguntas pendientes → [01-requisitos.md](01-requisitos.md)
- Arquitectura funcional de la plataforma → [02-arquitectura-funcional.md](02-arquitectura-funcional.md)
- Decisiones tecnológicas → [03-arquitectura-tecnica.md](03-arquitectura-tecnica.md)
- Modelo de datos → [04-modelo-datos.md](04-modelo-datos.md)
- Experiencia de usuario (basada en `muckup/`) → [05-experiencia-usuario.md](05-experiencia-usuario.md)
- Capa de agentes e MCP → [06-integraciones-agentes.md](06-integraciones-agentes.md)
- Plan de fases, entregables y tareas → [07-plan-implementacion.md](07-plan-implementacion.md)
- Estrategia de pruebas → [08-estrategia-pruebas.md](08-estrategia-pruebas.md)
- Riesgos y decisiones → [09-riesgos-y-decisiones.md](09-riesgos-y-decisiones.md)
- Backlog inicial → [10-backlog-inicial.md](10-backlog-inicial.md)
