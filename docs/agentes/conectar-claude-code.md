# Conectar Claude Code a DevCycle en 5 minutos

Guía operativa del servidor MCP read-only (Fase 6b, `apps/mcp-server`).
Todo lo que sigue es **solo lectura**: el agente consulta la arquitectura
funcional, la documentación, las tareas, las incidencias y la trazabilidad.
Las escrituras (crear tareas, proponer modificaciones…) llegan en Fase 6c.

## 0. Requisitos

- API de DevCycle viva (`:3001`, p. ej. el entorno demo de `docs/HANDOFF.md`).
- Usuario con permiso `integrations:manage` en el producto.
- Binario `devcycle-mcp` construido: `pnpm --filter @devcycle/mcp-server build`.
- Claude Code instalado (`claude` CLI).

## 1. Crea la cuenta de servicio y el token (UI, 1 minuto)

1. Entra en DevCycle → **Integraciones y agentes** del producto (p. ej. Kanora).
2. Crea una cuenta de servicio: nombre `claude-code`, tipo `claude-code` → **Crear cuenta**.
3. **Crear token read-only (30 días)** → copia el token `dvc_…` (**solo se muestra una vez**).

## 2. Conecta el servidor MCP

```bash
claude mcp add --scope project devcycle \
  -- devcycle-mcp --token dvc_… --product kanora
```

Equivalente sin Claude Code (desarrollo / otro cliente MCP):

```bash
DEVCYCLE_TOKEN=dvc_… node apps/mcp-server/dist/index.js \
  --product kanora --api-base http://localhost:3001/api/v1
```

Comprueba que el servidor responde:

```bash
claude mcp list   # devcycle debe aparecer como conectado
```

## 3. Primera consulta (agente)

Pídele al agente algo como:

> Usando DevCycle, analiza la pantalla `PANT-02` antes de cambiarla.

Flujo esperado (ver prompts del servidor: `analyze-screen-before-change`):

```text
tools/call get_product_context { productSlug: "kanora", nodeCode: "PANT-02" }
  → target + functional + documents + useCases + pendingTasks + openIssues + dependencies
tools/call search_product_knowledge { query: "PANT-02" }   (si necesitas más)
```

Prueba sin Claude Code (cliente stdio de prueba, F6b-T06):

```bash
DEVCYCLE_TOKEN=dvc_… node apps/mcp-server/scripts/test-stdio.cjs --product kanora
# MCP OK — flujo stdio verificado de punta a punta.
```

## 4. Auditoría

Cada llamada MCP queda en **Integraciones y agentes → Auditoría de agentes**
(`agent_executions` + `activity_log` con badge `AGENTE IA`, argumentos
redactados y sin secretos). La revocación del token en la UI deja de validar
la siguiente llamada (`401`).

## 5. Límites de v1

- Transporte **stdio** (v1.1 valora HTTP/SSE).
- Sin escrituras: para proponer trabajo usa la UI (Tareas / Modificaciones).
- Presupuesto de **32 KB** por respuesta (`get_product_context` trunca con
  `truncated: true`; pide `sections` para paginar el resto).
- Recursos estables `devcycle://{producto}/…` (ver `apps/mcp-server`).

## Troubleshooting

- `401` al llamar: token revocado/expirado o cuenta `disabled` → genera uno nuevo.
- `403` al pedir otro producto: el token es por producto (tenant-escape).
- `claude mcp list` sin `devcycle`: revisa `stderr` del subproceso
  (`[devcycle-mcp] …`); el token nunca sale por stdout.
