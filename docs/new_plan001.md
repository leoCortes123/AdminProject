# PROMPT — Auditoría y planificación de evolución de DevCycle

## 1. Rol y objetivo

Actúa como arquitecto de software senior, analista de sistemas y especialista en gestión de conocimiento técnico.

Tienes acceso completo al repositorio de DevCycle.

Tu responsabilidad consiste en analizar la implementación actual y formular un plan técnico para evolucionarla.

No implementes cambios durante esta fase.

Primero comprende la arquitectura existente. Después identifica las necesidades funcionales y técnicas. Finalmente, presenta un plan de implementación verificable.

### Contexto del proyecto

DevCycle es una aplicación de uso interno para administrar proyectos de desarrollo de software.

No es un SaaS comercial ni un producto destinado a clientes externos.

Su propósito consiste en centralizar:

- Estructura funcional de los proyectos.
- Documentación funcional y técnica.
- Casos de uso.
- Reglas de negocio.
- Requisitos funcionales y no funcionales.
- Flujos de cada pantalla y proceso.
- Tareas e incidencias.
- Modificaciones y decisiones técnicas.
- Pruebas y resultados.
- Relaciones y dependencias entre elementos.
- Historial de cambios.
- Información utilizada por agentes de IA.

La aplicación debe permitir comprender el comportamiento completo de un software.

También debe permitir analizar las consecuencias de cualquier modificación antes de implementarla.

### Principio arquitectónico central

DevCycle debe funcionar como un sistema de conocimiento estructurado sobre los proyectos de software.

No debe limitarse a almacenar documentos.

Debe mantener relaciones verificables entre los elementos funcionales, documentales, técnicos y operativos.

El objetivo es responder preguntas como:

- ¿Qué hace esta funcionalidad?
- ¿En qué pantallas está disponible?
- ¿Qué casos de uso la utilizan?
- ¿Qué flujos intervienen?
- ¿Qué reglas de negocio condicionan su comportamiento?
- ¿Qué requisitos satisface?
- ¿Qué APIs y entidades de datos utiliza?
- ¿Qué otras funcionalidades dependen de ella?
- ¿Qué pruebas verifican su comportamiento?
- ¿Qué elementos deben revisarse ante un cambio?
- ¿Qué documentación quedó desactualizada después de una modificación?

---

# 2. Reglas obligatorias de trabajo

Cumple estas reglas durante todo el análisis.

1. Inspecciona el código real antes de formular conclusiones.
2. No asumas que la documentación representa la implementación actual.
3. Contrasta las estructuras documentadas con el código existente.
4. No inventes tablas, funciones, componentes ni funcionalidades.
5. Identifica las estructuras existentes que ya resuelven cada necesidad.
6. Evita duplicar responsabilidades entre tablas.
7. No propongas reescrituras completas sin justificación.
8. Conserva las decisiones arquitectónicas que funcionen correctamente.
9. Identifica las limitaciones reales antes de recomendar soluciones.
10. Distingue hechos comprobados de hipótesis.
11. Identifica dependencias entre las modificaciones propuestas.
12. Prioriza cambios incrementales y verificables.
13. No ejecutes migraciones ni modifiques archivos.
14. No instales dependencias.
15. No generes código de implementación.
16. No alteres configuraciones ni datos.
17. No realices operaciones destructivas.

Puedes ejecutar pruebas existentes y consultas de inspección que no modifiquen datos.

Si una prueba necesita modificaciones o servicios externos, documenta esa limitación.

No interpretes la ausencia de información como evidencia de que una funcionalidad no existe.

---

# 3. Fase inicial: auditoría del proyecto actual

Analiza el repositorio completo.

Inspecciona especialmente:

- Estructura de directorios.
- Documentación existente.
- Arquitectura del frontend.
- Arquitectura del backend.
- Base de datos.
- Migraciones.
- Modelos y relaciones.
- Funciones y procedimientos.
- API y endpoints.
- Autenticación y autorización.
- Componentes de interfaz.
- Sistema de navegación.
- Gestión documental.
- Sistema de tareas.
- Relaciones entre entidades.
- Versionado.
- Auditoría.
- Integraciones con agentes.
- Herramientas MCP.
- Pruebas automatizadas.
- Configuración de desarrollo.

Identifica las tecnologías utilizadas.

Determina qué responsabilidades corresponden al frontend, backend y base de datos.

Identifica los mecanismos de comunicación entre componentes.

## 3.1. Auditoría de base de datos

Inspecciona las tablas existentes:

- products
- product_nodes
- content_items
- item_node_links
- item_versions
- relations
- tasks
- issues
- changes
- test_cases
- test_results
- comments
- attachments
- service_accounts
- api_tokens
- agent_executions
- activity_log

Comprueba cuáles existen realmente.

Para cada tabla identifica:

- Propósito actual.
- Columnas.
- Tipos de datos.
- Claves primarias.
- Claves foráneas.
- Restricciones.
- Índices.
- Triggers.
- Funciones relacionadas.
- Relaciones con otras tablas.
- Problemas de integridad.
- Limitaciones para los objetivos de DevCycle.

No presupongas que todas las tablas tienen la estructura indicada.

Identifica también tablas adicionales relevantes.

## 3.2. Auditoría de relaciones

Analiza especialmente la tabla relations.

Determina:

- Qué tipos de entidades admite.
- Cómo identifica los extremos.
- Cómo valida las referencias.
- Qué tipos de relaciones implementa.
- Si permite relaciones bidireccionales.
- Si evita duplicados.
- Si conserva historial.
- Si soporta consultas transitivas.
- Si existen relaciones redundantes.
- Si permite representar dependencias funcionales.

Evalúa si puede convertirse en el grafo semántico de DevCycle.

No recomiendes una reestructuración sin demostrar sus limitaciones.

## 3.3. Auditoría documental

Inspecciona content_items, item_versions e item_node_links.

Determina:

- Cómo se crean documentos.
- Cómo se clasifican.
- Cómo se almacenan.
- Cómo se versionan.
- Cómo se vinculan con nodos.
- Cómo se valida metadata.
- Cómo se consultan.
- Cómo se muestran en frontend.

Evalúa si la arquitectura actual permite representar correctamente requisitos, casos de uso, reglas de negocio y flujos.

Identifica qué tipos documentales existen realmente.

Identifica qué información se encuentra únicamente en Markdown.

Identifica qué información debería ser estructurada.

## 3.4. Auditoría de interfaz

Inspecciona las pantallas existentes.

Identifica:

- Navegación principal.
- Navegación por proyecto.
- Explorador funcional.
- Visualización documental.
- Formularios.
- Pestañas.
- Filtros.
- Búsquedas.
- Visualización de relaciones.
- Gestión de tareas.
- Gestión de cambios.

Determina qué componentes pueden reutilizarse.

Identifica las pantallas que necesitarían modificaciones.

No propongas rediseñar toda la interfaz.

Prioriza una interfaz compacta, funcional y orientada al trabajo técnico.

---

# 4. Modelo funcional objetivo

Evalúa cómo adaptar la estructura existente para representar la arquitectura funcional de cada proyecto.

La estructura propuesta es:

Producto
- Módulo
  - Pantalla
    - Pestaña
      - Funcionalidad
        - Componente

No obligues a todos los elementos a seguir esta jerarquía.

Permite funcionalidades sin representación visual.

Permite procesos automáticos, APIs y servicios independientes.

Evalúa el uso de product_nodes y ltree.

Determina si es necesario agregar:

- node_type.
- code.
- status.
- metadata.
- Identificador estable.
- Otros campos justificados.

Evalúa la posibilidad de representar dependencias entre nodos.

Distingue las relaciones jerárquicas de las relaciones semánticas.

No dupliques información que ya esté representada mediante parent_id o ltree.

---

# 5. Modelo documental objetivo

Evalúa la arquitectura actual de content_items y item_versions.

Propón un catálogo documental que contemple estos tipos:

## Requisitos

- req_functional
- req_non_functional

## Comportamiento funcional

- use_case
- workflow
- business_rule

## Diseño técnico

- data_model
- api_contract
- adr
- integration

## Interacción

- ui_behavior
- permission_rule
- validation_rule

## Calidad

- acceptance_criteria
- test_specification
- security_requirement

## Operación

- operational_process
- scheduled_job
- error_handling

No implementes automáticamente todos los tipos.

Clasifica cada tipo según su utilidad real.

Identifica cuáles deberían formar parte de la primera versión.

## 5.1. Casos de uso

Define una estructura documental para cada caso de uso.

Debe contemplar:

- Código.
- Nombre.
- Objetivo.
- Actores.
- Actor principal.
- Precondiciones.
- Postcondiciones.
- Escenario principal.
- Escenarios alternativos.
- Excepciones.
- Criterios de aceptación.
- Estado.
- Versión.

Evalúa cómo almacenar estos datos.

Determina qué información debe estar en metadata JSONB.

Determina qué información debe estar en body_markdown.

Evita duplicar información entre ambos campos.

## 5.2. Reglas de negocio

Define una estructura para documentar:

- Código.
- Nombre.
- Descripción.
- Condición.
- Resultado esperado.
- Excepciones.
- Alcance.
- Elementos afectados.
- Casos de uso relacionados.
- Flujos relacionados.
- Vigencia.
- Versión.

Evalúa cómo relacionar una regla con varios módulos.

## 5.3. Requisitos funcionales

Define una estructura que permita registrar:

- Código.
- Nombre.
- Descripción.
- Justificación.
- Comportamiento esperado.
- Criterios de aceptación.
- Prioridad.
- Estado.
- Casos de uso que lo implementan.
- Pruebas que verifican su cumplimiento.

Evita convertir cada requisito en una tarea.

## 5.4. Flujos funcionales

Esta es una de las partes más importantes del análisis.

Un flujo debe representar una secuencia de actividades.

No debe ser únicamente un documento Markdown.

Evalúa una estructura que permita representar:

- Punto inicial.
- Acciones.
- Validaciones.
- Decisiones.
- Bifurcaciones.
- Subprocesos.
- Excepciones.
- Eventos.
- Punto final.
- Transiciones.
- Condiciones de transición.

Cada paso debe tener un identificador estable.

Cada paso debe poder vincularse con:

- Módulos.
- Pantallas.
- Pestañas.
- Funcionalidades.
- Casos de uso.
- Reglas de negocio.
- Requisitos.
- APIs.
- Entidades de datos.
- Pruebas.

Evalúa si metadata JSONB es suficiente.

Compara esta alternativa con tablas normalizadas:

- workflow_steps.
- workflow_transitions.
- workflow_step_links.

No agregues tablas por preferencia teórica.

Justifica la decisión según las consultas que DevCycle necesitará ejecutar.

Evalúa la posibilidad de representar flujos mediante diagramas.

Considera BPMN, diagramas de estados y grafos dirigidos.

No conviertas DevCycle en una herramienta BPM empresarial.

Prioriza la documentación del comportamiento del software.

---

# 6. Modelo de relaciones semánticas

Evalúa cómo convertir relations en un grafo semántico.

Considera estas relaciones:

- contains
- implements
- realizes
- uses
- depends_on
- triggers
- validates
- governed_by
- executed_in
- participates_in
- calls
- reads
- writes
- tested_by
- resolves
- supersedes

Determina cuáles son necesarias.

Identifica relaciones redundantes o ambiguas.

Define las reglas de dirección.

Define las restricciones de integridad.

Define cómo evitar ciclos problemáticos.

Define cómo evitar relaciones duplicadas.

Define cómo conservar historial.

Evalúa la relación entre item_node_links y relations.

Establece claramente la responsabilidad de cada estructura.

El resultado debe permitir consultar relaciones entre:

- Nodos funcionales.
- Documentos.
- Tareas.
- Incidencias.
- Cambios.
- Pruebas.
- APIs.
- Entidades técnicas.

No permitas que la estructura se convierta en un conjunto de relaciones genéricas sin semántica.

---

# 7. Análisis de impacto

Diseña el funcionamiento del motor de análisis de impacto.

Este componente es prioritario.

Debe permitir seleccionar cualquier elemento como punto de partida.

Ejemplos:

- Una pantalla.
- Una funcionalidad.
- Un caso de uso.
- Una regla de negocio.
- Un flujo.
- Un requisito.
- Una API.
- Una entidad de datos.

A partir del elemento seleccionado debe recorrer las relaciones.

Debe identificar:

1. Elementos directamente relacionados.
2. Elementos dependientes indirectamente.
3. Elementos potencialmente afectados.
4. Pruebas que deben revisarse.
5. Documentos que podrían quedar desactualizados.
6. Módulos y pantallas involucrados.

Distingue tres categorías:

- Impacto confirmado.
- Impacto probable.
- Elemento que requiere revisión.

No declares automáticamente que todos los elementos relacionados están afectados.

## 7.1. Consultas transitivas

Evalúa consultas recursivas con PostgreSQL.

Considera:

- Profundidad máxima.
- Prevención de ciclos.
- Dirección de recorrido.
- Tipos de relaciones permitidas.
- Ponderación de relaciones.
- Rendimiento.
- Índices.
- Permisos por proyecto.

Determina si es suficiente una consulta recursiva.

No propongas incorporar una base de datos de grafos externa.

PostgreSQL debe ser la fuente de verdad.

## 7.2. Historial del análisis

Evalúa agregar una tabla change_impact_assessments.

Debe permitir conservar:

- Cambio analizado.
- Elemento inicial.
- Elementos encontrados.
- Relaciones recorridas.
- Profundidad.
- Elementos afectados.
- Elementos revisados.
- Elementos descartados.
- Versiones documentales consultadas.
- Fecha del análisis.
- Responsable.
- Aprobación.

El resultado debe ser inmutable o versionado.

Permite comparar el impacto previsto con las modificaciones realizadas.

---

# 8. Experiencia de usuario objetivo

Evalúa la interfaz existente.

Propón una navegación orientada al trabajo interno.

No diseñes una experiencia comercial.

No agregues:

- Landing pages comerciales.
- Suscripciones.
- Facturación.
- Gestión de clientes.
- Paneles comerciales.
- Funcionalidades de marketing.
- Configuraciones innecesarias para una organización interna.

Prioriza estas vistas:

## 8.1. Explorador funcional

Debe permitir navegar:

Producto → Módulo → Pantalla → Pestaña → Funcionalidad.

Al seleccionar un elemento debe mostrar su contexto.

## 8.2. Explorador documental

Debe permitir filtrar:

- Casos de uso.
- Reglas de negocio.
- Requisitos.
- Flujos.
- Decisiones técnicas.
- Otros documentos.

Debe permitir encontrar documentos huérfanos.

## 8.3. Explorador de flujos

Debe permitir:

- Visualizar pasos.
- Identificar decisiones.
- Navegar entre subprocesos.
- Consultar pantallas involucradas.
- Consultar reglas asociadas.
- Consultar casos de uso relacionados.

## 8.4. Mapa de relaciones

Debe permitir:

- Visualizar conexiones.
- Filtrar tipos de relación.
- Consultar dependencias.
- Navegar hacia elementos.
- Identificar elementos sin documentación.

Evita mostrar grafos completos de forma predeterminada.

Prioriza visualizaciones filtradas por contexto.

## 8.5. Análisis de cambios

Debe mostrar:

- Elemento inicial.
- Impacto directo.
- Impacto transitivo.
- Impacto potencial.
- Documentos relacionados.
- Pruebas relacionadas.
- Elementos que necesitan revisión.
- Historial de análisis.

Evalúa qué pantallas existentes pueden adaptarse.

---

# 9. Versionado y consistencia documental

Evalúa el versionado actual.

Determina cómo garantizar que:

- Los documentos aprobados tengan versiones inmutables.
- Los flujos conserven su estructura histórica.
- Los casos de uso mantengan sus versiones.
- Las relaciones tengan trazabilidad.
- Los cambios identifiquen las versiones analizadas.
- Las pruebas identifiquen la versión del requisito verificado.
- Las modificaciones no alteren análisis históricos.

Evalúa cómo detectar documentación desactualizada.

Considera comparar las versiones de documentos y relaciones.

Propón validaciones por tipo documental.

Considera JSON Schema para metadata.

No agregues validaciones que dupliquen restricciones de base de datos.

---

# 10. Integración con agentes de IA

DevCycle debe servir como fuente estructurada de conocimiento para agentes locales.

Evalúa las herramientas MCP existentes.

Identifica qué operaciones están disponibles.

Propón las operaciones necesarias:

- get_product_structure
- get_node_context
- get_related_items
- get_use_case
- get_workflow
- get_business_rules
- get_requirements
- analyze_impact
- get_related_tests
- create_change
- update_document
- register_test_result

Evalúa cuáles deben ser herramientas MCP.

Evalúa cuáles pueden ser consultas internas.

No crees herramientas duplicadas.

Los agentes deben poder:

1. Consultar el contexto de una funcionalidad.
2. Consultar sus dependencias.
3. Recuperar documentación relacionada.
4. Analizar un cambio.
5. Identificar pruebas necesarias.
6. Proponer modificaciones.
7. Registrar resultados.
8. Actualizar documentación mediante operaciones autorizadas.

Exige identificadores verificables.

Exige referencias a los documentos consultados.

Evita que los agentes inventen relaciones o requisitos.

Conserva la auditoría de operaciones mediante agent_executions y activity_log.

Evalúa permisos y separación entre lectura y escritura.

---

# 11. Análisis de riesgos y deuda técnica

Identifica los problemas que podrían dificultar esta evolución.

Clasifica los riesgos:

- Arquitectónicos.
- De integridad de datos.
- De versionado.
- De rendimiento.
- De mantenibilidad.
- De experiencia de usuario.
- De seguridad.
- De integración con agentes.

Para cada riesgo documenta:

- Evidencia encontrada.
- Consecuencia.
- Probabilidad.
- Impacto.
- Prioridad.
- Solución propuesta.

No confundas una mejora opcional con un defecto crítico.

Identifica también las funcionalidades existentes que podrían romperse.

---

# 12. Plan de implementación

Formula un plan incremental.

No agrupes todas las modificaciones en una única fase.

Propón fases con dependencias explícitas.

Considera esta secuencia inicial:

### Fase 1. Fundamentos

- Ajustar estructura funcional.
- Definir catálogo documental.
- Definir tipos documentales.
- Establecer convenciones de identificadores.
- Revisar relaciones existentes.

### Fase 2. Documentación funcional

- Casos de uso.
- Reglas de negocio.
- Requisitos funcionales.
- Flujos estructurados.
- Validaciones documentales.
- Versionado.

### Fase 3. Grafo semántico

- Tipos de relaciones.
- Integridad.
- Navegación.
- Consultas transitivas.
- Historial de relaciones.

### Fase 4. Interfaz

- Explorador funcional.
- Explorador documental.
- Editor de flujos.
- Mapa de relaciones.
- Contexto de elementos.

### Fase 5. Análisis de impacto

- Motor de recorridos.
- Clasificación de impacto.
- Fotografías de análisis.
- Comparación de versiones.
- Asociación de pruebas.

### Fase 6. Agentes

- Herramientas MCP.
- Consultas contextuales.
- Análisis automatizados.
- Registro de operaciones.
- Control de permisos.

Puedes modificar esta secuencia si encuentras dependencias que lo justifiquen.

Para cada fase define:

1. Objetivo.
2. Problema que resuelve.
3. Estructuras afectadas.
4. Migraciones necesarias.
5. Funciones backend.
6. Componentes frontend.
7. APIs afectadas.
8. Herramientas MCP afectadas.
9. Pruebas necesarias.
10. Dependencias.
11. Riesgos.
12. Criterios de aceptación.

## 12.1. Descomposición de tareas

Descompón cada fase en tareas y subtareas.

Cada tarea debe ser suficientemente pequeña para asignarla a un agente local.

Identifica:

- Archivos que probablemente deban modificarse.
- Archivos que deben inspeccionarse antes.
- Dependencias entre tareas.
- Posibilidad de ejecución paralela.
- Riesgos de conflictos entre agentes.
- Pruebas que deben pasar.

No inventes rutas de archivos.

Cuando no conozcas una ruta exacta, indica qué directorio debes inspeccionar.

---

# 13. Estrategia de migración

Diseña una estrategia que preserve los datos existentes.

Analiza:

- Compatibilidad con registros actuales.
- Migraciones incrementales.
- Valores predeterminados.
- Conversión de metadata.
- Relaciones existentes.
- Documentos sin clasificación.
- Documentos sin nodo asociado.
- Versiones históricas.
- Registros incompletos.

No propongas eliminar datos existentes.

Identifica los procesos de migración y validación necesarios.

Define cómo verificar la integridad antes y después de cada migración.

---

# 14. Estrategia de pruebas

Propón pruebas para cada fase.

Incluye:

## Pruebas de base de datos

- Integridad de relaciones.
- Prevención de duplicados.
- Validación documental.
- Versionado.
- Consultas recursivas.
- Prevención de ciclos.
- Restricciones por proyecto.

## Pruebas de backend

- Creación documental.
- Actualización de documentos.
- Relaciones.
- Consultas contextuales.
- Análisis de impacto.
- Historial.

## Pruebas frontend

- Navegación funcional.
- Visualización documental.
- Edición de flujos.
- Exploración de relaciones.
- Análisis de cambios.

## Pruebas de agentes

- Recuperación de contexto.
- Exactitud de referencias.
- Análisis de impacto.
- Permisos.
- Auditoría.
- Prevención de modificaciones no autorizadas.

Define criterios de aceptación verificables.

---

# 15. Entregables obligatorios

Guarda los resultados del análisis en una carpeta nueva:

`docs/plan-evolucion/`

No sobrescribas documentación existente.

Genera estos archivos:

### 01-auditoria-actual.md

Describe la arquitectura real.

Incluye tablas, funciones, componentes y relaciones existentes.

Incluye evidencias mediante rutas y referencias de código.

### 02-brechas-arquitectonicas.md

Compara el estado actual con los objetivos.

Clasifica cada brecha:

- Crítica.
- Alta.
- Media.
- Baja.
- Opcional.

Justifica cada clasificación.

### 03-modelo-funcional-documental.md

Define el modelo de información objetivo.

Incluye:

- Jerarquía funcional.
- Tipos documentales.
- Estructura de casos de uso.
- Estructura de reglas.
- Estructura de requisitos.
- Estructura de flujos.
- Versionado.

Incluye diagramas Mermaid cuando aporten claridad.

### 04-modelo-relaciones.md

Define el grafo semántico.

Incluye:

- Tipos de relaciones.
- Dirección.
- Integridad.
- Restricciones.
- Consultas.
- Ejemplos de trazabilidad.

### 05-analisis-impacto.md

Describe el motor de análisis.

Incluye:

- Algoritmo.
- Recorrido.
- Clasificación.
- Prevención de ciclos.
- Historial.
- Ejemplos de resultados.

### 06-diseno-interfaz.md

Describe las vistas y modificaciones necesarias.

Incluye diagramas de navegación.

Identifica componentes existentes reutilizables.

### 07-integracion-agentes.md

Define las operaciones MCP.

Incluye entradas, salidas, permisos y auditoría.

### 08-plan-implementacion.md

Contiene las fases de implementación.

Incluye dependencias y criterios de aceptación.

### 09-backlog-implementacion.md

Contiene tareas y subtareas ordenadas.

Asigna identificadores únicos.

Identifica tareas paralelizables.

Identifica bloqueos y dependencias.

### 10-estrategia-pruebas-migracion.md

Describe migraciones, validaciones y pruebas.

Incluye criterios para aceptar cada fase.

### 11-decisiones-arquitectonicas.md

Registra las decisiones propuestas.

Para cada decisión incluye:

- Contexto.
- Problema.
- Alternativas.
- Decisión recomendada.
- Justificación.
- Consecuencias.
- Estado de aprobación.

---

# 16. Formato del resultado

Sé técnico y específico.

Evita recomendaciones genéricas.

Justifica las decisiones con evidencias del repositorio.

Distingue claramente:

- Implementado.
- Parcialmente implementado.
- No implementado.
- Necesita revisión.
- Recomendación nueva.

Cuando encuentres una estructura existente que cumpla una necesidad, indícala.

No propongas reemplazarla innecesariamente.

Incluye diagramas Mermaid para explicar arquitectura y dependencias.

Incluye tablas comparativas cuando existan alternativas.

Prioriza decisiones que reduzcan complejidad.

No agregues infraestructura externa sin una necesidad demostrada.

No conviertas DevCycle en un producto comercial.

No optimices para escalabilidad comercial, multiempresa o facturación.

Prioriza el uso interno, la velocidad de desarrollo y la mantenibilidad.

---

# 17. Condición de finalización

El trabajo termina cuando:

1. La arquitectura actual está documentada.
2. Las brechas están identificadas.
3. El modelo objetivo está definido.
4. Las relaciones están especificadas.
5. El análisis de impacto está diseñado.
6. La interfaz está planificada.
7. La integración con agentes está especificada.
8. Las migraciones están planificadas.
9. Las pruebas están definidas.
10. El backlog está descompuesto.
11. Las dependencias están identificadas.
12. Los entregables están guardados.

No implementes ninguna funcionalidad.

No modifiques el código existente.

Al finalizar, presenta un resumen ejecutivo.

Incluye las cinco decisiones arquitectónicas más importantes.

Incluye los riesgos críticos.

Incluye la primera fase recomendada.

Indica qué decisiones necesitan aprobación antes de iniciar el desarrollo.