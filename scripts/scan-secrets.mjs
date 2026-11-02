#!/usr/bin/env node
// Escáner de credenciales de alta confianza (Semana 09, bloque de Tonanzin).
//
// Busca formatos reales y específicos de credenciales (claves privadas PEM, JWT completos
// y tokens con prefijos conocidos). NO busca palabras genéricas como "secret", "password"
// o "token": producirían falsos positivos con documentación, nombres de paquetes y el
// lockfile sin aportar detección real.
//
// Nunca imprime ni devuelve el valor detectado: solo archivo, línea y categoría.
// Limitación: un escáner basado en patrones no detecta todos los formatos posibles y debe
// complementarse con revisión humana.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {ReadonlyArray<{ category: string, pattern: RegExp }>} */
export const CREDENTIAL_PATTERNS = [
  // El patrón tiene un grupo opcional entre "BEGIN " y "PRIVATE KEY", así que su propio
  // código fuente no coincide con él.
  { category: "private-key", pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY(?: BLOCK)?-----/ },
  { category: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { category: "github-token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})(?![A-Za-z0-9_])/ },
  { category: "aws-access-key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}(?![0-9A-Z])/ },
  { category: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { category: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/ },
  { category: "api-key-sk", pattern: /(?<![A-Za-z0-9_-])sk-(?:ant-)?[A-Za-z0-9_-]{32,}/ },
  { category: "npm-token", pattern: /\bnpm_[A-Za-z0-9]{36}(?![A-Za-z0-9])/ },
  { category: "gitlab-token", pattern: /\bglpat-[A-Za-z0-9_-]{20,}/ },
  { category: "stripe-live-key", pattern: /\b[sr]k_live_[0-9A-Za-z]{24,}/ }
];

const IGNORED_DIRECTORIES = new Set([
  "node_modules", ".git", ".next", "out", "coverage", "reports", "test-results", "playwright-report", "blob-report"
]);
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".webm"
]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Analiza un texto y devuelve hallazgos sin el valor detectado.
 * @param {string} text
 * @returns {Array<{ line: number, category: string }>}
 */
export function scanText(text) {
  const findings = [];
  const lines = text.split(/\r\n|\r|\n/);
  for (let index = 0; index < lines.length; index += 1) {
    for (const { category, pattern } of CREDENTIAL_PATTERNS) {
      if (pattern.test(lines[index])) findings.push({ line: index + 1, category });
    }
  }
  return findings;
}

function listWithGit(root) {
  try {
    const output = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024
    });
    return output.split("\0").filter(Boolean);
  } catch {
    return null;
  }
}

function listByWalking(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) visit(join(directory, entry.name));
      } else if (entry.isFile()) {
        files.push(relative(root, join(directory, entry.name)).split(sep).join("/"));
      }
    }
  };
  visit(root);
  return files;
}

/**
 * Analiza los archivos versionados (o, sin Git, el árbol de trabajo sin carpetas generadas).
 * @param {string} root
 * @returns {{ scannedFiles: number, findings: Array<{ file: string, line: number, category: string }> }}
 */
export function scanRepository(root) {
  const base = resolve(root);
  const candidates = listWithGit(base) ?? listByWalking(base);
  const findings = [];
  let scannedFiles = 0;

  for (const file of candidates) {
    if (file.split("/").some((part) => IGNORED_DIRECTORIES.has(part))) continue;
    if (BINARY_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    const absolute = join(base, file);
    let content;
    try {
      const stats = statSync(absolute);
      if (!stats.isFile() || stats.size > MAX_FILE_BYTES) continue;
      const buffer = readFileSync(absolute);
      if (buffer.includes(0)) continue; // binario
      content = buffer.toString("utf8");
    } catch {
      continue;
    }
    scannedFiles += 1;
    for (const { line, category } of scanText(content)) findings.push({ file, line, category });
  }

  return { scannedFiles, findings };
}

/** Texto para consola: archivo, línea y categoría; el valor siempre aparece redactado. */
export function formatFindings(findings) {
  return findings.map(({ file, line, category }) => `${file}:${line}  categoría=${category}  valor=[REDACTED]`).join("\n");
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(fileURLToPath(import.meta.url), "..", "..");
  const { scannedFiles, findings } = scanRepository(root);
  if (findings.length > 0) {
    console.error(`Escáner de credenciales: ${findings.length} hallazgo(s) en ${scannedFiles} archivos.`);
    console.error(formatFindings(findings));
    process.exit(1);
  }
  console.log(`Escáner de credenciales: sin hallazgos de alta confianza en ${scannedFiles} archivos.`);
}
