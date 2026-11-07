# `@devcycle/mcp-server` — Servidor MCP de DevCycle (Fase 6b)

Servidor **MCP read-only** para agentes externos (Claude Code, Cursor, OpenCode…).
Traduce tools/resources/prompts MCP a la API de integración (`/integration/*`).
Nunca accede a PostgreSQL y nunca contiene lógica de dominio.

## Uso

```bash
pnpm --filter @devcycle/mcp-server build
npx devcycle-mcp --token dvc_… --product kanora
```

`--token` / `DEVCYCLE_TOKEN` (obligatorio), `--product` / `DEVCYCLE_PRODUCT`
(slug por defecto), `--api-base` / `DEVCYCLE_API_BASE` (defecto
`http://localhost:3001/api/v1`). `--help` muestra la ayuda.

Con Claude Code:

```bash
claude mcp add --scope project devcycle -- devcycle-mcp --token dvc_… --product kanora
claude mcp list   # devcycle debe listar como conectado
```

Detalle paso a paso en [`docs/agentes/conectar-claude-code.md`](../../docs/agentes/conectar-claude-code.md).

## Qué expone (v1, solo lectura)

- **23 tools** (`readOnlyHint=true`): `list_products`, `get_product`,
  `get_product_structure`, `get_node`, `search_product_knowledge`,
  `get_product_context`, `list_documents`, `search_documents`,
  `get_document`, `get_document_history`, `list_tasks`, `get_task`,
  `list_issues`, `get_issue`, `get_node_history`, `get_node_relations`,
  `get_task_relations`, `get_dependencies`, `list_changes`, `get_change`,
  `list_test_cases`, `get_test_case`, `get_product_overview`.
- **11 recursos** `devcycle://{producto}/…` (`products`, `structure`, nodos y
  su `context`/`documents`/`rules`/`decisions`/`api-contracts`, documentos,
  tareas y `changes`).
- **4 prompts**: `analyze-screen-before-change`, `prepare-implementation`,
  `analyze-issue`, `verify-acceptance-criteria`.
- Presupuesto de **32 KB** por llamada: el canal de texto trunca y omite
  `structuredContent` cuando trunca (`06 §6`).
- Errores `problem+json` de la API → `Unauthorized` / `Forbidden` /
  `NotFound` / `Conflict` / `InvalidParams` del protocolo MCP.

## Seguridad

- Auth por **Bearer `dvc_…`** con scope `read:*` y tenant-escape por producto
  (el token no lee otros productos: `403`).
- Cada llamada queda auditada en `agent_executions` + `activity_log` como
  AGENTE IA (vía la API, sin duplicar auditoría aquí).
- **Escrituras fuera de v1**: `write:*`, `register_change`/`resolve_issue` y
  confirmación llegan en Fase 6c. Ningún token puede auto-otorgarse
  `agent:confirm`.

## Tests

```bash
pnpm --filter @devcycle/mcp-server test   # unitarios (sin API en vivo)
DEVCYCLE_TOKEN=dvc_… node scripts/test-stdio.cjs --product kanora
```

`scripts/test-stdio.cjs` es el cliente de prueba F6b-T06: levanta el servidor
stdio y ejercita `initialize` + `tools/list` + `get_product_context` +
`search_product_knowledge` + `resources/list` + `prompts/list`.
