import Database from "better-sqlite3"
import { resolve } from "path"
import fs from "fs"

const inContainerPath = process.env.CONFIG_PATH

const getDbPath = () =>
  inContainerPath
    ? resolve(inContainerPath, "praxis.db")
    : resolve(process.cwd(), "../../config", "praxis.db")

let db: Database.Database | null = null

export const getDb = (): Database.Database => {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.")
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

  // Performances : WAL mode pour les lectures/écritures simultanées
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")

  createTables()

  console.log(`Database initialized at ${dbPath}`)
}

const createTables = (): void => {
  const database = getDb()

  // Comptes managers
  database.exec(`
    CREATE TABLE IF NOT EXISTS managers (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Quiz créés par les managers (les JSON restent pour les quiz publics d'exemple)
  database.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private', 'shared', 'public')),
      shared_with TEXT NOT NULL DEFAULT '[]',
      subject TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (owner_id) REFERENCES managers(id) ON DELETE CASCADE
    )
  `)

  // Fichiers uploadés
  database.exec(`
    CREATE TABLE IF NOT EXISTS uploads (
      uuid TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      path TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('image', 'video', 'audio')),
      size INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (uploaded_by) REFERENCES managers(id) ON DELETE CASCADE
    )
  `)

  // Sessions de jeu
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      manager_id TEXT NOT NULL,
      quiz_id TEXT,
      quiz_source TEXT NOT NULL DEFAULT 'db' CHECK(quiz_source IN ('db', 'json')),
      status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'running', 'finished')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE CASCADE
    )
  `)

  console.log("Database tables ready")
}

export const closeDatabase = (): void => {
  if (db) {
    db.close()
    db = null
    console.log("Database closed")
  }
}
