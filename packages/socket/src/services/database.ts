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

// ── Médias ───────────────────────────────────────────────────────────────────

export interface DbMediaFile {
  hash:       string   // SHA256 hex 64 chars
  ext:        string   // sans point : "jpg", "mp4"
  mime_type:  string
  size:       number
  ref_count:  number
  created_at: number
}

export interface DbMedia {
  id:            string
  owner_id:      string | null
  parent_id:     string | null   // réservé versionnage futur
  hash:          string
  original_name: string
  visibility:    "private" | "public" | "shared"
  shared_with:   string          // JSON array
  created_at:    number
}

export interface DbQuizMedia {
  quiz_id:  string
  media_id: string
}

export interface MediaRef {
  quiz_id:    string
  subject:    string | null  // null si quiz d'un autre manager
  owner_name: string | null  // null si quiz du manager courant
  own:        boolean
}

export interface MediaEntry {
  id:            string
  owner_id:      string | null
  hash:          string
  ext:           string
  mime_type:     string
  size:          number
  original_name: string
  visibility:    "private" | "public" | "shared"
  shared_with:   string[]
  created_at:    number
  referenced_by: MediaRef[]
}

// Migration : appelée au démarrage depuis createHttpServer()
export const migrateMediaTables = (): void => {
  const database = getDb()

  database.exec(`
    CREATE TABLE IF NOT EXISTS media_files (
      hash       TEXT PRIMARY KEY,
      ext        TEXT NOT NULL,
      mime_type  TEXT NOT NULL,
      size       INTEGER NOT NULL,
      ref_count  INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id            TEXT PRIMARY KEY,
      owner_id      TEXT,
      parent_id     TEXT,
      hash          TEXT NOT NULL,
      original_name TEXT NOT NULL,
      visibility    TEXT NOT NULL DEFAULT 'private'
                    CHECK (visibility IN ('private','public','shared')),
      shared_with   TEXT NOT NULL DEFAULT '[]',
      created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (owner_id)  REFERENCES managers(id) ON DELETE SET NULL,
      FOREIGN KEY (parent_id) REFERENCES media(id)    ON DELETE SET NULL,
      FOREIGN KEY (hash)      REFERENCES media_files(hash)
    )
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS quiz_media (
      quiz_id   TEXT NOT NULL,
      media_id  TEXT NOT NULL,
      PRIMARY KEY (quiz_id, media_id),
      FOREIGN KEY (quiz_id)  REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (media_id) REFERENCES media(id)
    )
  `)

  logger.info("Media tables ready")
}

// ── Permissions médias ───────────────────────────────────────────────────────

export const canReadMedia = (
  m: DbMedia,
  managerId: string,
  role: string,
): boolean => {
  if (role === "superadmin") return true
  if (m.owner_id === managerId) return true
  if (m.visibility === "public") return true
  if (
    m.visibility === "shared" &&
    (JSON.parse(m.shared_with) as string[]).includes(managerId)
  ) return true
  return false
}

export const canWriteMedia = (
  m: DbMedia,
  managerId: string,
  role: string,
): boolean => {
  if (role === "superadmin") return true
  return m.owner_id === managerId
}

// ── CRUD médias ──────────────────────────────────────────────────────────────

// Construit la liste referenced_by pour un média
const buildReferencedBy = (
  mediaId: string,
  managerId: string,
): MediaRef[] => {
  const db = getDb()

  const rows = db.prepare(`
    SELECT qm.quiz_id, q.subject, q.owner_id, m.username as owner_name
    FROM quiz_media qm
    JOIN quizzes q ON q.id = qm.quiz_id
    JOIN managers m ON m.id = q.owner_id
    WHERE qm.media_id = ?
  `).all(mediaId) as {
    quiz_id: string
    subject: string
    owner_id: string
    owner_name: string
  }[]

  return rows.map((r) => ({
    quiz_id:    r.quiz_id,
    subject:    r.owner_id === managerId ? r.subject : null,
    owner_name: r.owner_id === managerId ? null : r.owner_name,
    own:        r.owner_id === managerId,
  }))
}

const serializeMedia = (
  m: DbMedia,
  f: DbMediaFile,
  managerId: string,
): MediaEntry => ({
  id:            m.id,
  owner_id:      m.owner_id,
  hash:          m.hash,
  ext:           f.ext,
  mime_type:     f.mime_type,
  size:          f.size,
  original_name: m.original_name,
  visibility:    m.visibility,
  shared_with:   JSON.parse(m.shared_with) as string[],
  created_at:    m.created_at,
  referenced_by: buildReferencedBy(m.id, managerId),
})

export const listMedia = (
  managerId: string,
  role: string,
): MediaEntry[] => {
  const db = getDb()
  const all = db.prepare("SELECT * FROM media ORDER BY created_at DESC").all() as DbMedia[]

  return all
    .filter((m) => canReadMedia(m, managerId, role))
    .map((m) => {
      const f = db.prepare("SELECT * FROM media_files WHERE hash = ?").get(m.hash) as DbMediaFile
      return serializeMedia(m, f, managerId)
    })
}

export const getMediaById = (
  id: string,
  managerId: string,
): MediaEntry | null => {
  const db = getDb()
  const m = db.prepare("SELECT * FROM media WHERE id = ?").get(id) as DbMedia | undefined
  if (!m) return null
  const f = db.prepare("SELECT * FROM media_files WHERE hash = ?").get(m.hash) as DbMediaFile | undefined
  if (!f) return null
  return serializeMedia(m, f, managerId)
}

export const getMediaRow = (id: string): DbMedia | null =>
  (getDb().prepare("SELECT * FROM media WHERE id = ?").get(id) as DbMedia | undefined) ?? null

export const getMediaFileByHash = (hash: string): DbMediaFile | null =>
  (getDb().prepare("SELECT * FROM media_files WHERE hash = ?").get(hash) as DbMediaFile | undefined) ?? null

// Créer ou réutiliser media_files (déduplication), créer media
export const createMediaEntry = (opts: {
  hash:         string
  ext:          string
  mimeType:     string
  size:         number
  originalName: string
  ownerId:      string
  visibility?:  "private" | "public" | "shared"
}): string => {
  const db     = getDb()
  const id     = randomUUID()
  const vis    = opts.visibility ?? "private"

  // Déduplication : media_files
  const existing = db.prepare("SELECT hash FROM media_files WHERE hash = ?").get(opts.hash)
  if (!existing) {
    db.prepare(
      "INSERT INTO media_files (hash, ext, mime_type, size) VALUES (?, ?, ?, ?)"
    ).run(opts.hash, opts.ext, opts.mimeType, opts.size)
  }
  db.prepare("UPDATE media_files SET ref_count = ref_count + 1 WHERE hash = ?").run(opts.hash)

  db.prepare(
    `INSERT INTO media (id, owner_id, hash, original_name, visibility, shared_with)
     VALUES (?, ?, ?, ?, ?, '[]')`
  ).run(id, opts.ownerId, opts.hash, opts.originalName, vis)

  return id
}

export const deleteMediaEntry = (id: string): {
  ok: boolean
  blocked?: MediaRef[]
  physicallyDeleted?: boolean
  hash?: string
} => {
  const db = getDb()

  const m = db.prepare("SELECT * FROM media WHERE id = ?").get(id) as DbMedia | undefined
  if (!m) return { ok: false }

  // Vérifier les références quiz
  const refs = buildReferencedBy(id, "")
  if (refs.length > 0) {
    return { ok: false, blocked: refs }
  }

  // Décrémenter ref_count
  db.prepare("UPDATE media_files SET ref_count = ref_count - 1 WHERE hash = ?").run(m.hash)

  // Supprimer l'entrée logique
  db.prepare("DELETE FROM media WHERE id = ?").run(id)

  // Supprimer physiquement si ref_count == 0
  const file = db.prepare("SELECT ref_count, hash FROM media_files WHERE hash = ?")
    .get(m.hash) as { ref_count: number; hash: string } | undefined

  let physicallyDeleted = false
  if (file && file.ref_count <= 0) {
    db.prepare("DELETE FROM media_files WHERE hash = ?").run(m.hash)
    physicallyDeleted = true
  }

  return { ok: true, physicallyDeleted, hash: m.hash }
}

export const updateMediaVisibility = (
  id: string,
  visibility: "private" | "public" | "shared",
  sharedWith: string[],
): void => {
  getDb()
    .prepare("UPDATE media SET visibility = ?, shared_with = ? WHERE id = ?")
    .run(visibility, JSON.stringify(sharedWith), id)
}

// Enregistre les références quiz ↔ media à partir du JSON des questions
export const syncQuizMedia = (quizId: string, questions: unknown[]): void => {
  const db = getDb()

  // Supprimer les anciennes références
  db.prepare("DELETE FROM quiz_media WHERE quiz_id = ?").run(quizId)

  // Extraire et insérer les nouvelles
  const mediaRefs = extractMediaRefs(questions)
  const insert = db.prepare(
    "INSERT OR IGNORE INTO quiz_media (quiz_id, media_id) VALUES (?, ?)"
  )
  for (const mediaId of mediaRefs) {
    // Vérifier que le média existe
    const exists = db.prepare("SELECT id FROM media WHERE id = ?").get(mediaId)
    if (exists) insert.run(quizId, mediaId)
  }
}

// Extrait les UUIDs media:<uuid> depuis les questions
export const extractMediaRefs = (questions: unknown[]): string[] => {
  const refs: string[] = []
  for (const q of questions) {
    const question = q as Record<string, unknown>
    const media = question.media as { url?: string } | undefined
    if (media?.url?.startsWith("media:")) {
      refs.push(media.url.slice("media:".length))
    }
  }
  return refs
}

// Résout media:<uuid> → { hash, ext } pour la route partie
export const resolveMediaUrl = (
  mediaId: string,
): { hash: string; ext: string } | null => {
  const db = getDb()
  const row = db.prepare(`
    SELECT mf.hash, mf.ext
    FROM media m
    JOIN media_files mf ON mf.hash = m.hash
    WHERE m.id = ?
  `).get(mediaId) as { hash: string; ext: string } | undefined
  return row ?? null
}

// Taille totale des fichiers physiques (pour le superadmin)
export const getTotalMediaStorage = (): number => {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(size), 0) as total FROM media_files")
    .get() as { total: number }
  return row.total
}
