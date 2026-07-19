/**
 * Logger Praxis — sortie JSON structurée sur stdout.
 *
 * Format de chaque ligne :
 * {"ts":"ISO8601","level":"info","source":"app","msg":"...","ctx":{}}
 *
 * Filtres docker logs :
 *   Tout        : docker logs praxis
 *   App         : docker logs praxis 2>&1 | grep '"source":"app"'
 *   Requêtes    : docker logs praxis 2>&1 | grep '"source":"nginx_access"'
 *   Nginx error : docker logs praxis 2>&1 | grep '"source":"nginx_error"'
 *
 * Niveaux : debug < info < warn < error < audit
 * Contrôlé par LOG_LEVEL (défaut : "info")
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "audit"

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
  audit: 4,
}

const PRETTY_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // cyan
  info:  "\x1b[32m", // vert
  warn:  "\x1b[33m", // jaune
  error: "\x1b[31m", // rouge
  audit: "\x1b[35m", // magenta
}
const RESET = "\x1b[0m"

const getMinLevel = (): number => {
  const env = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel
  return LEVELS[env] ?? LEVELS.info
}

const isPretty = (): boolean =>
  (process.env.LOG_FORMAT ?? "json").toLowerCase() === "pretty"

const formatPretty = (
  level: LogLevel,
  msg: string,
  ctx?: Record<string, unknown>,
): string => {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 23)
  const color = PRETTY_COLORS[level]
  const lvl = level.toUpperCase().padEnd(5)
  const ctxStr = ctx && Object.keys(ctx).length > 0
    ? "  " + Object.entries(ctx).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ")
    : ""
  return `${color}[${ts}] ${lvl}${RESET} ${msg}${ctxStr}`
}

const write = (
  level: LogLevel,
  msg: string,
  ctx?: Record<string, unknown>,
): void => {
  if (LEVELS[level] < getMinLevel()) return

  if (isPretty()) {
    process.stdout.write(formatPretty(level, msg, ctx) + "\n")
    return
  }

  const entry = {
    ts:     new Date().toISOString(),
    level,
    source: "app",
    msg,
    ...(ctx && Object.keys(ctx).length > 0 ? { ctx } : {}),
  }
  process.stdout.write(JSON.stringify(entry) + "\n")
}

const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => write("debug", msg, ctx),
  info:  (msg: string, ctx?: Record<string, unknown>) => write("info",  msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => write("warn",  msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => write("error", msg, ctx),

  /**
   * Niveau audit — toujours loggé quelle que soit la config LOG_LEVEL.
   * Réservé aux actions sensibles : login, création compte, suppression, branding.
   */
  audit: (msg: string, ctx?: Record<string, unknown>): void => {
    if (isPretty()) {
      process.stdout.write(formatPretty("audit", msg, ctx) + "\n")
      return
    }
    const entry = {
      ts:     new Date().toISOString(),
      level:  "audit",
      source: "app",
      msg,
      ...(ctx && Object.keys(ctx).length > 0 ? { ctx } : {}),
    }
    process.stdout.write(JSON.stringify(entry) + "\n")
  },
}

export default logger
