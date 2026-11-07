/**
 * Configuración del servidor MCP (Fase 6b).
 *
 * Fuentes (CLI gana a env):
 *   --token / DEVCYCLE_TOKEN          token de servicio `dvc_…` (obligatorio)
 *   --product / DEVCYCLE_PRODUCT      slug por defecto (ej. `kanora`)
 *   --api-base / DEVCYCLE_API_BASE    base de la API (def. http://localhost:3001/api/v1)
 *
 * El token va al servidor por arg/env del proceso MCP y **nunca** se loguea
 * (stdout es el canal stdio MCP: solo JSON-RPC tras arrancar).
 */

export interface McpConfig {
  token: string;
  productSlug: string | null;
  apiBase: string;
}

export const DEFAULT_API_BASE = 'http://localhost:3001/api/v1';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const v of values) {
    const trimmed = v?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function parseArgs(argv: string[]): { help: boolean; config: McpConfig | null } {
  let token: string | undefined;
  let product: string | undefined;
  let apiBase: string | undefined;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--token') {
      token = argv[++i];
    } else if (arg === '--product') {
      product = argv[++i];
    } else if (arg === '--api-base') {
      apiBase = argv[++i];
    } else if (arg?.startsWith('--token=')) {
      token = arg.slice('--token='.length);
    } else if (arg?.startsWith('--product=')) {
      product = arg.slice('--product='.length);
    } else if (arg?.startsWith('--api-base=')) {
      apiBase = arg.slice('--api-base='.length);
    } else if (arg !== undefined && !arg.startsWith('--')) {
      throw new Error(`Argumento no reconocido: ${arg} (usa --help)`);
    } else if (arg !== undefined) {
      throw new Error(`Argumento no reconocido: ${arg} (usa --help)`);
    }
  }

  if (help) return { help: true, config: null };

  const resolvedToken = firstNonEmpty(token, process.env['DEVCYCLE_TOKEN']);
  const resolvedProduct = firstNonEmpty(product, process.env['DEVCYCLE_PRODUCT']);
  const resolvedBase = firstNonEmpty(apiBase, process.env['DEVCYCLE_API_BASE']) ?? DEFAULT_API_BASE;

  if (!resolvedToken) {
    throw new Error(
      'Falta el token de servicio. Crea uno en la UI (Integraciones y agentes) y arranca con ' +
        '`devcycle-mcp --token dvc_… --product kanora`.',
    );
  }
  if (!resolvedToken.startsWith('dvc_')) {
    throw new Error('El token debe empezar por `dvc_` (formato de token de servicio de DevCycle).');
  }
  if (resolvedProduct && !SLUG_RE.test(resolvedProduct)) {
    throw new Error(
      `Slug de producto no válido: '${resolvedProduct}' (minúsculas, dígitos y guiones).`,
    );
  }

  return {
    help: false,
    config: {
      token: resolvedToken,
      productSlug: resolvedProduct ?? null,
      apiBase: resolvedBase.replace(/\/+$/, ''),
    },
  };
}

export function printHelp(): void {
  // Salida previa al arranque del transporte stdio: puede ir a stdout.
  // eslint-disable-next-line no-console
  console.log(`devcycle-mcp — servidor MCP read-only de DevCycle (Fase 6b)

Uso:
  devcycle-mcp --token dvc_… [--product kanora] [--api-base <url>]

Opciones:
  --token <dvc_…>       Token de servicio read-only (también: DEVCYCLE_TOKEN)
  --product <slug>      Producto por defecto (también: DEVCYCLE_PRODUCT)
  --api-base <url>      Base de la API de integración (también: DEVCYCLE_API_BASE)
                        Defecto: ${DEFAULT_API_BASE}
  --help, -h            Muestra esta ayuda

El servidor habla MCP por stdio: stdout es JSON-RPC, los logs van a stderr.
Nunca accede a PostgreSQL ni imprime el token.
`);
}
