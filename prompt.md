# Planificación de plataforma de gestión del ciclo de vida del software

## 1. Rol

Actúa como arquitecto de software, analista de producto y especialista en gestión de proyectos de desarrollo.

Diseña un plan integral para construir una plataforma de gestión del desarrollo de software.

Prioriza la arquitectura funcional, la trazabilidad y la mantenibilidad.

Utiliza TypeScript como lenguaje principal de desarrollo.

No comiences la implementación durante esta fase.

Tu objetivo consiste en analizar el problema y producir un plan técnico ejecutable.

## 2. Contexto del proyecto

Necesito construir una plataforma de gestión de proyectos especializada en desarrollo de software.

Las herramientas tradicionales de gestión de proyectos no representan adecuadamente mi metodología.

Mi metodología comienza con la definición funcional del producto.

Primero diseño los módulos, las pantallas y sus funcionalidades.

Después construyo el modelo de datos y diseño el API.

Finalmente desarrollo las funcionalidades siguiendo esa estructura.

Necesito gestionar el desarrollo alrededor de la arquitectura funcional del producto.

La plataforma debe funcionar como un sistema de conocimiento y trazabilidad.

Debe relacionar documentación, funcionalidades, tareas, modificaciones e incidencias.

Debe conservar la historia de evolución de cada parte del software.

## 3. Decisiones fundamentales

Respeta estas decisiones durante todo el diseño.

### 3.1. Gestión multiproducto

Permite administrar varios productos independientes.

Cada producto debe tener su propio espacio de trabajo.

Cada espacio debe contener su estructura funcional, documentación y actividades.

Mantén una organización general para consultar todos los productos.

No mezcles información entre productos.

Prepara la arquitectura para evolucionar hacia un servicio SaaS.

### 3.2. Gestión híbrida del trabajo

Combina dos mecanismos de organización.

**Árbol funcional:**
- Representa la arquitectura funcional del producto.
- Organiza módulos, submódulos, pantallas y componentes.
- Aloja documentación y elementos relacionados.
- Permite consultar la evolución de cada elemento.

**Tablero de trabajo:**
- Organiza tareas e incidencias.
- Permite gestionar estados y prioridades.
- Permite asignar responsables.
- Permite consultar dependencias.
- Permite filtrar actividades por producto y funcionalidad.

Mantén ambos mecanismos sincronizados mediante relaciones.

No conviertas el árbol funcional en un tablero de tareas.

### 3.3. Integración con agentes de programación

Prepara la plataforma para trabajar con agentes externos.

Considera Claude Code como primer caso de integración.

Diseña una arquitectura extensible para otros agentes.

Evalúa mecanismos de integración mediante:
- API REST.
- MCP.
- Archivos Markdown.
- CLI.
- Webhooks.
- Integraciones con Git.

No implementes estas integraciones todavía.

Define sus responsabilidades, contratos y posibilidades.

## 4. Concepto central del producto

Construye la plataforma alrededor de este principio:

**El producto constituye la estructura central del conocimiento.**

Cada producto contiene una representación jerárquica de su arquitectura funcional.

Cada elemento puede acumular información durante todo su ciclo de vida.

Relaciona los siguientes elementos:

- Módulos.
- Submódulos.
- Pantallas.
- Pestañas.
- Componentes.
- Procesos.
- Casos de uso.
- Reglas de negocio.
- Documentación técnica.
- Tareas.
- Incidencias.
- Modificaciones.
- Decisiones.
- Pruebas.

Permite relacionar elementos de diferentes niveles.

Permite relacionar una tarea con varias pantallas.

Permite relacionar una regla de negocio con varios casos de uso.

Permite relacionar una incidencia con sus modificaciones correctivas.

Conserva la trazabilidad entre todos estos elementos.

## 5. Estructura funcional esperada

Diseña una arquitectura funcional que contemple los siguientes módulos.

### 5.1. Gestión de productos

Administra los productos registrados.

Incluye:
- Creación de productos.
- Configuración general.
- Descripción y objetivos.
- Estado del producto.
- Información tecnológica.
- Integrantes.
- Actividad general.
- Documentación global.

### 5.2. Arquitectura funcional

Construye el árbol funcional del producto.

Utiliza una estructura jerárquica configurable.

Considera estos tipos de nodos:

- Módulo.
- Submódulo.
- Pantalla.
- Pestaña.
- Componente.
- Proceso.
- Servicio.
- Otro tipo configurable.

Permite:
- Crear nodos.
- Modificar nodos.
- Reorganizar jerarquías.
- Mover nodos.
- Duplicar estructuras.
- Desactivar elementos.
- Consultar relaciones.
- Consultar historial.

Diferencia los nodos estructurales de los elementos documentales.

No obligues a utilizar la misma jerarquía en todos los productos.

### 5.3. Documentación

Permite documentar cualquier parte del producto.

Considera los siguientes tipos documentales:

- Especificación funcional.
- Descripción de pantalla.
- Caso de uso.
- Flujo de trabajo.
- Regla de negocio.
- Requisito funcional.
- Requisito no funcional.
- Modelo de datos.
- Contrato API.
- Especificación técnica.
- Decisión arquitectónica.
- Manual técnico.
- Documentación de pruebas.

Permite asociar varios documentos a un mismo nodo.

Permite relacionar documentos con otros documentos.

Implementa versionado documental.

Conserva autores, fechas y modificaciones.

Evalúa un editor Markdown con vista previa.

Evalúa almacenamiento de diagramas y archivos adjuntos.

### 5.4. Gestión de tareas

Implementa un sistema de tareas relacionado con la estructura funcional.

Cada tarea debe permitir:

- Título.
- Descripción.
- Tipo.
- Estado.
- Prioridad.
- Responsable.
- Fecha de creación.
- Fecha límite.
- Estimación.
- Dependencias.
- Criterios de aceptación.
- Relaciones con nodos.
- Relaciones con documentos.
- Comentarios.
- Historial.

Considera tareas de desarrollo, análisis, documentación y mantenimiento.

Permite asociar una tarea con varios elementos funcionales.

Diseña estados configurables y transiciones controladas.

### 5.5. Gestión de incidencias

Registra errores y problemas funcionales.

Relaciona cada incidencia con los elementos afectados.

Incluye:
- Descripción del problema.
- Comportamiento esperado.
- Comportamiento observado.
- Pasos de reproducción.
- Severidad.
- Prioridad.
- Estado.
- Responsable.
- Evidencias.
- Tareas relacionadas.
- Cambios correctivos.

### 5.6. Registro de modificaciones

Implementa un registro de cambios sobre el producto.

Registra modificaciones funcionales y técnicas.

Relaciona cada modificación con:
- Elementos afectados.
- Tareas relacionadas.
- Incidencias resueltas.
- Documentos modificados.
- Decisiones relacionadas.
- Referencias de Git.

Permite consultar la historia de cada pantalla.

Diferencia los cambios propuestos de los cambios ejecutados.

### 5.7. Trazabilidad

Construye un sistema de relaciones entre elementos.

Permite consultar relaciones desde cualquier dirección.

Implementa consultas como:

- ¿Qué tareas afectan esta pantalla?
- ¿Qué pantallas utilizan esta regla?
- ¿Qué documentos describen este proceso?
- ¿Qué modificaciones implementaron esta funcionalidad?
- ¿Qué pruebas validan este caso de uso?
- ¿Qué incidencias afectan este módulo?
- ¿Qué funcionalidades dependen de este componente?

Diseña una vista de relaciones y dependencias.

Evita limitar las relaciones a una estructura estrictamente jerárquica.

### 5.8. Seguimiento

Implementa herramientas para consultar el estado del desarrollo.

Considera:
- Actividad reciente.
- Tareas pendientes.
- Tareas bloqueadas.
- Incidencias abiertas.
- Avance por módulo.
- Avance por producto.
- Elementos sin documentación.
- Funcionalidades sin pruebas.
- Modificaciones recientes.

Evita utilizar dashboards saturados de tarjetas y gráficos.

Prioriza tablas, filtros, listas y vistas jerárquicas.

### 5.9. Integración con agentes IA

Diseña una capa de integración independiente.

Considera las siguientes operaciones:

- Consultar documentación.
- Consultar estructura funcional.
- Consultar tareas.
- Crear tareas.
- Actualizar estados.
- Registrar modificaciones.
- Consultar decisiones.
- Consultar dependencias.
- Reportar resultados de implementación.
- Registrar pruebas ejecutadas.

Define mecanismos de autorización.

Registra las operaciones realizadas por agentes.

Diferencia las acciones humanas de las acciones automatizadas.

Evalúa un servidor MCP como interfaz para agentes.

Evita acoplar la plataforma a un proveedor específico.

## 6. Diseño de la experiencia de usuario

Propón una interfaz orientada a productividad.

Prioriza la navegación por producto y arquitectura funcional.

Considera cuatro espacios principales:

1. Productos.
2. Arquitectura funcional.
3. Documentación.
4. Trabajo y seguimiento.

Diseña una navegación jerárquica.

Permite abrir la ficha integral de cada elemento.

Organiza cada ficha mediante pestañas.

Considera estas pestañas:

- Resumen.
- Funcionalidad.
- Documentación.
- Tareas.
- Incidencias.
- Relaciones.
- Historial.

No obligues a mostrar todas las pestañas en todos los elementos.

Adapta las pestañas al tipo de elemento.

Diseña también una vista global de tareas.

Permite alternar entre árbol funcional, tabla y tablero Kanban.

Evita duplicar información entre diferentes vistas.

## 7. Arquitectura técnica

Utiliza TypeScript como lenguaje principal.

Analiza las alternativas tecnológicas antes de seleccionar una arquitectura.

Evalúa específicamente:

- Framework frontend.
- Framework backend.
- Base de datos.
- ORM o acceso SQL.
- Autenticación.
- Autorización.
- Editor Markdown.
- Gestión de archivos.
- Comunicación en tiempo real.
- API.
- Integración MCP.
- Sistema de pruebas.
- Infraestructura de despliegue.

Considera PostgreSQL como primera alternativa de base de datos.

Justifica cada decisión tecnológica.

Compara alternativas cuando exista una diferencia arquitectónica relevante.

Prioriza:
- Simplicidad.
- Mantenibilidad.
- Modularidad.
- Seguridad.
- Extensibilidad.
- Bajo costo operativo.
- Buen soporte para TypeScript.

Evita introducir microservicios sin una necesidad demostrable.

Evalúa inicialmente una arquitectura modular.

Separa las responsabilidades de cada módulo.

Define los límites entre frontend, backend e integraciones.

## 8. Modelo de datos

Diseña un modelo de datos conceptual y lógico.

Considera inicialmente estas entidades:

- products.
- product_members.
- product_nodes.
- node_types.
- node_relations.
- content_items.
- item_relations.
- item_versions.
- comments.
- attachments.
- users.
- roles.
- permissions.
- activity_log.
- integrations.
- agent_executions.

No asumas que esta lista es definitiva.

Identifica entidades adicionales necesarias.

Define:
- Responsabilidad de cada entidad.
- Atributos principales.
- Claves primarias.
- Claves foráneas.
- Relaciones.
- Cardinalidades.
- Restricciones.
- Índices.
- Reglas de integridad.

Analiza cómo implementar una estructura jerárquica.

Compara relaciones polimórficas con modelos relacionales explícitos.

Evita sacrificar integridad referencial por simplificar el modelo.

Diseña el modelo para soportar varios productos independientes.

## 9. Seguridad y permisos

Diseña un sistema de autorización.

Considera inicialmente los siguientes roles:

- Administrador global.
- Administrador de producto.
- Colaborador.
- Consulta.

Permite definir permisos por producto.

Evalúa permisos específicos para documentación y operaciones.

Aísla la información entre productos.

Registra las operaciones sensibles.

Diseña controles para las integraciones externas.

## 10. Metodología de desarrollo

Organiza la implementación en fases.

No propongas construir todos los módulos simultáneamente.

Prioriza las dependencias arquitectónicas.

Considera esta secuencia inicial:

**Fase 1. Fundamentos**
- Estructura del proyecto.
- Autenticación.
- Gestión de productos.
- Estructura jerárquica.
- Modelo de datos inicial.

**Fase 2. Conocimiento**
- Gestión documental.
- Editor.
- Versionado.
- Relaciones.
- Adjuntos.

**Fase 3. Trabajo**
- Tareas.
- Incidencias.
- Tablero Kanban.
- Responsables.
- Dependencias.

**Fase 4. Trazabilidad**
- Historial.
- Registro de modificaciones.
- Relaciones cruzadas.
- Consulta de evolución.

**Fase 5. Seguimiento**
- Búsqueda.
- Filtros.
- Indicadores.
- Cobertura documental.

**Fase 6. Integraciones**
- API de integración.
- MCP.
- Agentes externos.
- Git.

Puedes modificar esta secuencia si encuentras dependencias justificadas.

Para cada fase define:
- Objetivo.
- Alcance.
- Dependencias.
- Funcionalidades.
- Entidades afectadas.
- Pantallas necesarias.
- API necesaria.
- Pruebas.
- Criterios de aceptación.
- Riesgos.

Descompón las fases en entregables y tareas verificables.

## 11. Requisitos de calidad

Define una estrategia de pruebas.

Considera:
- Pruebas unitarias.
- Pruebas de integración.
- Pruebas de API.
- Pruebas de componentes.
- Pruebas E2E.
- Pruebas de permisos.
- Pruebas de integridad de relaciones.
- Pruebas de aislamiento entre productos.

Define estándares de TypeScript.

Considera validación de entradas, tipado estricto y manejo de errores.

Define convenciones de código y estructura de carpetas.

Propón una estrategia de migraciones de base de datos.

Incluye criterios para revisar cada entrega.

## 12. Metodología de análisis

Sigue este procedimiento.

### Paso 1. Analiza el entorno

Inspecciona el repositorio actual.

Identifica:
- Archivos existentes.
- Configuración.
- Dependencias.
- Documentación.
- Código existente.
- Herramientas disponibles.

Si el repositorio está vacío, documenta esa condición.

No inventes componentes existentes.

### Paso 2. Analiza los requisitos

Identifica requisitos funcionales y no funcionales.

Detecta contradicciones y ambigüedades.

Identifica decisiones que necesitan validación.

No conviertas supuestos en requisitos confirmados.

### Paso 3. Analiza la arquitectura

Diseña la arquitectura funcional y técnica.

Evalúa las alternativas tecnológicas.

Justifica las decisiones.

Identifica riesgos y dependencias.

### Paso 4. Diseña el modelo de datos

Define entidades y relaciones.

Comprueba la integridad del modelo.

Identifica problemas potenciales de escalabilidad.

### Paso 5. Diseña la experiencia de usuario

Define módulos, pantallas y navegación.

Documenta las responsabilidades de cada pantalla.

Identifica las operaciones disponibles.

### Paso 6. Construye el plan

Descompón la arquitectura en fases.

Descompón las fases en módulos y funcionalidades.

Descompón las funcionalidades en tareas.

Define criterios de aceptación verificables.

## 13. Entregables obligatorios

Genera la documentación dentro de una carpeta `docs/planificacion/`.

Organiza los documentos de la siguiente manera:

**00-resumen-ejecutivo.md**
- Problema.
- Objetivos.
- Alcance.
- Decisiones principales.

**01-requisitos.md**
- Requisitos funcionales.
- Requisitos no funcionales.
- Restricciones.
- Supuestos.
- Preguntas pendientes.

**02-arquitectura-funcional.md**
- Módulos.
- Funcionalidades.
- Jerarquías.
- Navegación.
- Responsabilidades.

**03-arquitectura-tecnica.md**
- Stack propuesto.
- Componentes.
- Límites modulares.
- Integraciones.
- Infraestructura.

**04-modelo-datos.md**
- Entidades.
- Atributos.
- Relaciones.
- Restricciones.
- Diagramas ER.

**05-experiencia-usuario.md**
- Navegación.
- Pantallas.
- Componentes.
- Flujos.
- Comportamientos.

**06-integraciones-agentes.md**
- Arquitectura de integración.
- API.
- MCP.
- Permisos.
- Operaciones disponibles.
- Auditoría.

**07-plan-implementacion.md**
- Fases.
- Entregables.
- Dependencias.
- Tareas.
- Prioridades.
- Criterios de aceptación.

**08-estrategia-pruebas.md**
- Tipos de pruebas.
- Herramientas.
- Cobertura.
- Criterios de calidad.

**09-riesgos-y-decisiones.md**
- Riesgos técnicos.
- Riesgos funcionales.
- Decisiones pendientes.
- Alternativas descartadas.

**10-backlog-inicial.md**
- Épicas.
- Historias de usuario.
- Tareas.
- Prioridades.
- Dependencias.
- Criterios de aceptación.

Incluye diagramas Mermaid cuando aporten claridad.

Mantén referencias cruzadas entre documentos.

Evita duplicar información.

## 14. Restricciones importantes

No implementes funcionalidades.

No generes código de aplicación.

No instales dependencias sin autorización.

No ejecutes migraciones.

No modifiques archivos existentes fuera de la carpeta de planificación.

No inventes requisitos.

No tomes decisiones arquitectónicas importantes sin documentar su justificación.

No generes un plan basado únicamente en tecnologías conocidas.

Analiza primero las necesidades del producto.

Prioriza la simplicidad arquitectónica.

Distingue decisiones confirmadas, propuestas y pendientes.

## 15. Resultado esperado

Entrega un plan que permita comenzar la implementación sin improvisar la arquitectura.

El plan debe permitir convertir cada fase en tareas ejecutables.

Cada tarea debe tener un alcance definido.

Cada tarea debe tener criterios de aceptación.

Cada tarea debe identificar sus dependencias.

Cada funcionalidad debe relacionarse con la arquitectura funcional.

Cada decisión debe tener una justificación documentada.

Al terminar, presenta un informe con:

1. Resumen de la arquitectura propuesta.
2. Stack tecnológico recomendado.
3. Estructura funcional.
4. Modelo de datos.
5. Fases de implementación.
6. Riesgos identificados.
7. Decisiones pendientes.
8. Ubicación de los documentos generados.

**Detente después de entregar la planificación.**

Espera autorización antes de comenzar la implementación.


## Integración MCP y herramientas para agentes de programación

Diseña un servidor MCP independiente como interfaz de comunicación entre la plataforma y los agentes de programación.

Considera Claude Code como primer cliente.

Mantén compatibilidad arquitectónica con otros clientes MCP.

### 1. Arquitectura

Diseña tres componentes:

- API central de la plataforma.
- Servidor MCP.
- Agentes externos.

El servidor MCP debe consumir la API central.

No permitas que los agentes accedan directamente a PostgreSQL.

Centraliza las validaciones, permisos y auditoría.

Utiliza TypeScript para implementar el servidor MCP.

Evalúa el SDK oficial de MCP para TypeScript.

### 2. Herramientas MCP

Diseña herramientas agrupadas por responsabilidad.

**Consulta del producto:**
- list_products
- get_product
- get_product_structure
- get_node
- search_product_knowledge
- get_product_context

**Documentación:**
- list_documents
- get_document
- search_documents
- create_document
- update_document
- get_document_history

**Tareas:**
- list_tasks
- get_task
- create_task
- update_task
- update_task_status
- add_task_comment

**Incidencias:**
- list_issues
- get_issue
- create_issue
- update_issue
- resolve_issue

**Trazabilidad:**
- get_node_history
- get_node_relations
- get_task_relations
- get_dependencies
- register_change
- link_items

**Pruebas:**
- list_test_cases
- get_test_case
- register_test_result

No implementes estas herramientas automáticamente.

Evalúa su utilidad y define contratos para cada una.

### 3. Recursos MCP

Expón recursos de consulta para los agentes.

Considera:

- Productos disponibles.
- Árbol funcional.
- Documentación de módulos.
- Documentación de pantallas.
- Reglas de negocio.
- Decisiones arquitectónicas.
- Contratos API.
- Tareas asignadas.
- Historial de modificaciones.

Diseña URIs estables para los recursos.

Permite consultar el contexto completo de una pantalla.

### 4. Prompts MCP

Define prompts reutilizables para operaciones frecuentes.

Considera:

- Analizar una pantalla antes de modificarla.
- Preparar una implementación.
- Analizar una incidencia.
- Revisar una modificación.
- Actualizar documentación.
- Generar pruebas.
- Revisar cumplimiento de criterios de aceptación.

### 5. Seguridad y auditoría

Implementa autenticación para clientes MCP.

Asocia cada operación con un usuario o agente identificado.

Valida permisos por producto.

Registra cada operación ejecutada.

Diferencia operaciones de consulta y modificación.

Diseña mecanismos de confirmación para operaciones sensibles.

Evita permitir modificaciones arbitrarias de documentación o tareas.

### 6. Contexto para agentes

Diseña una operación que entregue contexto estructurado.

El contexto debe incluir:

- Descripción funcional.
- Estructura del elemento.
- Documentación relacionada.
- Reglas de negocio.
- Casos de uso.
- Modelo de datos relacionado.
- Contratos API.
- Tareas pendientes.
- Incidencias abiertas.
- Decisiones técnicas.
- Dependencias.
- Historial relevante.

Evita entregar información innecesaria.

Permite solicitar contexto por módulo, pantalla o componente.

### 7. Integración con Git

Evalúa la integración con repositorios Git.

Considera registrar:

- Repositorio.
- Rama.
- Commit.
- Pull request.
- Archivos modificados.
- Tareas relacionadas.
- Pantallas afectadas.

Permite vincular commits y pull requests con elementos funcionales.

No permitas que Git sustituya el historial funcional de la plataforma.

### 8. Entregables MCP

Genera documentación específica:

- Arquitectura del servidor MCP.
- Catálogo de herramientas.
- Contratos de entrada y salida.
- Catálogo de recursos.
- Prompts disponibles.
- Sistema de autenticación.
- Modelo de permisos.
- Auditoría.
- Estrategia de integración con Claude Code.

Incluye ejemplos de interacción entre un agente y la plataforma.

Define una primera versión mínima del servidor MCP.

Prioriza operaciones de consulta antes de habilitar modificaciones.