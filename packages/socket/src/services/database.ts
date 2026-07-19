import Database from "better-sqlite3"
import logger from "@razzia/socket/services/logger"
import fs from "fs"
import { resolve } from "path"

const inContainerPath = process.env.CONFIG_PATH

const getDbPath = (): string =>
  inContainerPath
    ? resolve(inContainerPath, "praxis.db")
    : resolve(process.cwd(), "../../config", "praxis.db")

let db: Database.Database | null = null

export const getDb = (): Database.Database => {
  if (!db) {
    throw new Error("Database not initialized — call initDatabase() first")
  }
  return db
}

export const initDatabase = (): void => {
  const dbPath = getDbPath()
  const configDir = resolve(dbPath, "..")

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")

  createSchema()

  logger.info("Database ready", { path: dbPath })
}

const createSchema = (): void => {
  const database = getDb()

  // Managers (superadmin inclus via role)
  database.exec(`
    CREATE TABLE IF NOT EXISTS managers (
      id            TEXT PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'manager'
                    CHECK (role IN ('superadmin', 'manager')),
      created_at    INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Sessions auth manager (cookie HttpOnly)
  database.exec(`
    CREATE TABLE IF NOT EXISTS manager_sessions (
      token       TEXT PRIMARY KEY,
      manager_id  TEXT NOT NULL,
      expires_at  INTEGER,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE CASCADE
    )
  `)

  // Token de setup à usage unique (premier démarrage)
  database.exec(`
    CREATE TABLE IF NOT EXISTS setup_tokens (
      token       TEXT PRIMARY KEY,
      expires_at  INTEGER NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Log d'audit
  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      action      TEXT NOT NULL,
      manager_id  TEXT,
      ip          TEXT,
      detail      TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Paramètres globaux
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // Résultats de parties
  database.exec(`
    CREATE TABLE IF NOT EXISTS results (
      id          TEXT PRIMARY KEY,
      owner_id    TEXT,
      visibility  TEXT NOT NULL DEFAULT 'private'
                  CHECK (visibility IN ('private', 'public', 'shared')),
      shared_with TEXT NOT NULL DEFAULT '[]',
      subject     TEXT NOT NULL,
      date        TEXT NOT NULL,
      data        TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (owner_id) REFERENCES managers(id) ON DELETE SET NULL
    )
  `)

  database
    .prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)")
    .run("default_session_duration", "unlimited")

  logger.info("Database schema ready")
}

// True si au moins un manager existe (setup déjà effectué)
export const isSetupDone = (): boolean => {
  const row = getDb()
    .prepare("SELECT COUNT(*) as count FROM managers")
    .get() as { count: number }
  return row.count > 0
}

// Nettoyage des sessions expirées
export const purgeExpiredSessions = (): void => {
  const result = getDb()
    .prepare(
      "DELETE FROM manager_sessions WHERE expires_at IS NOT NULL AND expires_at < unixepoch()",
    )
    .run()
  if (result.changes > 0) {
    logger.info("Expired sessions purged", { count: result.changes })
  }
}

// ── Résultats SQLite ─────────────────────────────────────────────────────────

import type { GameResult, GameResultMeta } from "@razzia/common/types/game"
import { randomUUID } from "crypto"

export const saveResultDb = (result: GameResult, ownerId: string): void => {
  try {
    const id = randomUUID()
    getDb()
      .prepare(
        `INSERT INTO results (id, owner_id, visibility, shared_with, subject, date, data)
         VALUES (?, ?, 'private', '[]', ?, ?, ?)`,
      )
      .run(id, ownerId, result.subject, result.date, JSON.stringify(result))
    logger.info("Result saved to DB", { owner_id: ownerId, subject: result.subject })
  } catch (error) {
    logger.error("Failed to save result to DB", { error: String(error) })
  }
}

interface DbResult {
  id: string
  owner_id: string | null
  visibility: "private" | "public" | "shared"
  shared_with: string
  subject: string
  date: string
  data: string
}

const parseSharedWith = (raw: string): string[] => {
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

export const canReadResult = (
  row: DbResult,
  managerId: string,
  role: string,
): boolean => {
  if (role === "superadmin") return true
  if (row.owner_id === managerId) return true
  if (row.visibility === "public") return true
  if (
    row.visibility === "shared" &&
    parseSharedWith(row.shared_with).includes(managerId)
  )
    return true
  return false
}

export const canWriteResult = (
  row: DbResult,
  managerId: string,
  role: string,
): boolean => {
  if (role === "superadmin") return true
  return row.owner_id === managerId
}

export const listResultsMeta = (
  managerId: string,
  role: string,
): (GameResultMeta & { visibility: string; owner_id: string | null })[] => {
  const rows = getDb()
    .prepare("SELECT * FROM results ORDER BY created_at DESC")
    .all() as DbResult[]

  return rows
    .filter((r) => canReadResult(r, managerId, role))
    .map((r) => ({
      id: r.id,
      subject: r.subject,
      date: r.date,
      playerCount: (JSON.parse(r.data) as GameResult).players.length,
      visibility: r.visibility,
      owner_id: r.owner_id,
      shared_with: parseSharedWith(r.shared_with),
    }))
}

export const getResultDb = (id: string): GameResult | null => {
  const row = getDb()
    .prepare("SELECT data FROM results WHERE id = ?")
    .get(id) as { data: string } | undefined
  if (!row) return null
  return JSON.parse(row.data) as GameResult
}

export const getResultRowDb = (id: string): DbResult | null => {
  return (
    (getDb()
      .prepare("SELECT * FROM results WHERE id = ?")
      .get(id) as DbResult | undefined) ?? null
  )
}

export const deleteResultDb = (id: string): void => {
  getDb().prepare("DELETE FROM results WHERE id = ?").run(id)
}

export const updateResultVisibility = (
  id: string,
  visibility: "private" | "public" | "shared",
  sharedWith: string[],
): void => {
  getDb()
    .prepare(
      "UPDATE results SET visibility = ?, shared_with = ? WHERE id = ?",
    )
    .run(visibility, JSON.stringify(sharedWith), id)
}

export const closeDatabase = (): void => {
  if (db) {
    db.close()
    db = null
    logger.info("Database closed")
  }
}
