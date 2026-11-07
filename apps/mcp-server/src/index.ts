#!/usr/bin/env node
/**
 * Entrada stdio del servidor MCP (Fase 6b · F6b-T01).
 *
 * - `devcycle-mcp --token dvc_… --product kanora` (invocado por
 *   `claude mcp add` como subproceso stdio).
 * - stdout = protocolo MCP (JSON-RPC); logs = stderr. El token nunca se
 *   imprime.
 * - Sin dependencia de BD: todo va por la API de integración
 *   (`/integration/*`, Bearer `dvc_…`).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logError, logInfo } from './api-client.js';
import { DevcycleApiClient } from './api-client.js';
import { parseArgs, printHelp } from './config.js';
import { registerPrompts } from './prompts.js';
import { registerResources } from './resources.js';
import { registerTools } from './tools.js';

async function main(): Promise<void> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (cause) {
    logError(cause instanceof Error ? cause.message : String(cause));
    logError('Uso: devcycle-mcp --token dvc_… [--product kanora] [--api-base <url>]');
    process.exit(1);
  }

  if (parsed.help) {
    printHelp();
    return;
  }

  const config = parsed.config;
  if (!config) {
    logError('Configuración incompleta.');
    process.exit(1);
  }

  const client = new DevcycleApiClient(config.apiBase, config.token);

  const server = new McpServer(
    { name: 'devcycle-mcp', version: '0.1.0' },
    {
      instructions:
        'Servidor MCP read-only de DevCycle. Empieza con `get_product_context` del ' +
        'nodo en curso. Las tools respetan scopes y tenant-escape de la API; ' +
        'las llamadas quedan auditadas como AGENTE IA.',
    },
  );

  registerTools(server, client, config);
  registerResources(server, client, config);
  registerPrompts(server, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logInfo(
    `listo — producto por defecto: ${config.productSlug ?? '(sin defecto)'} · API: ${config.apiBase}`,
  );

  const shutdown = async (): Promise<void> => {
    try {
      await server.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main().catch((cause: unknown) => {
  logError(cause instanceof Error ? (cause.stack ?? cause.message) : String(cause));
  process.exit(1);
});
