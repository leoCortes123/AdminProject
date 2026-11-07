/**
 * Recursos MCP (Fase 6b · F6b-T03 / 06 §4).
 *
 * Formato estable: `devcycle://{productSlug}/{recurso}[/{id}]`.
 * Los clientes los leen con `resources/list` + `resources/read`
 * (JSON, `mimeType: application/json`). Cambiar el esquema exige nuevo
 * prefijo `devcycle2://` (contrato estable).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DevcycleApiClient, truncateJson } from './api-client.js';
import type { McpConfig } from './config.js';

export const RESOURCE_PATTERNS = [
  'devcycle://{productSlug}/products',
  'devcycle://{productSlug}/structure',
  'devcycle://{productSlug}/nodes/{nodeCode}',
  'devcycle://{productSlug}/nodes/{nodeCode}/context',
  'devcycle://{productSlug}/nodes/{nodeCode}/documents',
  'devcycle://{productSlug}/nodes/{nodeCode}/rules',
  'devcycle://{productSlug}/nodes/{nodeCode}/decisions',
  'devcycle://{productSlug}/nodes/{nodeCode}/api-contracts',
  'devcycle://{productSlug}/documents/{documentCode}',
  'devcycle://{productSlug}/tasks/{taskCode}',
  'devcycle://{productSlug}/changes',
] as const;

const JSON_MIME = 'application/json';

function jsonContents(
  uri: URL,
  value: unknown,
): Array<{ uri: string; mimeType: string; text: string }> {
  const { text } = truncateJson(value);
  return [{ uri: uri.href, mimeType: JSON_MIME, text }];
}

function resourceEntry(
  uri: string,
  name: string,
  description: string,
): {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
} {
  return { uri, name, description, mimeType: JSON_MIME };
}

export function registerResources(
  server: McpServer,
  client: DevcycleApiClient,
  config: McpConfig,
): void {
  // Los list callbacks enumeran para el producto por defecto (o para el que
  // pida el cliente si lo pasa en el template). Best-effort: ante error se
  // devuelve [] (el read seguirá dando el error tipado de la API).
  const slugOf = (params: Record<string, string | string[]>, fallback?: string): string | null => {
    const fromParam = params['productSlug'];
    if (typeof fromParam === 'string' && fromParam) return fromParam;
    return fallback ?? config.productSlug ?? null;
  };

  // devcycle://{productSlug}/products — catálogo de productos visibles.
  server.registerResource(
    'products-catalog',
    new ResourceTemplate(RESOURCE_PATTERNS[0], {
      list: async () => {
        const slug = config.productSlug;
        if (!slug) return { resources: [] };
        return {
          resources: [
            resourceEntry(
              `devcycle://${slug}/products`,
              'products-catalog',
              'Catálogo de productos visibles para el token',
            ),
          ],
        };
      },
    }),
    {
      title: 'Catálogo de productos',
      description: 'Productos visibles para el token',
      mimeType: JSON_MIME,
    },
    async (uri) => {
      return { contents: jsonContents(uri, await client.get('/integration/products')) };
    },
  );

  // devcycle://{productSlug}/structure — árbol funcional plano.
  server.registerResource(
    'product-structure',
    new ResourceTemplate(RESOURCE_PATTERNS[1], {
      list: async () => {
        const slug = config.productSlug;
        if (!slug) return { resources: [] };
        return {
          resources: [
            resourceEntry(
              `devcycle://${slug}/structure`,
              'product-structure',
              'Árbol funcional del producto (plano, ordenado por path)',
            ),
          ],
        };
      },
    }),
    {
      title: 'Estructura del producto',
      description: 'Árbol funcional del producto',
      mimeType: JSON_MIME,
    },
    async (uri, params) => {
      const slug = slugOf(params);
      if (!slug) throw new Error('Falta {productSlug} en la URI del recurso.');
      return {
        contents: jsonContents(uri, await client.get(`/integration/products/${slug}/structure`)),
      };
    },
  );

  // devcycle://{productSlug}/nodes/{nodeCode} — nodo = get_node.
  server.registerResource(
    'node',
    new ResourceTemplate(RESOURCE_PATTERNS[2], {
      list: async () => {
        const slug = config.productSlug;
        if (!slug) return { resources: [] };
        try {
          const nodes = await client.get<Array<{ code: string }>>(
            `/integration/products/${slug}/structure`,
          );
          return {
            resources: (Array.isArray(nodes) ? nodes : []).map((n) =>
              resourceEntry(`devcycle://${slug}/nodes/${n.code}`, 'node', `Nodo ${n.code}`),
            ),
          };
        } catch {
          return { resources: [] };
        }
      },
    }),
    {
      title: 'Nodo',
      description: 'Nodo del árbol con tipo y ficha funcional',
      mimeType: JSON_MIME,
    },
    async (uri, params) => {
      const slug = slugOf(params);
      const nodeCode = params['nodeCode'];
      if (!slug || typeof nodeCode !== 'string') {
        throw new Error('Faltan {productSlug}/{nodeCode} en la URI del recurso.');
      }
      return {
        contents: jsonContents(
          uri,
          await client.get(`/integration/products/${slug}/nodes/${encodeURIComponent(nodeCode)}`),
        ),
      };
    },
  );

  // devcycle://{productSlug}/nodes/{nodeCode}/context — get_product_context.
  server.registerResource(
    'node-context',
    new ResourceTemplate(RESOURCE_PATTERNS[3], {
      list: async () => {
        const slug = config.productSlug;
        if (!slug) return { resources: [] };
        try {
          const nodes = await client.get<Array<{ code: string }>>(
            `/integration/products/${slug}/structure`,
          );
          return {
            resources: (Array.isArray(nodes) ? nodes : []).map((n) =>
              resourceEntry(
                `devcycle://${slug}/nodes/${n.code}/context`,
                'node-context',
                `Contexto completo del nodo ${n.code}`,
              ),
            ),
          };
        } catch {
          return { resources: [] };
        }
      },
    }),
    {
      title: 'Contexto del nodo',
      description: 'Contexto completo para el agente (06 §6)',
      mimeType: JSON_MIME,
    },
    async (uri, params) => {
      const slug = slugOf(params);
      const nodeCode = params['nodeCode'];
      if (!slug || typeof nodeCode !== 'string') {
        throw new Error('Faltan {productSlug}/{nodeCode} en la URI del recurso.');
      }
      return {
        contents: jsonContents(
          uri,
          await client.get(
            `/integration/products/${slug}/nodes/${encodeURIComponent(nodeCode)}/context`,
          ),
        ),
      };
    },
  );

  // devcycle://{productSlug}/nodes/{nodeCode}/documents|rules|decisions|api-contracts
  const patternAt = (index: number): string => {
    const pattern = RESOURCE_PATTERNS[index];
    if (!pattern) throw new Error(`Patrón de recurso inválido: ${index}`);
    return pattern;
  };

  const nodeDocsTemplate = (
    name: string,
    patternIndex: number,
    title: string,
    description: string,
    docTypeKey: string | null,
  ): void => {
    server.registerResource(
      name,
      new ResourceTemplate(patternAt(patternIndex), {
        list: async () => {
          const slug = config.productSlug;
          if (!slug) return { resources: [] };
          try {
            const nodes = await client.get<Array<{ code: string }>>(
              `/integration/products/${slug}/structure`,
            );
            const tail = patternAt(patternIndex)
              .replace('devcycle://{productSlug}/nodes/{nodeCode}', '')
              .replace('{productSlug}', slug);
            return {
              resources: (Array.isArray(nodes) ? nodes : []).map((n) =>
                resourceEntry(`devcycle://${slug}/nodes/${n.code}${tail}`, name, description),
              ),
            };
          } catch {
            return { resources: [] };
          }
        },
      }),
      { title, description, mimeType: JSON_MIME },
      async (uri, params) => {
        const slug = slugOf(params);
        const nodeCode = params['nodeCode'];
        if (!slug || typeof nodeCode !== 'string') {
          throw new Error('Faltan {productSlug}/{nodeCode} en la URI del recurso.');
        }
        const query: Record<string, string> = { nodeCode };
        if (docTypeKey) query['docTypeKey'] = docTypeKey;
        return {
          contents: jsonContents(
            uri,
            await client.get(`/integration/products/${slug}/documents`, query),
          ),
        };
      },
    );
  };

  nodeDocsTemplate(
    'node-documents',
    4,
    'Documentos del nodo',
    'Documentos vinculados al nodo',
    null,
  );
  nodeDocsTemplate(
    'node-rules',
    5,
    'Reglas del nodo',
    'Reglas de negocio aplicables al nodo',
    'business_rule',
  );
  nodeDocsTemplate(
    'node-decisions',
    6,
    'Decisiones del nodo',
    'ADRs relacionadas con el nodo',
    'adr',
  );
  nodeDocsTemplate(
    'node-api-contracts',
    7,
    'Contratos API del nodo',
    'Contratos API vinculados al nodo',
    'api_contract',
  );

  // devcycle://{productSlug}/documents/{documentCode} — get_document (JSON con bodyMarkdown).
  server.registerResource(
    'document',
    new ResourceTemplate(RESOURCE_PATTERNS[8], {
      list: async () => {
        const slug = config.productSlug;
        if (!slug) return { resources: [] };
        try {
          const docs = await client.get<Array<{ code: string | null }>>(
            `/integration/products/${slug}/documents`,
          );
          return {
            resources: (Array.isArray(docs) ? docs : [])
              .filter((d) => d.code)
              .map((d) =>
                resourceEntry(
                  `devcycle://${slug}/documents/${d.code}`,
                  'document',
                  `Documento ${d.code}`,
                ),
              ),
          };
        } catch {
          return { resources: [] };
        }
      },
    }),
    { title: 'Documento', description: 'Documento Markdown con metadatos', mimeType: JSON_MIME },
    async (uri, params) => {
      const slug = slugOf(params);
      const documentCode = params['documentCode'];
      if (!slug || typeof documentCode !== 'string') {
        throw new Error('Faltan {productSlug}/{documentCode} en la URI del recurso.');
      }
      return {
        contents: jsonContents(
          uri,
          await client.get(
            `/integration/products/${slug}/documents/${encodeURIComponent(documentCode)}`,
          ),
        ),
      };
    },
  );

  // devcycle://{productSlug}/tasks/{taskCode} — get_task.
  server.registerResource(
    'task',
    new ResourceTemplate(RESOURCE_PATTERNS[9], {
      list: async () => {
        const slug = config.productSlug;
        if (!slug) return { resources: [] };
        try {
          const tasks = await client.get<Array<{ code: string | null }>>(
            `/integration/products/${slug}/tasks`,
          );
          return {
            resources: (Array.isArray(tasks) ? tasks : [])
              .filter((t) => t.code)
              .map((t) =>
                resourceEntry(`devcycle://${slug}/tasks/${t.code}`, 'task', `Tarea ${t.code}`),
              ),
          };
        } catch {
          return { resources: [] };
        }
      },
    }),
    {
      title: 'Tarea',
      description: 'Ficha de tarea con criterios y relaciones',
      mimeType: JSON_MIME,
    },
    async (uri, params) => {
      const slug = slugOf(params);
      const taskCode = params['taskCode'];
      if (!slug || typeof taskCode !== 'string') {
        throw new Error('Faltan {productSlug}/{taskCode} en la URI del recurso.');
      }
      return {
        contents: jsonContents(
          uri,
          await client.get(`/integration/products/${slug}/tasks/${encodeURIComponent(taskCode)}`),
        ),
      };
    },
  );

  // devcycle://{productSlug}/changes — historial de modificaciones reciente.
  server.registerResource(
    'changes',
    new ResourceTemplate(RESOURCE_PATTERNS[10], {
      list: async () => {
        const slug = config.productSlug;
        if (!slug) return { resources: [] };
        return {
          resources: [
            resourceEntry(
              `devcycle://${slug}/changes`,
              'changes',
              'Historial de modificaciones reciente',
            ),
          ],
        };
      },
    }),
    {
      title: 'Modificaciones',
      description: 'Historial de modificaciones reciente',
      mimeType: JSON_MIME,
    },
    async (uri, params) => {
      const slug = slugOf(params);
      if (!slug) throw new Error('Falta {productSlug} en la URI del recurso.');
      return {
        contents: jsonContents(uri, await client.get(`/integration/products/${slug}/changes`)),
      };
    },
  );
}
