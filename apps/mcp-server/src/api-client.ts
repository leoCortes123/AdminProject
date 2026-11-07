/**
 * Cliente HTTP mínimo contra la API de integración (`/integration/*`).
 *
 * Reglas (06 §1/§8):
 * - El MCP **consume la API**; jamás toca PostgreSQL ni reproduce dominio.
 * - Auth: `Authorization: Bearer dvc_…` (el token nunca se loguea).
 * - Errores `problem+json` de la API → error MCP tipado
 *   (`Unauthorized`/`Forbidden`/`NotFound`/…).
 * - Presupuesto de salida: 32 KB por llamada (`toToolResult` trunca el
 *   canal de texto y omite `structuredContent` cuando trunca).
 */

export const TOOL_OUTPUT_MAX_BYTES = 32_000;

export type McpErrorCode =
  | 'InvalidParams'
  | 'Unauthorized'
  | 'Forbidden'
  | 'NotFound'
  | 'Conflict'
  | 'ConfirmationRequired'
  | 'Internal';

export class McpApiError extends Error {
  readonly mcpCode: McpErrorCode;
  readonly httpStatus: number;
  readonly apiCode: string | null;

  constructor(message: string, mcpCode: McpErrorCode, httpStatus: number, apiCode: string | null) {
    super(message);
    this.name = 'McpApiError';
    this.mcpCode = mcpCode;
    this.httpStatus = httpStatus;
    this.apiCode = apiCode;
  }
}

function mcpCodeForStatus(status: number): McpErrorCode {
  if (status === 400 || status === 422) return 'InvalidParams';
  if (status === 401) return 'Unauthorized';
  if (status === 403) return 'Forbidden';
  if (status === 404) return 'NotFound';
  if (status === 409) return 'Conflict';
  return 'Internal';
}

interface ProblemBody {
  code?: unknown;
  detail?: unknown;
  title?: unknown;
  status?: unknown;
}

export function parseProblem(status: number, body: unknown): McpApiError {
  const problem = (typeof body === 'object' && body !== null ? body : {}) as ProblemBody;
  const detail =
    typeof problem.detail === 'string' && problem.detail
      ? problem.detail
      : typeof problem.title === 'string' && problem.title
        ? problem.title
        : `La API respondió ${status}`;
  const apiCode = typeof problem.code === 'string' ? problem.code : null;
  return new McpApiError(detail, mcpCodeForStatus(status), status, apiCode);
}

/** Logs SIEMPRE a stderr: stdout es el canal stdio MCP (JSON-RPC). */
export function logInfo(message: string): void {
  console.info(`[devcycle-mcp] ${message}`);
}

export function logError(message: string): void {
  console.error(`[devcycle-mcp] ${message}`);
}

export class DevcycleApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  /** GET contra `/integration/*`. `path` empieza por `/integration`. */
  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (cause) {
      throw new McpApiError(
        `No se pudo contactar la API de DevCycle en ${this.baseUrl} (${cause instanceof Error ? cause.message : String(cause)})`,
        'Internal',
        0,
        null,
      );
    }

    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      throw parseProblem(res.status, body);
    }

    const body: unknown = await res.json();
    return body as T;
  }
}

/** Querystring compacta (solo claves definidas y no vacías). */
export function buildQuery(
  entries: Record<string, string | number | undefined | null>,
): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== null && value !== '') {
      out[key] = value;
    }
  }
  return out;
}

/** Result MCP con presupuesto de 32 KB (06 §6/§10). Ver `toToolResult`. */
export interface ToolResultData {
  text: string;
  truncated: boolean;
}

export function truncateJson(value: unknown, maxBytes = TOOL_OUTPUT_MAX_BYTES): ToolResultData {
  const json = JSON.stringify(value, null, 2);
  if (Buffer.byteLength(json, 'utf8') <= maxBytes) {
    return { text: json, truncated: false };
  }
  const cut = json.slice(0, maxBytes);
  return {
    text: `${cut}\n… [salida truncada a 32 KB por presupuesto MCP]`,
    truncated: true,
  };
}

/**
 * Convierte el JSON de la API en un resultado MCP:
 * - `content[0].text`: JSON legible (truncado a 32 KB si excede).
 * - `structuredContent`: el dato completo **solo si no trunca** (si trunca,
 *   se omite para no anular el presupuesto por otro canal).
 */
export function toToolResult(value: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
} {
  const { text, truncated } = truncateJson(value);
  const base = { content: [{ type: 'text' as const, text }] };
  if (truncated || typeof value !== 'object' || value === null || Array.isArray(value)) {
    return base;
  }
  return { ...base, structuredContent: value as Record<string, unknown> };
}
