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

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL no definida');
  process.exit(1);
}
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
      INSERT INTO product_nodes (product_id, parent_id, node_type_id, code, name, path, depth, position)
      VALUES (${productId}, ${parentId}, ${type!.id}, ${node.code}, ${node.name}, ${path}::ltree, ${depth}, ${position})
      ON CONFLICT DO NOTHING
      RETURNING id`;
    position += 1;
    if (row && node.children?.length) {
      await insertTree(productId, node.children, row.id, path, depth + 1);
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
        children: [
          { code: 'PANT-01', name: 'Listado de productos', typeKey: 'pantalla' },
          {
            code: 'PANT-02',
            name: 'Ficha de producto',
            typeKey: 'pantalla',
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
      INSERT INTO content_items (product_id, doc_type_id, code, title, body_markdown, status, version)
      VALUES (${kanora}, ${type!.id}, ${doc.code}, ${doc.title}, ${doc.body}, ${doc.status}, ${doc.version})
      ON CONFLICT DO NOTHING
      RETURNING id`;
    if (!item) continue;
    for (let i = 0; i < doc.snapshots.length; i++) {
      await sql`INSERT INTO item_versions (item_id, version, title, body_markdown, change_note)
                VALUES (${item.id}, ${i + 1}, ${doc.title}, ${doc.snapshots[i]!}, ${i === 0 ? 'Seed demo' : 'Publicación demo'})
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
