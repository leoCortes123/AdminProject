/* ============================================================
   DevCycle — Mockup · Datos de ejemplo (FICCIÓN)
   Ningún dato de este archivo corresponde a un sistema real.
   El nombre "DevCycle" es un placeholder para el mockup.
   ============================================================ */
window.MOCK = {

  org: { name: 'Acme & Co', plan: 'Organización general' },

  products: [
    {
      id: 'kanora', name: 'Kanora', tagline: 'ERP logístico para operadores de última milla',
      estado: 'Activo', avance: 72, modulos: 9, nodos: 128, docs: 34,
      tareasAbiertas: 12, incidencias: 4, actividad: 'hace 12 min',
      stack: ['Next.js', 'NestJS', 'PostgreSQL', 'Drizzle ORM', 'Redis'],
      repo: 'github.com/acme/kanora-core', miembros: 14, coberturaDoc: 68, coberturaPruebas: 61,
      descripcion: 'Plataforma operativa para operadores logísticos: planificación de rutas, inventario, facturación y reportes. Sustituye al legado monolítico y expone API pública para integraciones de clientes.',
      objetivos: [
        'Reducir el tiempo de planificación de rutas un 40%.',
        'Trazabilidad completa desde funcionalidad hasta cambio en producción.',
        'API pública v1 estable antes del Q2 2027.'
      ]
    },
    {
      id: 'verdana', name: 'Verdana', tagline: 'Portal de pacientes para clínicas privadas',
      estado: 'En desarrollo', avance: 38, modulos: 6, nodos: 74, docs: 19,
      tareasAbiertas: 21, incidencias: 2, actividad: 'hace 1 h',
      stack: ['React', 'Fastify', 'PostgreSQL', 'Prisma'],
      repo: 'github.com/acme/verdana-web', miembros: 8, coberturaDoc: 44, coberturaPruebas: 30,
      descripcion: 'Portal web para pacientes: agenda, expedientes, recetas digitales y mensajería segura con su médico.',
      objetivos: ['Lanzar piloto con 3 clínicas en febrero 2027.', 'Cumplimiento RGPD/LOPDGDD por diseño.']
    },
    {
      id: 'nucleo', name: 'Núcleo', tagline: 'Motor de reglas de negocio embebible',
      estado: 'Mantenimiento', avance: 91, modulos: 3, nodos: 31, docs: 27,
      tareasAbiertas: 3, incidencias: 0, actividad: 'ayer',
      stack: ['TypeScript', 'Node.js', 'PostgreSQL'],
      repo: 'github.com/acme/nucleo-engine', miembros: 4, coberturaDoc: 88, coberturaPruebas: 84,
      descripcion: 'Librería interna de evaluación de reglas. Long-term support; solo corrección de errores y seguridad.',
      objetivos: ['Mantener SLA 99.9%.', 'Sin cambios funcionales hasta 2028.']
    }
  ],

  nodeTypes: [
    { id: 'modulo',     label: 'Módulo',     color: '#6366f1', count: 9  },
    { id: 'submodulo',  label: 'Submódulo',  color: '#8b5cf6', count: 14 },
    { id: 'pantalla',   label: 'Pantalla',   color: '#0284c7', count: 27 },
    { id: 'pestana',    label: 'Pestaña',    color: '#0d9488', count: 22 },
    { id: 'componente', label: 'Componente', color: '#d97706', count: 34 },
    { id: 'proceso',    label: 'Proceso',    color: '#db2777', count: 9  },
    { id: 'servicio',   label: 'Servicio',   color: '#16a34a', count: 8  },
    { id: 'otro',       label: 'Configurable', color: '#64748b', count: 5 }
  ],

  /* Árboles funcionales por producto (mock, parcialmente desplegados en UI) */
  trees: {
    kanora: [
      { id: 'M01', type: 'modulo', name: 'Operaciones', children: [
        { id: 'SM01', type: 'submodulo', name: 'Planificación de rutas', children: [
          { id: 'PANT-01', type: 'pantalla', name: 'Mapa de rutas', children: [] },
          { id: 'PANT-02', type: 'pantalla', name: 'Asignación de pedidos', children: [
            { id: 'PES-01', type: 'pestana', name: 'Filtros', children: [] },
            { id: 'PES-02', type: 'pestana', name: 'Resultados', children: [] },
            { id: 'CMP-118', type: 'componente', name: 'Tabla de pedidos', children: [] }
          ]}
        ]},
        { id: 'SM02', type: 'submodulo', name: 'Gestión de almacén', children: [
          { id: 'PANT-03', type: 'pantalla', name: 'Inventario en tiempo real', children: [] },
          { id: 'PANT-04', type: 'pantalla', name: 'Recepción de mercancía', children: [] }
        ]}
      ]},
      { id: 'M02', type: 'modulo', name: 'Facturación', children: [
        { id: 'PANT-05', type: 'pantalla', name: 'Emisión de facturas', children: [] },
        { id: 'PANT-06', type: 'pantalla', name: 'Notas de crédito', children: [] },
        { id: 'SVC-02', type: 'servicio', name: 'Servicio de timbrado CFDI', children: [] }
      ]},
      { id: 'M03', type: 'modulo', name: 'Reportes', children: [
        { id: 'PRC-03', type: 'proceso', name: 'Proceso de cierre mensual', children: [] },
        { id: 'PANT-07', type: 'pantalla', name: 'Dashboard de KPIs', children: [] }
      ]}
    ],
    verdana: [
      { id: 'M01', type: 'modulo', name: 'Agenda', children: [
        { id: 'PANT-01', type: 'pantalla', name: 'Calendario de citas', children: [] },
        { id: 'PRC-01', type: 'proceso', name: 'Recordatorios automáticos', children: [] }
      ]},
      { id: 'M02', type: 'modulo', name: 'Expedientes', children: [
        { id: 'PANT-02', type: 'pantalla', name: 'Historia clínica', children: [
          { id: 'PES-01', type: 'pestana', name: 'Antecedentes', children: [] },
          { id: 'PES-02', type: 'pestana', name: 'Estudios', children: [] }
        ]}
      ]},
      { id: 'M03', type: 'modulo', name: 'Recetas digitales', children: [
        { id: 'SVC-01', type: 'servicio', name: 'Firma electrónica', children: [] }
      ]}
    ],
    nucleo: [
      { id: 'SVC-01', type: 'servicio', name: 'Núcleo de evaluación', children: [] },
      { id: 'PRC-01', type: 'proceso', name: 'Ciclo de vida de una regla', children: [] },
      { id: 'M01', type: 'modulo', name: 'Conectores', children: [
        { id: 'PANT-01', type: 'pantalla', name: 'Consola de reglas', children: [] }
      ]}
    ]
  },

  /* ---------------- Documentos ---------------- */
  docs: [
    { id: 'DOC-101', titulo: 'Especificación funcional — Asignación de pedidos', tipo: 'Especificación funcional', nodo: 'PANT-02', nodoPath: 'Operaciones / Planificación de rutas / Asignación de pedidos', autor: 'L. Gutiérrez', fecha: '2026-10-28', version: 'v7', estado: 'Vigente' },
    { id: 'DOC-118', titulo: 'Caso de uso — Asignar pedido a ruta óptima', tipo: 'Caso de uso', nodo: 'PANT-02', nodoPath: 'Operaciones / Planificación de rutas / Asignación de pedidos', autor: 'R. Ibáñez', fecha: '2026-10-21', version: 'v3', estado: 'Vigente' },
    { id: 'DOC-124', titulo: 'Regla de negocio RN-014 — Un pedido solo puede reasignarse 2 veces', tipo: 'Regla de negocio', nodo: 'PANT-02', nodoPath: 'Operaciones / Planificación de rutas / Asignación de pedidos', autor: 'L. Gutiérrez', fecha: '2026-09-30', version: 'v2', estado: 'Vigente' },
    { id: 'DOC-131', titulo: 'Contrato API — POST /routes/assign', tipo: 'Contrato API', nodo: 'SVC-02', nodoPath: 'Facturación / Servicio de timbrado CFDI', autor: 'Equipo integraciones', fecha: '2026-10-11', version: 'v5', estado: 'En revisión' },
    { id: 'DOC-098', titulo: 'Descripción de pantalla — Inventario en tiempo real', tipo: 'Descripción de pantalla', nodo: 'PANT-03', nodoPath: 'Operaciones / Gestión de almacén / Inventario', autor: 'M. Serrano', fecha: '2026-08-15', version: 'v2', estado: 'Vigente' },
    { id: 'DOC-140', titulo: 'ADR-009 — Drizzle ORM sobre Prisma', tipo: 'Decisión arquitectónica', nodo: 'M02', nodoPath: 'Facturación', autor: 'L. Gutiérrez', fecha: '2026-10-05', version: 'v1', estado: 'Vigente' },
    { id: 'DOC-142', titulo: 'Modelo de datos — Módulo Operaciones', tipo: 'Modelo de datos', nodo: 'SM01', nodoPath: 'Operaciones / Planificación de rutas', autor: 'R. Ibáñez', fecha: '2026-10-30', version: 'v9', estado: 'Vigente' },
    { id: 'DOC-150', titulo: 'Flujo de trabajo — Recepción de mercancía', tipo: 'Flujo de trabajo', nodo: 'PANT-04', nodoPath: 'Operaciones / Gestión de almacén / Recepción', autor: 'M. Serrano', fecha: '2026-11-02', version: 'v1', estado: 'Borrador' },
    { id: 'DOC-155', titulo: 'Requisito no funcional — Latencia p95 < 300 ms en asignación', tipo: 'Requisito no funcional', nodo: 'PANT-02', nodoPath: 'Operaciones / Planificación de rutas / Asignación de pedidos', autor: 'Arquitectura', fecha: '2026-10-25', version: 'v1', estado: 'Vigente' },
    { id: 'DOC-160', titulo: 'Especificación técnica — Timbrado CFDI 4.0', tipo: 'Especificación técnica', nodo: 'SVC-02', nodoPath: 'Facturación / Servicio de timbrado CFDI', autor: 'Equipo integraciones', fecha: '2026-09-18', version: 'v4', estado: 'Vigente' },
    { id: 'DOC-171', titulo: 'Documentación de pruebas — Cierre mensual', tipo: 'Documentación de pruebas', nodo: 'PRC-03', nodoPath: 'Reportes / Proceso de cierre mensual', autor: 'QA · P. Navarro', fecha: '2026-10-17', version: 'v2', estado: 'Vigente' }
  ],

  /* ---------------- Tareas ---------------- */
  tasks: [
    { id: 'TAR-231', titulo: 'Implementar reasignación con límite RN-014', tipo: 'Desarrollo', estado: 'En curso', prioridad: 'Alta', responsable: 'R. Ibáñez', limite: '2026-11-12', estimacion: '5d', nodo: 'PANT-02', nodoPath: 'Operaciones / Planificación de rutas / Asignación de pedidos' },
    { id: 'TAR-232', titulo: 'Tabla de pedidos: virtualizar filas (>500 registros)', tipo: 'Desarrollo', estado: 'En curso', prioridad: 'Media', responsable: 'C. Peña', limite: '2026-11-14', estimacion: '3d', nodo: 'CMP-118', nodoPath: 'Operaciones / … / Asignación de pedidos / Tabla de pedidos' },
    { id: 'TAR-228', titulo: 'Actualizar especificación funcional v8 tras feedback', tipo: 'Documentación', estado: 'Pendiente', prioridad: 'Media', responsable: 'L. Gutiérrez', limite: '2026-11-18', estimacion: '1d', nodo: 'PANT-02', nodoPath: 'Operaciones / Planificación de rutas / Asignación de pedidos' },
    { id: 'TAR-240', titulo: 'Análisis de dependencia con RN-002 (facturación)', tipo: 'Análisis', estado: 'Bloqueada', prioridad: 'Crítica', responsable: 'L. Gutiérrez', limite: '2026-11-07', estimacion: '2d', nodo: 'PANT-02', nodoPath: 'Operaciones / Planificación de rutas / Asignación de pedidos' },
    { id: 'TAR-241', titulo: 'Pruebas E2E asignación → factura', tipo: 'Desarrollo', estado: 'Pendiente', prioridad: 'Alta', responsable: 'P. Navarro', limite: '2026-11-21', estimacion: '4d', nodo: 'PANT-02', nodoPath: 'Operaciones / Planificación de rutas / Asignación de pedidos' },
    { id: 'TAR-219', titulo: 'Corregir desbordamiento de notas de crédito', tipo: 'Mantenimiento', estado: 'En revisión', prioridad: 'Alta', responsable: 'C. Peña', limite: '2026-11-06', estimacion: '2d', nodo: 'PANT-06', nodoPath: 'Facturación / Notas de crédito' },
    { id: 'TAR-217', titulo: 'ADR-009: cerrar decisión ORM', tipo: 'Documentación', estado: 'Hecha', prioridad: 'Media', responsable: 'L. Gutiérrez', limite: '2026-10-06', estimacion: '0.5d', nodo: 'M02', nodoPath: 'Facturación' },
    { id: 'TAR-244', titulo: 'Migración CFDI 4.0 → catálogos SAT 2026', tipo: 'Desarrollo', estado: 'Pendiente', prioridad: 'Crítica', responsable: 'R. Ibáñez', limite: '2026-11-25', estimacion: '8d', nodo: 'SVC-02', nodoPath: 'Facturación / Servicio de timbrado CFDI' },
    { id: 'TAR-245', titulo: 'Documentar contrato POST /routes/assign v5', tipo: 'Documentación', estado: 'En curso', prioridad: 'Media', responsable: 'Equipo integraciones', limite: '2026-11-11', estimacion: '1d', nodo: 'SVC-02', nodoPath: 'Facturación / Servicio de timbrado CFDI' },
    { id: 'TAR-226', titulo: 'Revisar cobertura: recepción de mercancía', tipo: 'Análisis', estado: 'Bloqueada', prioridad: 'Baja', responsable: 'M. Serrano', limite: '2026-11-28', estimacion: '1d', nodo: 'PANT-04', nodoPath: 'Operaciones / Gestión de almacén / Recepción' },
    { id: 'TAR-233', titulo: 'KPIs: definición de “pedido asignado a tiempo”', tipo: 'Análisis', estado: 'En revisión', prioridad: 'Media', responsable: 'R. Ibáñez', limite: '2026-11-09', estimacion: '1d', nodo: 'PANT-07', nodoPath: 'Reportes / Dashboard de KPIs' },
    { id: 'TAR-248', titulo: 'Actualizar manual técnico del cierre mensual', tipo: 'Documentación', estado: 'Hecha', prioridad: 'Baja', responsable: 'P. Navarro', limite: '2026-10-29', estimacion: '1d', nodo: 'PRC-03', nodoPath: 'Reportes / Proceso de cierre mensual' }
  ],

  /* ---------------- Incidencias ---------------- */
  incidents: [
    {
      id: 'INC-087', titulo: 'Reasignación permite un 3er intento en ruta consolidada', severidad: 'Crítica', prioridad: 'Crítica',
      estado: 'En corrección', responsable: 'R. Ibáñez', nodo: 'PANT-02',
      observado: 'Al consolidar 2 rutas, el pedido reasignado acepta un nuevo cambio rompiendo RN-014.',
      esperado: 'El sistema debe bloquear cualquier reasignación que supere 2 intentos por pedido.',
      pasos: ['Crear ruta consolidada con pedidos P-1043 y P-1044', 'Reasignar P-1043 a otra ruta (intento 2)', 'Intentar reasignar de nuevo (intento 3)'],
      evidencias: ['captura-error.png', 'log-asignacion.txt'], tareas: ['TAR-231'], cambios: ['MOD-031'], fecha: '2026-11-03'
    },
    {
      id: 'INC-084', titulo: 'Tabla de pedidos pierde selección al aplicar filtros', severidad: 'Alta', prioridad: 'Alta',
      estado: 'En análisis', responsable: 'C. Peña', nodo: 'CMP-118',
      observado: 'La selección de filas se reinicia al cambiar el filtro de estado.',
      esperado: 'La selección debe conservarse mientras el pedido siga visible tras filtrar.',
      pasos: ['Seleccionar 3 pedidos', 'Filtrar por estado = “Pendiente”', 'Observar selección vacía'],
      evidencias: ['video-repro.mp4'], tareas: ['TAR-232'], cambios: [], fecha: '2026-10-30'
    },
    {
      id: 'INC-079', titulo: 'Factura timbrada con monto redondeado incorrecto', severidad: 'Alta', prioridad: 'Media',
      estado: 'Abierta', responsable: 'Equipo integraciones', nodo: 'SVC-02',
      observado: 'Totales con centavos > .5 redondean hacia abajo en el CFDI.',
      esperado: 'Redondeo bancario a 2 decimales según especificación técnica v4.',
      pasos: ['Emitir factura con 3 partidas de 19.995', 'Verificar XML timbrado'],
      evidencias: ['cfdi-ejemplo.xml'], tareas: ['TAR-244'], cambios: [], fecha: '2026-10-22'
    },
    {
      id: 'INC-071', titulo: 'Recepción duplica línea al escanear código de barras 2 veces', severidad: 'Media', prioridad: 'Media',
      estado: 'Verificada', responsable: 'M. Serrano', nodo: 'PANT-04',
      observado: 'Doble escaneo en <400 ms genera dos líneas idénticas.',
      esperado: 'Debounce de 800 ms o detección de duplicado por UUID de escaneo.',
      pasos: ['Escanear el mismo código dos veces rápido', 'Revisar líneas capturadas'],
      evidencias: [], tareas: [], cambios: ['MOD-028'], fecha: '2026-10-09'
    },
    {
      id: 'INC-066', titulo: 'Dashboard KPIs muestra “a tiempo” con criterio anterior', severidad: 'Baja', prioridad: 'Baja',
      estado: 'Abierta', responsable: 'R. Ibáñez', nodo: 'PANT-07',
      observado: 'El indicador usa la definición previa al acuerdo TAR-233.',
      esperado: 'Mostrar definición vigente o marcar como “definición pendiente”.',
      pasos: ['Abrir dashboard', 'Pasar el cursor sobre KPI “A tiempo”'],
      evidencias: [], tareas: ['TAR-233'], cambios: [], fecha: '2026-10-02'
    }
  ],

  /* ---------------- Modificaciones ---------------- */
  changes: [
    { id: 'MOD-031', fecha: '2026-11-04', tipo: 'Funcional', descripcion: 'Reasignación limitada a 2 intentos (RN-014) en capa de dominio', estado: 'Propuesto', elementos: 'PANT-02 · CMP-118', tareas: 'TAR-231', incidencias: 'INC-087', git: '—' },
    { id: 'MOD-030', fecha: '2026-11-01', tipo: 'Técnico', descripcion: 'Virtualización de tabla de pedidos con react-virtuoso', estado: 'Ejecutado', elementos: 'CMP-118', tareas: 'TAR-232', incidencias: 'INC-084', git: 'a3f9c21' },
    { id: 'MOD-029', fecha: '2026-10-27', tipo: 'Funcional', descripcion: 'Nuevo flujo de nota de crédito con motivo obligatorio', estado: 'Ejecutado', elementos: 'PANT-06', tareas: 'TAR-219', incidencias: '—', git: '77be104' },
    { id: 'MOD-028', fecha: '2026-10-12', tipo: 'Técnico', descripcion: 'Debounce 800 ms + clave de idempotencia en escaneo', estado: 'Ejecutado', elementos: 'PANT-04', tareas: '—', incidencias: 'INC-071', git: 'c90d2aa' },
    { id: 'MOD-027', fecha: '2026-10-06', tipo: 'Técnico', descripcion: 'ADR-009: adopción de Drizzle ORM', estado: 'Ejecutado', elementos: 'M02 · SVC-02', tareas: 'TAR-217', incidencias: '—', git: 'e51b7f0' },
    { id: 'MOD-026', fecha: '2026-10-01', tipo: 'Funcional', descripcion: 'KPIs de cierre mensual: 4 indicadores nuevos', estado: 'Propuesto', elementos: 'PANT-07 · PRC-03', tareas: 'TAR-233', incidencias: 'INC-066', git: '—' }
  ],

  /* ---------------- Relaciones (trazabilidad) ---------------- */
  relations: [
    { origen: 'TAR-231', tipo: 'modifica', destino: 'PANT-02' },
    { origen: 'TAR-231', tipo: 'mitiga', destino: 'INC-087' },
    { origen: 'TAR-232', tipo: 'afecta', destino: 'CMP-118' },
    { origen: 'DOC-124', tipo: 'describe regla', destino: 'PANT-02' },
    { origen: 'DOC-118', tipo: 'documenta', destino: 'PANT-02' },
    { origen: 'DOC-101', tipo: 'especifica', destino: 'PANT-02' },
    { origen: 'MOD-031', tipo: 'corrige', destino: 'INC-087' },
    { origen: 'MOD-029', tipo: 'afecta', destino: 'PANT-06' },
    { origen: 'RN-014', tipo: 'aplicada en', destino: 'PANT-02' },
    { origen: 'RN-014', tipo: 'aplicada en', destino: 'SVC-02' },
    { origen: 'PRC-03', tipo: 'verificado por', destino: 'DOC-171' },
    { origen: 'PANT-02', tipo: 'depende de', destino: 'SVC-02' },
    { origen: 'PANT-02', tipo: 'depende de', destino: 'RN-002' }
  ],

  traceQueries: [
    { q: '¿Qué tareas afectan esta pantalla?', destino: 'PANT-02 · Asignación de pedidos', filas: [['TAR-231', 'Reasignación con límite RN-014', 'En curso · Alta'], ['TAR-228', 'Actualizar especificación funcional', 'Pendiente · Media'], ['TAR-240', 'Análisis de dependencia RN-002', 'Bloqueada · Crítica'], ['TAR-241', 'Pruebas E2E asignación → factura', 'Pendiente · Alta']] },
    { q: '¿Qué pantallas utilizan esta regla?', destino: 'RN-014 · Reasignación máx. 2 veces', filas: [['PANT-02', 'Asignación de pedidos', 'Operaciones / Planificación'], ['SVC-02', 'Servicio de timbrado CFDI', 'Facturación']] },
    { q: '¿Qué documentos describen este proceso?', destino: 'PRC-03 · Cierre mensual', filas: [['DOC-171', 'Documentación de pruebas', 'v2 · Vigente'], ['DOC-142', 'Modelo de datos — Operaciones', 'v9 · Vigente']] },
    { q: '¿Qué modificaciones implementaron esta funcionalidad?', destino: 'PANT-06 · Notas de crédito', filas: [['MOD-029', 'Flujo con motivo obligatorio', 'Ejecutado · 77be104']] },
    { q: '¿Qué pruebas validan este caso de uso?', destino: 'DOC-118 · CU Asignar pedido a ruta óptima', filas: [['TAR-241', 'E2E asignación → factura', 'Pendiente · P. Navarro'], ['DOC-171', 'Doc. de pruebas — cierre mensual', 'v2 · Vigente']] },
    { q: '¿Qué incidencias afectan este módulo?', destino: 'M01 · Operaciones', filas: [['INC-087', 'Reasignación supera RN-014', 'Crítica · En corrección'], ['INC-084', 'Tabla pierde selección al filtrar', 'Alta · En análisis'], ['INC-071', 'Escaneo duplica línea', 'Media · Verificada']] },
    { q: '¿Qué funcionalidades dependen de este componente?', destino: 'CMP-118 · Tabla de pedidos', filas: [['PANT-02', 'Asignación de pedidos', 'Operaciones'], ['PES-02', 'Resultados (pestaña)', 'Anidada en PANT-02']] }
  ],

  /* ---------------- Seguimiento ---------------- */
  moduleProgress: [
    { name: 'M01 · Operaciones', pct: 74, sub: [['SM01 · Planificación de rutas', 71], ['SM02 · Gestión de almacén', 79]] },
    { name: 'M02 · Facturación', pct: 66, sub: [['SVC-02 · Timbrado CFDI', 58]] },
    { name: 'M03 · Reportes', pct: 85, sub: [['PRC-03 · Cierre mensual', 90], ['PANT-07 · Dashboard KPIs', 80]] }
  ],
  noDoc: ['PANT-05 · Emisión de facturas', 'PES-01 · Filtros (pestaña)', 'PRC-01 · …'],
  noTests: ['DOC-118 · CU Asignar pedido a ruta óptima', 'PANT-04 · Recepción de mercancía'],
  blocked: ['TAR-240 · Análisis dependencia RN-002 (Crítica)', 'TAR-226 · Cobertura recepción (Baja)'],
  activity: [
    { time: 'hace 12 min', actor: 'R. Ibáñez', ia: false, text: 'Comentó en TAR-231: “RN-014 ahora valida en dominio, falta integración”' },
    { time: 'hace 40 min', actor: 'Claude Code', ia: true, text: 'Registró ejecución: tests de reasignación (12/12 OK) vía MCP' },
    { time: 'hace 1 h', actor: 'M. Serrano', ia: false, text: 'Actualizó DOC-150 a v1 (Borrador)' },
    { time: 'hace 3 h', actor: 'P. Navarro', ia: false, text: 'Cerró INC-071 como Verificada (MOD-028)' },
    { time: 'ayer 17:42', actor: 'Claude Code', ia: true, text: 'Propuso MOD-031 vinculada a INC-087 vía agente' },
    { time: 'ayer 15:03', actor: 'L. Gutiérrez', ia: false, text: 'Aprobó ADR-009 · MOD-027 ejecutado (git e51b7f0)' }
  ],

  /* ---------------- Agentes IA ---------------- */
  agentOps: [
    { op: 'Consultar documentación', mech: 'MCP + REST', permiso: 'lectura:docs', ultimo: 'hace 40 min · Claude Code' },
    { op: 'Consultar estructura funcional', mech: 'MCP + REST', permiso: 'lectura:estructura', ultimo: 'hace 40 min · Claude Code' },
    { op: 'Consultar tareas', mech: 'MCP + REST + CLI', permiso: 'lectura:tareas', ultimo: 'hace 1 h · Claude Code' },
    { op: 'Crear tareas', mech: 'MCP + REST', permiso: 'escritura:tareas', ultimo: 'ayer · Claude Code' },
    { op: 'Actualizar estados', mech: 'MCP + REST + Webhooks', permiso: 'escritura:tareas:estado', ultimo: 'hace 40 min · Claude Code' },
    { op: 'Registrar modificaciones', mech: 'MCP + REST', permiso: 'escritura:cambios', ultimo: 'ayer · Claude Code' },
    { op: 'Consultar decisiones (ADR)', mech: 'MCP + REST', permiso: 'lectura:decisiones', ultimo: 'hace 2 días · Claude Code' },
    { op: 'Consultar dependencias', mech: 'REST + MCP', permiso: 'lectura:relaciones', ultimo: 'hace 3 h · Claude Code' },
    { op: 'Reportar resultados de implementación', mech: 'MCP + Webhooks + Git', permiso: 'escritura:resultados', ultimo: 'hace 40 min · Claude Code' },
    { op: 'Registrar pruebas ejecutadas', mech: 'MCP + REST', permiso: 'escritura:pruebas', ultimo: 'hace 40 min · Claude Code' }
  ],
  agentRuns: [
    { agente: 'Claude Code', op: 'tests:run (reasignación)', resultado: '12/12 OK', actor: 'IA', fecha: '2026-11-05 10:41' },
    { agente: 'Claude Code', op: 'tarea:update TAR-231 → En curso', resultado: 'OK', actor: 'IA', fecha: '2026-11-05 10:38' },
    { agente: 'Claude Code', op: 'modificacion:proponer (MOD-031)', resultado: 'Creada', actor: 'IA', fecha: '2026-11-04 17:58' },
    { agente: 'R. Ibáñez', op: 'decisión:aprobar ADR-009', resultado: 'OK', actor: 'Humano', fecha: '2026-10-06 09:12' },
    { agente: 'L. Gutiérrez', op: 'doc:publish DOC-101 v7', resultado: 'OK', actor: 'Humano', fecha: '2026-10-28 13:20' }
  ],
  integrations: [
    { name: 'Claude Code — Servidor MCP', desc: 'Herramientas de lectura/escritura acotadas por permiso por producto', estado: 'Conectado', detalle: 'mcp://kanora/mcp · 14 herramientas · v0.9' },
    { name: 'API REST pública', desc: '/api/v1 · OpenAPI 3.1 · autenticación por token de servicio', estado: 'Activo', detalle: 'api.devcycle.example.com/v1' },
    { name: 'Git — kanora-core', desc: 'Webhook push → vincular commits con modificaciones (MOD-*)', estado: 'Conectado', detalle: 'github.com/acme/kanora-core · main protegido' },
    { name: 'Markdown export', desc: 'Exportar documentación y ADRs a .md versionado en repo', estado: 'Disponible', detalle: 'docs/ export bajo demanda' },
    { name: 'Webhooks salientes', desc: 'Notificar a Slack/CI cuando un agente registra resultados', estado: 'Disponible', detalle: '2 endpoints configurados' },
    { name: 'CLI “devcycle”', desc: 'Consulta de estructura, tareas y registro de modificaciones desde terminal', estado: 'Planeado', detalle: 'Fase 6 del plan' }
  ],

  /* ---------------- Config ---------------- */
  members: [
    { nombre: 'L. Gutiérrez', email: 'lgutierrez@acme.example.com', rol: 'Administrador de producto', iniciales: 'LG', color: '#4f46e5' },
    { nombre: 'R. Ibáñez', email: 'ribanez@acme.example.com', rol: 'Colaborador', iniciales: 'RI', color: '#0284c7' },
    { nombre: 'C. Peña', email: 'cpena@acme.example.com', rol: 'Colaborador', iniciales: 'CP', color: '#0d9488' },
    { nombre: 'M. Serrano', email: 'mserrano@acme.example.com', rol: 'Colaborador', iniciales: 'MS', color: '#d97706' },
    { nombre: 'P. Navarro', email: 'pnavarro@acme.example.com', rol: 'Colaborador', iniciales: 'PN', color: '#db2777' },
    { nombre: 'Auditoría QA', email: 'qa-audit@acme.example.com', rol: 'Consulta', iniciales: 'QA', color: '#64748b' }
  ],
  roles: [
    { rol: 'Administrador global', alcance: 'Toda la organización', permisos: 'Productos, miembros, roles, integraciones, auditoría' },
    { rol: 'Administrador de producto', alcance: 'Un producto', permisos: 'Estructura funcional, documentación, tareas, incidencias, configuración del producto' },
    { rol: 'Colaborador', alcance: 'Un producto', permisos: 'Crear/editar tareas, docs, incidencias; sin gestión de miembros ni roles' },
    { rol: 'Consulta', alcance: 'Un producto', permisos: 'Solo lectura en todo el espacio del producto' }
  ],
  taskStates: ['Pendiente', 'En curso', 'En revisión', 'Hecha'],
  taskStatesSide: ['Bloqueada'],

  /* ---------------- Fichas / adjuntos ---------------- */
  nodeSummary: {
    'PANT-02': { estado: 'En desarrollo', responsable: 'R. Ibáñez', actualizado: 'hace 12 min', avance: 68, descripcion: 'Pantalla central de asignación de pedidos a rutas. Permite filtrar pedidos pendientes, seleccionar múltiples filas y reasignar a rutas existentes o nuevas consolidadas. Es la pantalla con más trazabilidad del producto.' }
  }
};
