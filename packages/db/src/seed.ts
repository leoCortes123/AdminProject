/**
 * Seed idempotente de DevCycle.
 *
 *   tsx src/seed.ts           — catálogos (roles, permisos, tipos de nodo/documento)
 *   tsx src/seed.ts --demo    — + organización demo y 3 productos ficticios (mockup reducido)
 *
 * Los workflow_states/transiciones por producto se crean con cada producto.
 * El primer usuario registrado recibe admin_global (lógica en apps/api).
 */
import postgres from 'postgres';
import { PERMISSIONS, ROLE_KEYS } from '@devcycle/shared';
import { DEFAULT_WORKFLOW_STATES, DEFAULT_WORKFLOW_TRANSITIONS } from './workflow-defaults.js';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://devcycle:devcycle@localhost:5432/devcycle';
const demo = process.argv.includes('--demo');
const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

const ROLE_LABELS: Record<string, string> = {
  admin_global: 'Administrador global',
  admin_product: 'Administrador de producto',
  collaborator: 'Colaborador',
  viewer: 'Consulta',
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin_global: [...PERMISSIONS],
  admin_product: [
    'members:manage',
    'config:manage',
    'integrations:manage',
    'nodes:write',
    'docs:read',
    'docs:write',
    'docs:publish',
    'tasks:write',
    'issues:write',
    'changes:propose',
    'changes:execute',
    'audit:read',
    'agent:confirm',
  ],
  collaborator: [
    'nodes:write',
    'docs:read',
    'docs:write',
    'tasks:write',
    'issues:write',
    'changes:propose',
  ],
  viewer: ['docs:read'],
};

const NODE_TYPES: Array<{
  key: string;
  label: string;
  color: string;
  icon: string;
  isStructural: boolean;
  position: number;
}> = [
  {
    key: 'modulo',
    label: 'Módulo',
    color: '#6366f1',
    icon: 'box',
    isStructural: true,
    position: 0,
  },
  {
    key: 'submodulo',
    label: 'Submódulo',
    color: '#8b5cf6',
    icon: 'boxes',
    isStructural: true,
    position: 1,
  },
  {
    key: 'pantalla',
    label: 'Pantalla',
    color: '#0ea5e9',
    icon: 'monitor',
    isStructural: true,
    position: 2,
  },
  {
    key: 'pestana',
    label: 'Pestaña',
    color: '#06b6d4',
    icon: 'columns-2',
    isStructural: true,
    position: 3,
  },
  {
    key: 'componente',
    label: 'Componente',
    color: '#10b981',
    icon: 'puzzle',
    isStructural: false,
    position: 4,
  },
  {
    key: 'proceso',
    label: 'Proceso',
    color: '#f59e0b',
    icon: 'workflow',
    isStructural: false,
    position: 5,
  },
  {
    key: 'servicio',
    label: 'Servicio',
    color: '#f97316',
    icon: 'server',
    isStructural: false,
    position: 6,
  },
  {
    key: 'otro',
    label: 'Otro',
    color: '#64748b',
    icon: 'circle-dashed',
    isStructural: false,
    position: 7,
  },
];

// 13 tipos documentales del prompt §5.3 (decisión arquitectónica codificada como `adr`)
const DOCUMENT_TYPES: Array<{ key: string; label: string; description: string; position: number }> =
  [
    {
      key: 'spec',
      label: 'Especificación funcional',
      description: 'Comportamiento funcional de módulos y pantallas',
      position: 0,
    },
    {
      key: 'screen_desc',
      label: 'Descripción de pantalla',
      description: 'Layout, acciones y estados de una pantalla',
      position: 1,
    },
    {
      key: 'use_case',
      label: 'Caso de uso',
      description: 'Actor, objetivo, flujo principal y alternativos',
      position: 2,
    },
    {
      key: 'workflow',
      label: 'Flujo de trabajo',
      description: 'Secuencia de pasos de un proceso',
      position: 3,
    },
    {
      key: 'business_rule',
      label: 'Regla de negocio',
      description: 'Restricción o política de dominio',
      position: 4,
    },
    {
      key: 'req_functional',
      label: 'Requisito funcional',
      description: 'Capacidad que el sistema debe ofrecer',
      position: 5,
    },
    {
      key: 'req_non_functional',
      label: 'Requisito no funcional',
      description: 'Rendimiento, seguridad, usabilidad…',
      position: 6,
    },
    {
      key: 'data_model',
      label: 'Modelo de datos',
      description: 'Entidades, atributos y relaciones',
      position: 7,
    },
    {
      key: 'api_contract',
      label: 'Contrato API',
      description: 'Endpoints, esquemas y errores',
      position: 8,
    },
    {
      key: 'tech_spec',
      label: 'Especificación técnica',
      description: 'Diseño técnico de una implementación',
      position: 9,
    },
    {
      key: 'adr',
      label: 'Decisión arquitectónica (ADR)',
      description: 'Contexto, decisión y consecuencias',
      position: 10,
    },
    {
      key: 'tech_manual',
      label: 'Manual técnico',
      description: 'Guía de operación y mantenimiento',
      position: 11,
    },
    {
      key: 'test_doc',
      label: 'Documentación de pruebas',
      description: 'Estrategia, casos y resultados de pruebas',
      position: 12,
    },
  ];

async function seedCatalogs() {
  for (const key of ROLE_KEYS) {
    await sql`INSERT INTO roles (key, label) VALUES (${key}, ${ROLE_LABELS[key] ?? key})
              ON CONFLICT (key) DO NOTHING`;
  }
  for (const key of PERMISSIONS) {
    await sql`INSERT INTO permissions (key) VALUES (${key}) ON CONFLICT (key) DO NOTHING`;
  }
  for (const [roleKey, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permKey of permKeys) {
      await sql`INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id FROM roles r, permissions p
                WHERE r.key = ${roleKey} AND p.key = ${permKey}
                ON CONFLICT DO NOTHING`;
    }
  }
  for (const t of NODE_TYPES) {
    await sql`INSERT INTO node_types (product_id, key, label, color, icon, is_structural, position)
              VALUES (NULL, ${t.key}, ${t.label}, ${t.color}, ${t.icon}, ${t.isStructural}, ${t.position})
              ON CONFLICT DO NOTHING`;
  }
  for (const t of DOCUMENT_TYPES) {
    await sql`INSERT INTO document_types (key, label, description, position)
              VALUES (${t.key}, ${t.label}, ${t.description}, ${t.position})
              ON CONFLICT (key) DO NOTHING`;
  }
  console.info('Catálogos OK (roles, permisos, tipos de nodo/documento).');
}

/** ltree label estable a partir del código: minúsculas, `-` → `_`. */
const ltreeLabel = (code: string) => code.toLowerCase().replace(/-/g, '_');

async function createProductWithDefaults(
  orgId: string,
  p: {
    slug: string;
    name: string;
    tagline: string;
    status: string;
    techStack: string[];
    color: string;
    icon: string;
  },
) {
  const [product] = await sql<{ id: string }[]>`
    INSERT INTO products (org_id, slug, name, tagline, status, tech_stack, color, icon)
    VALUES (${orgId}, ${p.slug}, ${p.name}, ${p.tagline}, ${p.status}, ${sql.json(p.techStack)}, ${p.color}, ${p.icon})
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id`;
  const productId = product!.id;

  for (const s of DEFAULT_WORKFLOW_STATES) {
    await sql`INSERT INTO workflow_states (product_id, scope, key, label, color, position, is_terminal)
              VALUES (${productId}, ${s.scope}, ${s.key}, ${s.label}, ${s.color}, ${s.position}, ${s.isTerminal})
              ON CONFLICT DO NOTHING`;
  }
  const states = await sql<{ id: string; scope: string; key: string }[]>`
    SELECT id, scope, key FROM workflow_states WHERE product_id = ${productId}`;
  const stateId = (scope: string, key: string) =>
    states.find((s) => s.scope === scope && s.key === key)?.id ?? null;
  for (const t of DEFAULT_WORKFLOW_TRANSITIONS) {
    const exists = await sql`SELECT 1 FROM state_transitions t2
      WHERE t2.product_id = ${productId} AND t2.scope = ${t.scope}
        AND t2.to_state_id = ${stateId(t.scope, t.toKey)}
        AND t2.from_state_id IS NOT DISTINCT FROM ${t.fromKey ? stateId(t.scope, t.fromKey) : null}
      LIMIT 1`;
    if (exists.length === 0) {
      await sql`INSERT INTO state_transitions (product_id, scope, from_state_id, to_state_id, required_permission, requires_confirmation)
                VALUES (${productId}, ${t.scope}, ${t.fromKey ? stateId(t.scope, t.fromKey) : null},
                        ${stateId(t.scope, t.toKey)}, ${t.requiredPermission ?? null}, ${t.requiresConfirmation ?? false})`;
    }
  }
  return productId;
}

interface DemoNode {
  code: string;
  name: string;
  typeKey: string;
  description?: string;
  objective?: string;
  children?: DemoNode[];
}

async function insertTree(
  productId: string,
  nodes: DemoNode[],
  parentId: string | null,
  parentPath: string | null,
  depth: number,
) {
  let position = 0;
  for (const node of nodes) {
    const [type] = await sql<
      { id: string }[]
    >`SELECT id FROM node_types WHERE key = ${node.typeKey} AND product_id IS NULL`;
    const path = parentPath ? `${parentPath}.${ltreeLabel(node.code)}` : ltreeLabel(node.code);
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO product_nodes (product_id, parent_id, node_type_id, code, name, description, objective, path, depth, position)
      VALUES (${productId}, ${parentId}, ${type!.id}, ${node.code}, ${node.name}, ${node.description ?? null}, ${node.objective ?? null}, ${path}::ltree, ${depth}, ${position})
      ON CONFLICT DO NOTHING
      RETURNING id`;
    // Las filas ya existentes (re-semilla idempotente) reciben la descripción
    // funcional si aún no la tienen — la demo debe mostrar la ficha completa.
    let nodeId = row?.id ?? null;
    if (!row) {
      const [existing] = await sql<{ id: string }[]>`
        SELECT id FROM product_nodes
        WHERE product_id = ${productId} AND code = ${node.code} AND deleted_at IS NULL
        LIMIT 1`;
      nodeId = existing?.id ?? null;
      if (existing && (node.description || node.objective)) {
        await sql`UPDATE product_nodes
                  SET description = COALESCE(description, ${node.description ?? null}),
                      objective = COALESCE(objective, ${node.objective ?? null})
                  WHERE product_id = ${productId} AND code = ${node.code} AND deleted_at IS NULL`;
      }
    }
    position += 1;
    // Recursar siempre (también si el padre ya existía) para que la
    // re-semilla no salte a los hijos de un nodo existente.
    if (nodeId && node.children?.length) {
      await insertTree(productId, node.children, nodeId, path, depth + 1);
    }
  }
}

async function seedDemo() {
  const [org] = await sql<{ id: string }[]>`
    INSERT INTO organizations (name, slug) VALUES ('Acme & Co', 'acme')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id`;
  const orgId = org!.id;

  const kanora = await createProductWithDefaults(orgId, {
    slug: 'kanora',
    name: 'Kanora',
    tagline: 'Gestión de operaciones para retail',
    status: 'active',
    techStack: ['Next.js', 'NestJS', 'PostgreSQL'],
    color: '#6366f1',
    icon: 'shopping-cart',
  });
  await createProductWithDefaults(orgId, {
    slug: 'verdana',
    name: 'Verdana',
    tagline: 'Fichas clínicas para consultas',
    status: 'in_development',
    techStack: ['React', 'Fastify', 'PostgreSQL'],
    color: '#10b981',
    icon: 'heart-pulse',
  });
  await createProductWithDefaults(orgId, {
    slug: 'nucleo',
    name: 'Núcleo',
    tagline: 'Librería compartida de componentes',
    status: 'maintenance',
    techStack: ['TypeScript'],
    color: '#f59e0b',
    icon: 'boxes',
  });

  // Árbol reducido de Kanora (el completo vive en muckup/js/data.js)
  await insertTree(
    kanora,
    [
      {
        code: 'MODULO-01',
        name: 'Catálogo',
        typeKey: 'modulo',
        description: 'Catálogo de productos de retail con variantes, galería y ficha editable.',
        objective: 'Exponer el catálogo completo con disponibilidad y precios actualizados.',
        children: [
          { code: 'PANT-01', name: 'Listado de productos', typeKey: 'pantalla' },
          {
            code: 'PANT-02',
            name: 'Ficha de producto',
            typeKey: 'pantalla',
            description:
              'Pantalla central de la ficha de producto: variantes, galería y edición con concurrencia optimista.',
            objective:
              'Consolidar pedidos en rutas óptimas minimizando kilómetros y ventanas de entrega.',
            children: [
              { code: 'COMP-01', name: 'Selector de variante', typeKey: 'componente' },
              { code: 'COMP-02', name: 'Galería de imágenes', typeKey: 'componente' },
            ],
          },
        ],
      },
      {
        code: 'MODULO-02',
        name: 'Pedidos',
        typeKey: 'modulo',
        children: [
          { code: 'PANT-03', name: 'Carrito', typeKey: 'pantalla' },
          {
            code: 'PANT-04',
            name: 'Checkout',
            typeKey: 'pantalla',
            children: [{ code: 'PROC-01', name: 'Cálculo de envío', typeKey: 'proceso' }],
          },
        ],
      },
      { code: 'MODULO-03', name: 'Administración', typeKey: 'modulo' },
    ],
    null,
    null,
    0,
  );

  await seedDemoDocs(kanora);
  await seedDemoWork(kanora);
  await seedDemoTrace(kanora);

  console.info('Demo OK: organización "Acme & Co" y productos kanora · verdana · nucleo.');
  console.info(
    'Registra el primer usuario en la app: recibirá el rol admin_global automáticamente.',
  );
}

/**
 * Documentos demo de Kanora (Fase 2, idempotentes por código): uno vigente
 * multi-nodo (spec v2), un caso de uso vigente y una regla en revisión.
 * Los códigos coinciden con el mockup (muckup/js/data.js).
 */
async function seedDemoDocs(kanora: string) {
  const docs = [
    {
      code: 'DOC-101',
      title: 'Especificación funcional — Ficha de producto',
      typeKey: 'spec',
      status: 'published',
      version: 2,
      body: '# Ficha de producto\n\nEspecificación vigente del módulo Catálogo.\n\n## Criterios de aceptación\n\n- Visualizar variantes sin reordenar filas.\n- Guardar cambios con concurrencia optimista (409 si otro guardó antes).\n',
      snapshots: [
        '# Ficha de producto\n\nBorrador inicial de la especificación.',
        '# Ficha de producto\n\nEspecificación vigente del módulo Catálogo.\n\n## Criterios de aceptación\n\n- Visualizar variantes sin reordenar filas.\n- Guardar cambios con concurrencia optimista (409 si otro guardó antes).\n',
      ],
      nodes: ['MODULO-01', 'PANT-02'],
    },
    {
      code: 'DOC-118',
      title: 'Caso de uso — Asignar pedido a ruta óptima',
      typeKey: 'use_case',
      status: 'published',
      version: 1,
      body: '# Asignar pedido a ruta óptima\n\nActor: operario de operaciones.\n\nFlujo principal y alternativos del caso de uso CU-014.\n',
      metadata: {
        actor: 'Operario de operaciones',
        goal: 'Asignar un pedido a la ruta óptima minimizando kilómetros y ventanas de entrega.',
        preconditions: ['El pedido está confirmado', 'Hay rutas disponibles'],
        mainFlow: [
          'Seleccionar pedido pendiente',
          'Calcular rutas candidatas',
          'Elegir ruta óptima',
          'Confirmar asignación',
        ],
        alternativeFlows: ['Si no hay capacidad, rechazar con motivo'],
        postconditions: ['El pedido queda asignado a una ruta', 'Se notifica al conductor'],
        priority: 'high',
      },
      snapshots: [
        '# Asignar pedido a ruta óptima\n\nActor: operario de operaciones.\n\nFlujo principal y alternativos del caso de uso CU-014.\n',
      ],
      nodes: ['PANT-02'],
    },
    {
      code: 'DOC-124',
      title: 'Regla de negocio RN-014 — Reasignación máxima 2 veces',
      typeKey: 'business_rule',
      status: 'in_review',
      version: 1,
      body: '# Regla de negocio RN-014\n\nUn pedido solo puede reasignarse 2 veces. En revisión por operaciones.\n',
      metadata: {
        condition: 'Un pedido ya fue reasignado 2 veces',
        action: 'Bloquear nuevas reasignaciones y notificar al supervisor',
        scope: 'Asignación de pedidos',
        exceptions: ['Autorización expresa del supervisor'],
        owner: 'Operaciones',
      },
      snapshots: [
        '# Regla de negocio RN-014\n\nUn pedido solo puede reasignarse 2 veces. En revisión por operaciones.\n',
      ],
      nodes: ['MODULO-02'],
    },
  ] as const;

  for (const doc of docs) {
    const [type] = await sql<
      { id: string }[]
    >`SELECT id FROM document_types WHERE key = ${doc.typeKey}`;
    const [existing] = await sql<{ id: string }[]>`
      SELECT id FROM content_items WHERE product_id = ${kanora} AND code = ${doc.code} LIMIT 1`;
    if (existing) continue;
    const [item] = await sql<{ id: string }[]>`
      INSERT INTO content_items (product_id, doc_type_id, code, title, body_markdown, metadata, status, version)
      VALUES (${kanora}, ${type!.id}, ${doc.code}, ${doc.title}, ${doc.body}, ${JSON.stringify((doc as { metadata?: unknown }).metadata ?? {})}::jsonb, ${doc.status}, ${doc.version})
      ON CONFLICT DO NOTHING
      RETURNING id`;
    if (!item) continue;
    for (let i = 0; i < doc.snapshots.length; i++) {
      await sql`INSERT INTO item_versions (item_id, version, title, body_markdown, metadata, change_note)
                VALUES (${item.id}, ${i + 1}, ${doc.title}, ${doc.snapshots[i]!}, ${JSON.stringify((doc as { metadata?: unknown }).metadata ?? {})}::jsonb, ${i === 0 ? 'Seed demo' : 'Publicación demo'})
                ON CONFLICT DO NOTHING`;
    }
    for (const nodeCode of doc.nodes) {
      await sql`INSERT INTO item_node_links (item_id, node_id, product_id)
                SELECT ${item.id}, n.id, ${kanora} FROM product_nodes n
                WHERE n.product_id = ${kanora} AND n.code = ${nodeCode} AND n.deleted_at IS NULL
                ON CONFLICT DO NOTHING`;
    }
  }
  console.info('Documentos demo OK (DOC-101 · DOC-118 · DOC-124 en kanora).');
}

/**
 * Totale demo Kanora (Fase 3, idempotentes por código): 3 tareas en
 * backlog/pendiente/en curso + 1 incidencia vinculada a PANT-02,
 * con criterios de aceptación y dependencias (blocks) alineadas al mockup.
 */
async function seedDemoWork(kanora: string) {
  const taskStates = await sql<{ id: string; key: string }[]>`
    SELECT id, key FROM workflow_states WHERE product_id = ${kanora} AND scope = 'task'`;
  const issueStates = await sql<{ id: string; key: string }[]>`
    SELECT id, key FROM workflow_states WHERE product_id = ${kanora} AND scope = 'issue'`;
  const stateId = (rows: Array<{ id: string; key: string }>, key: string) =>
    rows.find((r) => r.key === key)?.id;
  const taskState = (key: string) => stateId(taskStates, key);
  const issueState = (key: string) => stateId(issueStates, key);

  const demoTasks = [
    {
      code: 'TAR-231',
      title: 'Implementar asignación de pedidos a ruta óptima',
      description:
        'Consolidar pedidos en rutas óptimas minimizando kilómetros y ventanas de entrega.',
      type: 'development',
      state: 'in_progress',
      priority: 'high',
      acceptanceCriteria: [
        { text: 'Visualizar variantes sin reordenar filas', done: true },
        { text: 'Guardar cambios con concurrencia optimista (409)', done: false },
      ],
      nodes: ['PANT-02'],
    },
    {
      code: 'TAR-232',
      title: 'Ajustar selector de variante en ficha',
      description: 'Mejorar accesibilidad del selector y estados de carga.',
      type: 'development',
      state: 'todo',
      priority: 'medium',
      acceptanceCriteria: [{ text: 'Selector accesible por teclado', done: false }],
      nodes: ['PANT-02', 'COMP-01'],
    },
    {
      code: 'TAR-240',
      title: 'Bloqueada: timbrado CFDI depende de SVC-02',
      description: 'No puede avanzar hasta que el servicio de timbrado responda.',
      type: 'development',
      state: 'in_progress',
      priority: 'critical',
      acceptanceCriteria: [{ text: 'Integración con SVC-02 verificada', done: false }],
      nodes: ['PANT-04'],
    },
  ] as const;

  const taskIds = new Map<string, string>();
  for (const t of demoTasks) {
    const [existing] = await sql<{ id: string }[]>`
      SELECT id FROM tasks WHERE product_id = ${kanora} AND code = ${t.code} LIMIT 1`;
    if (existing) {
      taskIds.set(t.code, existing.id);
      continue;
    }
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO tasks (product_id, code, title, description, type, state_id, priority, acceptance_criteria)
      VALUES (${kanora}, ${t.code}, ${t.title}, ${t.description}, ${t.type}, ${taskState(t.state) ?? null}, ${t.priority}, ${sql.json(t.acceptanceCriteria)})
      RETURNING id`;
    if (row) {
      taskIds.set(t.code, row.id);
      for (const nodeCode of t.nodes) {
        await sql`INSERT INTO relations (product_id, source_kind, source_id, target_kind, target_id, relation_type, metadata)
                  SELECT ${kanora}, 'task', ${row.id}, 'node', n.id, 'affects', '{}'::jsonb
                  FROM product_nodes n
                  WHERE n.product_id = ${kanora} AND n.code = ${nodeCode} AND n.deleted_at IS NULL
                  ON CONFLICT DO NOTHING`;
      }
    }
  }
  // TAR-240 is_blocked_by TAR-231 (ejemplo de dependencia).
  const tar231 = taskIds.get('TAR-231');
  const tar240 = taskIds.get('TAR-240');
  if (tar231 && tar240) {
    await sql`INSERT INTO relations (product_id, source_kind, source_id, target_kind, target_id, relation_type, metadata)
              VALUES (${kanora}, 'task', ${tar240}, 'task', ${tar231}, 'is_blocked_by', '{}'::jsonb)
              ON CONFLICT DO NOTHING`;
  }

  const [existingIssue] = await sql<{ id: string }[]>`
    SELECT id FROM issues WHERE product_id = ${kanora} AND code = 'INC-087' LIMIT 1`;
  if (!existingIssue) {
    const [issue] = await sql<{ id: string }[]>`
      INSERT INTO issues (product_id, code, title, description, expected_behavior, observed_behavior, reproduction_steps, severity, priority, state_id)
      VALUES (${kanora}, 'INC-087', 'Ficha no muestra variantes tras guardar',
              'Al guardar la ficha, las variantes no se refrescan sin F5.',
              'Al guardar, ver variantes actualizadas',
              'Las variantes quedan obsoletas hasta recargar',
              ${sql.json(['1. Abrir PANT-02', '2. Editar variante', '3. Guardar', '4. Observar lista obsoleta'])},
              'high', 'high', ${issueState('open') ?? null})
      RETURNING id`;
    if (issue) {
      await sql`INSERT INTO relations (product_id, source_kind, source_id, target_kind, target_id, relation_type, metadata)
                SELECT ${kanora}, 'issue', ${issue.id}, 'node', n.id, 'affects', '{}'::jsonb
                FROM product_nodes n
                WHERE n.product_id = ${kanora} AND n.code = 'PANT-02' AND n.deleted_at IS NULL
                ON CONFLICT DO NOTHING`;
      if (tar231) {
        await sql`INSERT INTO relations (product_id, source_kind, source_id, target_kind, target_id, relation_type, metadata)
                  VALUES (${kanora}, 'issue', ${issue.id}, 'task', ${tar231}, 'relates_to', ${sql.json({ note: 'tarea correctiva' })}::jsonb)
                  ON CONFLICT DO NOTHING`;
      }
      console.info('Trabajo demo OK (TAR-231 · TAR-232 · TAR-240 + INC-087 en kanora).');
    }
  }
}

/**
 * Trazabilidad demo Kanora (Fase 4, idempotentes por código):
 * MOD-031 propuesta (Reasignación limitada a 2 intentos — RN-014) vinculada a
 * TAR-231 (implements) + INC-087 (resolves) + PANT-02 (affects), más
 * MOD-030 ejecutada con git a3f9c21, TC-014 con resultado passed y
 * relaciones de regla/dependencia para las 7 consultas.
 */
async function seedDemoTrace(kanora: string) {
  const [pant02] = await sql<{ id: string }[]>`
    SELECT id FROM product_nodes WHERE product_id = ${kanora} AND code = 'PANT-02' AND deleted_at IS NULL LIMIT 1`;
  const [comp01] = await sql<{ id: string }[]>`
    SELECT id FROM product_nodes WHERE product_id = ${kanora} AND code = 'COMP-01' AND deleted_at IS NULL LIMIT 1`;
  const [tar231] = await sql<{ id: string }[]>`
    SELECT id FROM tasks WHERE product_id = ${kanora} AND code = 'TAR-231' AND deleted_at IS NULL LIMIT 1`;
  const [tar232] = await sql<{ id: string }[]>`
    SELECT id FROM tasks WHERE product_id = ${kanora} AND code = 'TAR-232' AND deleted_at IS NULL LIMIT 1`;
  const [inc087] = await sql<{ id: string }[]>`
    SELECT id FROM issues WHERE product_id = ${kanora} AND code = 'INC-087' AND deleted_at IS NULL LIMIT 1`;
  const [doc118] = await sql<{ id: string }[]>`
    SELECT id FROM content_items WHERE product_id = ${kanora} AND code = 'DOC-118' AND deleted_at IS NULL LIMIT 1`;
  const [doc124] = await sql<{ id: string }[]>`
    SELECT id FROM content_items WHERE product_id = ${kanora} AND code = 'DOC-124' AND deleted_at IS NULL LIMIT 1`;

  const demoChanges = [
    {
      code: 'MOD-031',
      title: 'Reasignación limitada a 2 intentos (RN-014) en capa de dominio',
      description: 'Bloquea cualquier reasignación que supere 2 intentos por pedido.',
      kind: 'functional',
      status: 'proposed',
      gitSha: null as string | null,
    },
    {
      code: 'MOD-030',
      title: 'Virtualización de tabla de pedidos con react-virtuoso',
      description: 'Tabla virtualizada para >500 registros sin reordenar filas.',
      kind: 'technical',
      status: 'executed',
      gitSha: 'a3f9c21',
    },
  ] as const;

  const changeIds = new Map<string, string>();
  for (const c of demoChanges) {
    const [existing] = await sql<{ id: string }[]>`
      SELECT id FROM changes WHERE product_id = ${kanora} AND code = ${c.code} LIMIT 1`;
    if (existing) {
      changeIds.set(c.code, existing.id);
      continue;
    }
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO changes (product_id, code, title, description, kind, status, git_sha, executed_at)
      VALUES (${kanora}, ${c.code}, ${c.title}, ${c.description}, ${c.kind}, ${c.status}, ${c.gitSha},
              ${c.status === 'executed' ? new Date() : null})
      RETURNING id`;
    if (row) changeIds.set(c.code, row.id);
  }

  const mod031 = changeIds.get('MOD-031');
  const mod030 = changeIds.get('MOD-030');
  if (mod031 && pant02) {
    await sql`INSERT INTO relations (product_id, source_kind, source_id, target_kind, target_id, relation_type, metadata)
              VALUES (${kanora}, 'change', ${mod031}, 'node', ${pant02.id}, 'affects', '{}'::jsonb)
              ON CONFLICT DO NOTHING`;
  }
  if (mod031 && tar231) {
    await sql`INSERT INTO relations (product_id, source_kind, source_id, target_kind, target_id, relation_type, metadata)
              VALUES (${kanora}, 'change', ${mod031}, 'task', ${tar231.id}, 'implements', '{}'::jsonb)
              ON CONFLICT DO NOTHING`;
  }
  if (mod031 && inc087) {
    await sql`INSERT INTO relations (product_id, source_kind, source_id, target_kind, target_id, relation_type, metadata)
              VALUES (${kanora}, 'change', ${mod031}, 'issue', ${inc087.id}, 'resolves', '{}'::jsonb)
              ON CONFLICT DO NOTHING`;
  }
  if (mod030 && comp01) {
    await sql`INSERT INTO relations (product_id, source_kind, source_id, target_kind, target_id, relation_type, metadata)
              VALUES (${kanora}, 'change', ${mod030}, 'node', ${comp01.id}, 'affects', '{}'::jsonb)
              ON CONFLICT DO NOTHING`;
  }
  if (mod030 && tar232) {
    await sql`INSERT INTO relations (product_id, source_kind, source_id, target_kind, target_id, relation_type, metadata)
              VALUES (${kanora}, 'change', ${mod030}, 'task', ${tar232.id}, 'implements', '{}'::jsonb)
              ON CONFLICT DO NOTHING`;
  }
  // Regla DOC-124 (RN-014) aplicada en PANT-02 (Q2) y dependencia COMP-01→PANT-02 (Q7).
  if (doc124 && pant02) {
    await sql`INSERT INTO relations (product_id, source_kind, source_id, target_kind, target_id, relation_type, metadata)
              VALUES (${kanora}, 'item', ${doc124.id}, 'node', ${pant02.id}, 'applies_rule', '{}'::jsonb)
              ON CONFLICT DO NOTHING`;
  }
  if (comp01 && pant02) {
    await sql`INSERT INTO relations (product_id, source_kind, source_id, target_kind, target_id, relation_type, metadata)
              VALUES (${kanora}, 'node', ${comp01.id}, 'node', ${pant02.id}, 'depends_on', '{}'::jsonb)
              ON CONFLICT DO NOTHING`;
  }

  const [existingCase] = await sql<{ id: string }[]>`
    SELECT id FROM test_cases WHERE product_id = ${kanora} AND code = 'TC-014' LIMIT 1`;
  let tcId = existingCase?.id ?? null;
  if (!existingCase) {
    const [created] = await sql<{ id: string }[]>`
      INSERT INTO test_cases (product_id, code, title, type, status)
      VALUES (${kanora}, 'TC-014', 'E2E asignación → factura (caso DOC-118)', 'e2e', 'active')
      RETURNING id`;
    tcId = created?.id ?? null;
    if (created && doc118) {
      await sql`INSERT INTO relations (product_id, source_kind, source_id, target_kind, target_id, relation_type, metadata)
                VALUES (${kanora}, 'test_case', ${created.id}, 'item', ${doc118.id}, 'verifies', '{}'::jsonb)
                ON CONFLICT DO NOTHING`;
    }
    if (created) {
      await sql`INSERT INTO test_results (test_case_id, product_id, status, environment, notes, executed_by_kind)
                VALUES (${created.id}, ${kanora}, 'passed', 'staging', '12/12 OK — reasignación con límite RN-014', 'human')`;
    }
  }
  if (tcId) console.info('Trazabilidad demo OK (MOD-030 · MOD-031 + TC-014 en kanora).');
}

async function main() {
  try {
    await seedCatalogs();
    if (demo) await seedDemo();
  } finally {
    await sql.end();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
