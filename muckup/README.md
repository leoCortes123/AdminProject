# DevCycle — Mockup de la estructura del software

> **Qué es:** un prototipo navegable en HTML/CSS/JS puro de la estructura, navegación y pantallas principales que debería tener la plataforma de gestión del ciclo de vida del software descrita en `../prompt.md`.
> **Qué no es:** no es la aplicación, no tiene backend, base de datos ni persistencia. Todos los datos son **ficticios** (`js/data.js`). Ninguna acción persiste: los botones muestran un aviso "acción simulada".
> **Nombre:** "DevCycle" es un placeholder; el producto no tiene nombre en el prompt.

El mockup **no ejecuta el plan de `prompt.md`** (no genera `docs/planificacion/` ni implementa nada). Solo materializa visualmente la estructura propuesta en su sección 6 (experiencia de usuario) y en los módulos de las secciones 3–5.

## Cómo verlo

Abre `index.html` en cualquier navegador moderno (no requiere servidor):

```
muckup/index.html
```

Atajos: `Ctrl/Cmd + K` abre el buscador global · `Esc` cierra. El selector superior izquierdo alterna entre **Organización general** y cada producto (Kanora, Verdana, Núcleo).

## Estructura de la carpeta

```
muckup/
├── index.html      Shell (sidebar, topbar) + las 12 vistas
├── css/styles.css  Sistema visual (sin frameworks)
├── js/data.js      Datos de ejemplo ficticios (productos, nodos, tareas, docs…)
├── js/app.js       Navegación, renderizado, filtros, paleta de comandos
└── README.md       Este documento
```

## Mapa: secciones del prompt → pantallas del mockup

| Prompt | Vista del mockup | Contenido |
|---|---|---|
| §3.1 Multiproducto / organización general | **Productos** (context = organización) | Tabla transversal de productos, KPIs agregados, aviso de aislamiento |
| §3.2 Árbol funcional ≠ tablero | **Arquitectura funcional** (árbol) + **Tareas** (kanban/tabla) | Dos mecanismos sincronizados por relaciones, nunca fusionados |
| §5.1 Gestión de productos | **Productos** y **Resumen** | Tabla general; ficha de producto: descripción, objetivos, stack, repo, integrantes, actividad, avance |
| §5.2 Arquitectura funcional | **Arquitectura funcional** | Árbol configurable: Módulo, Submódulo, Pantalla, Pestaña, Componente, Proceso, Servicio, Otros · operaciones crear/mover/duplicar/desactivar · leyenda de tipos |
| §6 Ficha integral + pestañas | **Arquitectura funcional** → panel derecho | Pestañas: Resumen · Funcionalidad · Documentación · Tareas · Incidencias · Relaciones · Historial (contadores reales sobre el mock) |
| §5.3 Documentación | **Documentación** | 13 tipos documentales filtrables, búsqueda, vista previa, versionado (`item_versions`), adjuntos, vínculos |
| §5.4 Gestión de tareas | **Tareas** | Vista global conmutables **Árbol / Tabla / Kanban**, filtros por tipo/estado/prioridad/responsable, tareas ligadas a nodos |
| §5.5 Gestión de incidencias | **Incidencias** | Maestro–detalle: severidad, prioridad, pasos de reproducción, evidencias, tareas e incidencias correctivas vinculadas |
| §5.6 Registro de modificaciones | **Modificaciones** | Cambios propuestos vs ejecutados, elementos afectados, tareas, incidencias, referencias Git |
| §5.7 Trazabilidad | **Trazabilidad** | 7 consultas canónicas del prompt ("¿qué tareas afectan esta pantalla?"…) + grafo SVG de relaciones de `PANT-02` |
| §5.8 Seguimiento | **Seguimiento** | KPIs compactos + avance por módulo, actividad reciente, incidencias abiertas, sin docs, sin pruebas, bloqueadas (tablas/listas, no dashboard saturado) |
| §5.9 + §3.3 Integración con agentes IA | **Agentes IA** | 10 operaciones expuestas, permisos por operación, mecanismos (MCP, REST, Webhooks, Git, Markdown, CLI), ejecuciones con `actor_type` humano/IA, auditoría |
| §9 Seguridad y permisos | **Configuración → Miembros y roles** | Roles: Administrador global / de producto / Colaborador / Consulta · aislamiento por producto · log de operaciones sensibles |
| §9 (continuación) | **Configuración** | Tipos de nodo configurables, flujo de estados de tarea con transiciones controladas, toggles de integraciones |
| §6 Navegación jerárquica | **Mapa del sistema** | Sitemap completo con referencias `§` al prompt |
| §3.1 Multiproducto | Selector de contexto (sidebar) | Cada producto con su espacio aislado; la organización solo agrega métricas |

## Decisiones del mockup (y su porqué)

- **HTML/CSS/JS sin dependencias ni build:** el mockup debe abrirse en cualquier máquina y revisarse sin instalar nada (§14: no instalar dependencias sin autorización).
- **Tablas y listas antes que tarjetas:** §5.8 y §6 piden evitar dashboards saturados; el "Resumen" y "Seguimiento" usan listas jerárquicas con barras de avance.
- **La arquitectura funcional es la columna vertebral:** la ficha de elemento (con pestañas) es el centro del mockup; el tablero es solo una representación más del trabajo (§3.2, §4, §6).
- **Diferenciación humano vs agente IA:** badges `HUMANO` / `AGENTE IA` en actividad, historial de fichas, ejecuciones y auditoría (§5.9).
- **Cambios propuestos vs ejecutados:** visible en Modificaciones y en trazabilidad (MOD-031 propuesto vs MOD-030/29/28/27 ejecutados).
- **Aislamiento de productos:** el selector de contexto deshabilita las vistas de producto en modo organización y muestra un aviso (modelo multi-tenant futuro SaaS, §3.1).
- **Ficha con pestañas adaptada al tipo:** las pestañas no se ocultan por tipo en el mock (se indican con contadores en cero y estados vacíos), pero la estructura lo permite.

## Qué NO cubre (alcance deliberado)

- Sin API, sin autenticación real, sin modelo de datos implementado, sin migraciones.
- Drag & drop en Kanban/árbol (las acciones son botones con aviso simulado).
- Edición Markdown real (el panel "vista previa" es contenido estático simulado).
- Grafo interactivo de trazabilidad (SVG estático navegable conceptual; falta librería de grafos).
- Productos Verdana y Núcleo tienen árboles mínimos; el detalle completo solo existe para Kanora.
- Responsive básico (a partir de ~1100px las columnas se apilan); no es el objetivo de este mockup.

## Siguiente paso

Según `prompt.md`: esperar autorización antes de implementar. La secuencia lógica sería ejecutar primero el plan de planificación (`docs/planificacion/`) y, con este mockup validado como referencia de UX, iniciar la **Fase 1 · Fundamentos**.
