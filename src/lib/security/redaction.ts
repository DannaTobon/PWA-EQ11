/**
 * Redacción de valores sensibles (Semana 09, bloque de Tonanzin).
 *
 * Módulo puro y sin dependencias: se puede importar desde cliente, servidor y pruebas
 * sin arrastrar IndexedDB ni otros módulos de la aplicación.
 *
 * Objetivo: que ningún mensaje de error, registro o reporte contenga credenciales,
 * correos, fotos en base64 ni coordenadas. Es una defensa en profundidad: la
 * validación de entrada (validation.ts) sigue siendo la primera barrera.
 *
 * Limitación: la redacción se basa en patrones y nombres de campo. No reconoce todos
 * los formatos posibles de credenciales y debe complementarse con revisión humana.
 */

export const REDACTED = "[REDACTED]";

/** Longitud máxima de un mensaje de error que se muestra o se guarda. */
export const MAX_SAFE_MESSAGE_LENGTH = 300;

const MAX_DEPTH = 6;
const MAX_KEYS = 50;

interface TextRule {
  category: string;
  pattern: RegExp;
  replace: string | ((match: string, prefix: string) => string);
}

/**
 * Reglas ordenadas de lo más específico a lo más general. Cada patrón es global para
 * reemplazar todas las coincidencias de una cadena.
 */
const TEXT_RULES: readonly TextRule[] = [
  {
    // Bloque PEM completo; si no tiene cierre, se redacta hasta el final del texto.
    category: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY(?: BLOCK)?-----|$)/g,
    replace: "[REDACTED:private-key]"
  },
  {
    category: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    replace: "[REDACTED:jwt]"
  },
  {
    category: "known-token",
    pattern:
      /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,}|(?:AKIA|ASIA)[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|sk-(?:ant-)?[A-Za-z0-9_-]{32,}|npm_[A-Za-z0-9]{36}|glpat-[A-Za-z0-9_-]{20,}|[sr]k_live_[0-9A-Za-z]{24,})(?![A-Za-z0-9_-])/g,
    replace: "[REDACTED:token]"
  },
  {
    category: "auth-scheme",
    pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
    replace: `$1 ${REDACTED}`
  },
  {
    category: "data-url",
    pattern: /data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/g,
    replace: "[REDACTED:data-url]"
  },
  {
    category: "email",
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    replace: "[REDACTED:email]"
  },
  {
    // clave=valor, clave: valor y "clave": "valor" cuando el nombre indica un secreto.
    category: "sensitive-field",
    pattern:
      /(["']?[\w.-]*(?:password|passwd|secret|token|api[_-]?key|authorization|private[_-]?key|credential|cookie)[\w.-]*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|(?:(?:Bearer|Basic)\s+)?[^\s,;&"'}]+)/gi,
    // Conserva las comillas del valor original para no romper el formato JSON del texto.
    replace: (match, prefix) => {
      const quote = match.charAt(prefix.length);
      return quote === '"' || quote === "'" ? `${prefix}${quote}${REDACTED}${quote}` : `${prefix}${REDACTED}`;
    }
  },
  {
    // Coordenadas expresadas como campo: latitude=19.4, "lng": -99.1
    category: "coordinates",
    pattern: /(["']?\b(?:latitude|longitude|lat|lng|lon)["']?\s*[:=]\s*)-?\d+(?:\.\d+)?/gi,
    replace: `$1${REDACTED}`
  }
];

/** Nombres de campo cuyo valor nunca debe salir de la aplicación. */
const SENSITIVE_KEY = /password|passwd|secret|token|api[_-]?key|authorization|private[_-]?key|credential|cookie/i;
/** Campos propios de este dominio: foto, ubicación y su precisión. */
const AUXILIARY_KEY = /^(?:photo|image|evidence|dataurl|latitude|longitude|lat|lng|lon|coords|coordinates|accuracy)$/i;

/** Sustituye los valores sensibles reconocidos dentro de un texto. */
export function redactSensitiveText(input: string): string {
  let output = input;
  for (const rule of TEXT_RULES) {
    output = typeof rule.replace === "string" ? output.replace(rule.pattern, rule.replace) : output.replace(rule.pattern, rule.replace);
  }
  return output;
}

function isBinaryLike(value: object): boolean {
  if (typeof Blob !== "undefined" && value instanceof Blob) return true;
  if (typeof ArrayBuffer !== "undefined" && (value instanceof ArrayBuffer || ArrayBuffer.isView(value))) return true;
  return false;
}

function redactInner(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactSensitiveText(value);
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") return "[Function]";
  if (typeof value === "symbol") return "[Symbol]";

  const objectValue = value as object;
  if (isBinaryLike(objectValue)) return "[REDACTED:binary]";
  if (seen.has(objectValue)) return "[Circular]";
  if (depth >= MAX_DEPTH) return "[Truncated]";
  seen.add(objectValue);

  if (objectValue instanceof Error) {
    // Nunca se copian la pila ni las propiedades adicionales del error.
    return { name: objectValue.name, message: safeErrorMessage(objectValue) };
  }

  if (Array.isArray(objectValue)) {
    return objectValue.slice(0, MAX_KEYS).map((item) => redactInner(item, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(objectValue).slice(0, MAX_KEYS)) {
    if (key === "__proto__") continue;
    result[key] = SENSITIVE_KEY.test(key) || AUXILIARY_KEY.test(key) ? REDACTED : redactInner(inner, depth + 1, seen);
  }
  return result;
}

/**
 * Copia profunda con los valores sensibles reemplazados. No modifica la entrada, tolera
 * ciclos y limita profundidad y cantidad de claves para no depender del tamaño del objeto.
 */
export function redactSensitiveValue(value: unknown): unknown {
  return redactInner(value, 0, new WeakSet());
}

/**
 * Mensaje de error apto para mostrarse, registrarse o guardarse (por ejemplo en
 * `lastError` de la outbox). Solo usa `message` de un `Error`, sin pila, y lo redacta y
 * acota. Cualquier otro valor se sustituye por el mensaje genérico.
 */
export function safeErrorMessage(error: unknown, fallback = "Ha ocurrido un error inesperado."): string {
  let message: string | null = null;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object" && error !== null && "message" in error) {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string") message = candidate;
  }
  if (message === null) return fallback;

  const cleaned = redactSensitiveText(message).replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.length > MAX_SAFE_MESSAGE_LENGTH ? `${cleaned.slice(0, MAX_SAFE_MESSAGE_LENGTH - 1)}…` : cleaned;
}

export interface PayloadSummary {
  type: "null" | "undefined" | "string" | "number" | "boolean" | "array" | "object" | "other";
  /** Longitud de una cadena o de un arreglo. */
  length?: number;
  /** Nombres de propiedades (nunca valores) para describir la forma de un objeto. */
  keys?: string[];
}

const SAFE_KEY_NAME = /^[A-Za-z_][\w-]{0,39}$/;

/**
 * Describe la forma de un payload sin incluir ningún valor. Sirve para registrar qué se
 * procesó sin imprimir el payload completo.
 */
export function describePayload(value: unknown): PayloadSummary {
  if (value === null) return { type: "null" };
  if (value === undefined) return { type: "undefined" };
  if (typeof value === "string") return { type: "string", length: value.length };
  if (typeof value === "number") return { type: "number" };
  if (typeof value === "boolean") return { type: "boolean" };
  if (Array.isArray(value)) return { type: "array", length: value.length };
  if (typeof value === "object") {
    const keys = Object.keys(value as object)
      .slice(0, 20)
      .map((key) => (SAFE_KEY_NAME.test(key) && !SENSITIVE_KEY.test(key) ? key : "[key]"));
    return { type: "object", keys };
  }
  return { type: "other" };
}
