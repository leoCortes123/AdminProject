/**
 * Prompts reutilizables (Fase 6b · F6b-T04 / 06 §5).
 *
 * Los prompts son plantillas: no consultan la API; devuelven el flujo que
 * debe ejecutar el agente con las tools existentes.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpConfig } from './config.js';

const productArg = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .optional()
  .describe('Slug del producto. Por defecto, el de arranque del servidor.');
const codeArg = z.string().trim().min(1).max(64);

function promptMessage(text: string): {
  messages: Array<{
    role: 'user' | 'assistant';
    content: { type: 'text'; text: string };
  }>;
} {
  return { messages: [{ role: 'user', content: { type: 'text', text } }] };
}

export function registerPrompts(server: McpServer, config: McpConfig): void {
  server.registerPrompt(
    'analyze-screen-before-change',
    {
      title: 'Analizar pantalla antes de cambiarla',
      description:
        'Resume qué es el nodo, qué reglas, casos de uso, documentos y pruebas tiene, ' +
        'y qué puede romperse al modificarlo.',
      argsSchema: { productSlug: productArg, nodeCode: codeArg },
    },
    async ({ productSlug, nodeCode }) => {
      const slug = productSlug ?? config.productSlug ?? '<productSlug>';
      return promptMessage(
        `Antes de cambiar la pantalla \`${nodeCode}\` del producto \`${slug}\`, analízala con DevCycle:\n` +
          `1. Llama a \`get_product_context\` con { productSlug: "${slug}", nodeCode: "${nodeCode}" } (secciones por defecto).\n` +
          `2. Resume objetivo, descripción, reglas, casos de uso, tareas pendientes, incidencias abiertas y dependencias.\n` +
          `3. Indica qué puede romperse (relaciones, incidencias vinculadas y modificaciones recientes con \`get_node_history\` / \`get_node_relations\`).\n` +
          `4. No modifiques nada: esta fase es solo lectura (MCP v1).`,
      );
    },
  );

  server.registerPrompt(
    'prepare-implementation',
    {
      title: 'Preparar la implementación de una tarea',
      description:
        'Contexto + criterios de aceptación + incidencias conocidas para implementar una tarea.',
      argsSchema: { productSlug: productArg, taskCode: codeArg },
    },
    async ({ productSlug, taskCode }) => {
      const slug = productSlug ?? config.productSlug ?? '<productSlug>';
      return promptMessage(
        `Prepara la implementación de la tarea \`${taskCode}\` en \`${slug}\`:\n` +
          `1. Lee la tarea con \`get_task\` (descripción, criterios, nodos y dependencias).\n` +
          `2. Para cada nodo vinculado, lee \`get_product_context\` (funcional, reglas y casos de uso).\n` +
          `3. Revisa incidencias conocidas con \`list_issues\` filtrando por esos nodos.\n` +
          `4. Entrega: alcance, checklist de criterios, riesgos y primer paso concreto.`,
      );
    },
  );

  server.registerPrompt(
    'analyze-issue',
    {
      title: 'Analizar una incidencia',
      description:
        'Clasifica la incidencia, busca duplicadas/relaciones y propone el siguiente paso.',
      argsSchema: { productSlug: productArg, issueCode: codeArg },
    },
    async ({ productSlug, issueCode }) => {
      const slug = productSlug ?? config.productSlug ?? '<productSlug>';
      return promptMessage(
        `Analiza la incidencia \`${issueCode}\` en \`${slug}\`:\n` +
          `1. Lee el detalle con \`get_issue\` (esperado/observado/pasos).\n` +
          `2. Busca duplicadas o relacionadas con \`search_product_knowledge\` (kinds: issue) y \`list_issues\`.\n` +
          `3. Para los nodos afectados, lee \`get_product_context\`.\n` +
          `4. Propón: causa probable, tarea correctiva y modificación que la resuelva (sin ejecutarlas: MCP v1).`,
      );
    },
  );

  server.registerPrompt(
    'verify-acceptance-criteria',
    {
      title: 'Verificar los criterios de aceptación',
      description:
        'Checklist de verificación de una tarea contra su contexto y pruebas vinculadas.',
      argsSchema: { productSlug: productArg, taskCode: codeArg },
    },
    async ({ productSlug, taskCode }) => {
      const slug = productSlug ?? config.productSlug ?? '<productSlug>';
      return promptMessage(
        `Verifica los criterios de aceptación de \`${taskCode}\` en \`${slug}\`:\n` +
          `1. Lee la tarea con \`get_task\` y lista cada criterio con su estado (done/pendiente).\n` +
          `2. Contrasta con \`get_product_context\` de los nodos vinculados y con \`list_test_cases\`.\n` +
          `3. Devuelve una tabla criterio → evidencia (código, doc o prueba) → estado, sin inventar evidencia no consultada.`,
      );
    },
  );
}
