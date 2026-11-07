#!/usr/bin/env node
/**
 * Cliente MCP de prueba (F6b-T06): levanta el servidor stdio
 * `dist/index.js` como subproceso y ejercita initialize + tools/list +
 * tools/call (get_product_context + search_product_knowledge) + resources/list
 * + prompts/list, igual que lo haría Claude Code.
 *
 * Uso:
 *   DEVCYCLE_TOKEN=dvc_… node scripts/test-stdio.cjs [--product kanora]
 *     [--api-base http://localhost:3001/api/v1] [--node PANT-02]
 *
 * Requiere: API de integración viva (`:3001`) + BD demo sembrada.
 */
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('node:path');

function arg(name, fallback) {
  const raw = process.argv.slice(2);
  const idx = raw.indexOf(name);
  if (idx >= 0 && raw[idx + 1]) return raw[idx + 1];
  const eq = raw.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  return fallback;
}

async function main() {
  const token = process.env.DEVCYCLE_TOKEN || arg('--token');
  const productSlug = arg('--product', process.env.DEVCYCLE_PRODUCT || 'kanora');
  const apiBase = arg(
    '--api-base',
    process.env.DEVCYCLE_API_BASE || 'http://localhost:3001/api/v1',
  );
  const nodeCode = arg('--node', 'PANT-02');

  if (!token) {
    throw new Error('Falta DEVCYCLE_TOKEN (token de servicio dvc_… de Integraciones y agentes).');
  }

  const serverPath = path.resolve(__dirname, '..', 'dist', 'index.js');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath, '--token', token, '--product', productSlug, '--api-base', apiBase],
    stderr: 'inherit',
  });

  const client = new Client({ name: 'devcycle-test-client', version: '0.1.0' });
  await client.connect(transport);
  console.info('MCP conectado (stdio).');

  const tools = await client.listTools();
  const toolNames = tools.tools.map((t) => t.name);
  console.info(`tools/list → ${toolNames.length} tools: ${toolNames.join(', ')}`);
  for (const expected of [
    'list_products',
    'get_product',
    'get_product_structure',
    'get_node',
    'search_product_knowledge',
    'get_product_context',
    'list_documents',
    'get_document',
    'get_node_history',
    'get_node_relations',
    'list_test_cases',
    'get_product_overview',
  ]) {
    if (!toolNames.includes(expected)) throw new Error(`Falta la tool ${expected}`);
  }
  const readOnlyViolations = tools.tools.filter(
    (t) => t.annotations && t.annotations.readOnlyHint !== true,
  );
  if (readOnlyViolations.length > 0) {
    throw new Error(
      `Tools sin readOnlyHint=true: ${readOnlyViolations.map((t) => t.name).join(', ')}`,
    );
  }

  const context = await client.callTool({
    name: 'get_product_context',
    arguments: { productSlug, nodeCode },
  });
  const contextText = context.content?.[0]?.text ?? '';
  const contextJson = JSON.parse(contextText);
  if (contextJson.target?.code !== nodeCode) {
    throw new Error(
      `get_product_context.target.code = ${contextJson.target?.code}, esperado ${nodeCode}`,
    );
  }
  console.info(
    `tools/call get_product_context ${nodeCode} → target OK (${contextText.length} bytes)`,
  );

  const search = await client.callTool({
    name: 'search_product_knowledge',
    arguments: { productSlug, query: nodeCode, kinds: 'node,document', limit: 5 },
  });
  const searchText = search.content?.[0]?.text ?? '';
  const hits = JSON.parse(searchText);
  if (!Array.isArray(hits) || hits.length === 0)
    throw new Error('search_product_knowledge sin hits');
  console.info(`tools/call search_product_knowledge "${nodeCode}" → ${hits.length} hits`);

  const resources = await client.listResources();
  console.info(`resources/list → ${resources.resources.length} URIs`);
  if (resources.resources.length === 0) throw new Error('resources/list vacío');

  const prompts = await client.listPrompts();
  const promptNames = prompts.prompts.map((p) => p.name);
  console.info(`prompts/list → ${promptNames.join(', ')}`);
  for (const expected of [
    'analyze-screen-before-change',
    'prepare-implementation',
    'analyze-issue',
    'verify-acceptance-criteria',
  ]) {
    if (!promptNames.includes(expected)) throw new Error(`Falta el prompt ${expected}`);
  }

  await client.close();
  console.info('MCP OK — flujo stdio verificado de punta a punta.');
}

main().catch((cause) => {
  console.error(
    `FALLO MCP: ${cause instanceof Error ? (cause.stack ?? cause.message) : String(cause)}`,
  );
  process.exit(1);
});
