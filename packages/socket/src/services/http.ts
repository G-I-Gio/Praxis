import bcrypt from "bcryptjs"
import logger from "@razzia/socket/services/logger"
import { createServer, type IncomingMessage, type ServerResponse } from "http"
import { randomUUID } from "crypto"
import fs from "fs"
import { resolve, extname, join } from "path"
import { EVENTS } from "@razzia/common/constants"
import type { Server } from "@razzia/common/types/game/socket"
import { getHealth } from "@razzia/socket/services/health"
import { getDb, isSetupDone } from "@razzia/socket/services/database"
import {
  canReadResult,
  canWriteResult,
  deleteResultDb,
  getResultDb,
  getResultRowDb,
  listResultsMeta,
  updateResultVisibility,
} from "@razzia/socket/services/database"
import { quizzValidator } from "@razzia/common/validators/quizz"

const COOKIE_NAME = "praxis_session"
const BCRYPT_ROUNDS = 12

// Instance Socket.IO — injectée depuis index.ts après initialisation
let _io: Server | null = null
export const setSocketIo = (io: Server): void => { _io = io }

// --- Utilitaires bas niveau ---

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", () => resolve(body))
    req.on("error", reject)
  })

const parseJson = (body: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

const getIp = (req: IncomingMessage): string =>
  (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
  req.socket.remoteAddress ??
  "unknown"

const getCookie = (req: IncomingMessage, name: string): string | null => {
  const header = req.headers.cookie ?? ""
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=")
    if (key === name) return rest.join("=")
  }
  return null
}

const setSessionCookie = (res: ServerResponse, token: string): void => {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`,
  )
}

const clearSessionCookie = (res: ServerResponse): void => {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
  )
}

const json = (res: ServerResponse, status: number, data: unknown): void => {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  })
  res.end(body)
}

// --- Vérification de session ---

export const getSessionManager = (
  req: IncomingMessage,
): { id: string; username: string; role: string } | null => {
  const token = getCookie(req, COOKIE_NAME)
  if (!token) return null
  return validateSessionToken(token)
}

export const validateSessionToken = (
  token: string,
): { id: string; username: string; role: string } | null => {
  if (!token) return null

  const db = getDb()
  const session = db
    .prepare(
      `SELECT s.token, s.expires_at, m.id, m.username, m.role
       FROM manager_sessions s
       JOIN managers m ON m.id = s.manager_id
       WHERE s.token = ?`,
    )
    .get(token) as
    | { token: string; expires_at: number | null; id: string; username: string; role: string }
    | undefined

  if (!session) return null
  if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000)) {
    db.prepare("DELETE FROM manager_sessions WHERE token = ?").run(token)
    return null
  }

  return { id: session.id, username: session.username, role: session.role }
}

// --- Audit log ---

const audit = (
  action: string,
  managerId: string | null,
  ip: string,
  detail?: string,
): void => {
  getDb()
    .prepare(
      "INSERT INTO audit_log (action, manager_id, ip, detail) VALUES (?, ?, ?, ?)",
    )
    .run(action, managerId, ip, detail ?? null)
}

// --- Rate limiting en mémoire ---

const loginAttempts = new Map<string, { count: number; blockedUntil: number }>()

const isRateLimited = (ip: string): boolean => {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry) return false
  if (entry.blockedUntil > now) return true
  if (entry.blockedUntil > 0 && entry.blockedUntil <= now) {
    loginAttempts.delete(ip)
    return false
  }
  return false
}

const recordFailedLogin = (ip: string): void => {
  const now = Date.now()
  const entry = loginAttempts.get(ip) ?? { count: 0, blockedUntil: 0 }
  entry.count++
  if (entry.count >= 5) {
    entry.blockedUntil = now + 15 * 60 * 1000 // 15 minutes
    entry.count = 0
    logger.warn("Rate limit triggered", { ip })
  }
  loginAttempts.set(ip, entry)
}

const clearFailedLogin = (ip: string): void => {
  loginAttempts.delete(ip)
}

// --- Middleware auth ---

type AuthedHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  manager: { id: string; username: string; role: string },
) => Promise<void> | void

const requireAuth =
  (handler: AuthedHandler) =>
  async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const manager = getSessionManager(req)
    if (!manager) return json(res, 401, { error: "Not authenticated" })
    return handler(req, res, manager)
  }

const requireSuperadmin =
  (handler: AuthedHandler) =>
  async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const manager = getSessionManager(req)
    if (!manager) return json(res, 401, { error: "Not authenticated" })
    if (manager.role !== "superadmin") return json(res, 403, { error: "Forbidden" })
    return handler(req, res, manager)
  }

// --- Types quiz SQLite ---

interface DbQuiz {
  id: string
  owner_id: string
  visibility: "private" | "public" | "shared"
  shared_with: string // JSON array
  subject: string
  questions: string // JSON array
}

// --- Helpers quiz ---

const parseSharedWith = (raw: string): string[] => {
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

const canReadQuiz = (
  quiz: DbQuiz,
  managerId: string,
  role: string,
): boolean => {
  if (role === "superadmin") return true
  if (quiz.owner_id === managerId) return true
  if (quiz.visibility === "public") return true
  if (quiz.visibility === "shared" && parseSharedWith(quiz.shared_with).includes(managerId)) return true
  return false
}

const canWriteQuiz = (
  quiz: DbQuiz,
  managerId: string,
  role: string,
): boolean => {
  if (role === "superadmin") return true
  return quiz.owner_id === managerId
}

// Export format: retirer les champs internes
const exportQuiz = (quiz: DbQuiz) => ({
  id: quiz.id,
  subject: quiz.subject,
  questions: JSON.parse(quiz.questions),
})

// Format complet pour l'API
const serializeQuiz = (quiz: DbQuiz) => ({
  id: quiz.id,
  owner_id: quiz.owner_id,
  visibility: quiz.visibility,
  shared_with: parseSharedWith(quiz.shared_with),
  subject: quiz.subject,
  questions: JSON.parse(quiz.questions),
})

// --- Migration schema quizzes ---

export const migrateQuizzesTable = (): void => {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id          TEXT PRIMARY KEY,
      owner_id    TEXT NOT NULL,
      visibility  TEXT NOT NULL DEFAULT 'private'
                  CHECK (visibility IN ('private', 'public', 'shared')),
      shared_with TEXT NOT NULL DEFAULT '[]',
      subject     TEXT NOT NULL,
      questions   TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (owner_id) REFERENCES managers(id) ON DELETE CASCADE
    )
  `)
}

// ============================================================
// --- Handlers Auth ---
// ============================================================

const handleSetup = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  if (isSetupDone()) {
    return json(res, 403, { error: "Setup already completed" })
  }

  const body = parseJson(await readBody(req))
  const username = (body?.username as string | undefined)?.trim()
  const password = body?.password as string | undefined

  if (!username || !password) {
    return json(res, 400, { error: "username and password are required" })
  }
  if (username.length < 3 || username.length > 32) {
    return json(res, 400, { error: "username must be between 3 and 32 characters" })
  }
  if (password.length < 8) {
    return json(res, 400, { error: "password must be at least 8 characters" })
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  const id = randomUUID()

  getDb()
    .prepare(
      "INSERT INTO managers (id, username, password_hash, role) VALUES (?, ?, ?, 'superadmin')",
    )
    .run(id, username, passwordHash)

  audit("setup_completed", id, getIp(req))
  logger.info("Super-admin created", { username })

  return json(res, 201, { ok: true })
}

const handleLogin = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const ip = getIp(req)

  if (isRateLimited(ip)) {
    return json(res, 429, { error: "Too many failed attempts, try again in 15 minutes" })
  }

  const body = parseJson(await readBody(req))
  const username = (body?.username as string | undefined)?.trim()
  const password = body?.password as string | undefined

  if (!username || !password) {
    return json(res, 400, { error: "username and password are required" })
  }

  const manager = getDb()
    .prepare("SELECT * FROM managers WHERE username = ?")
    .get(username) as
    | { id: string; username: string; password_hash: string; role: string }
    | undefined

  const valid = manager
    ? await bcrypt.compare(password, manager.password_hash)
    : false

  if (!manager || !valid) {
    recordFailedLogin(ip)
    audit("login_failed", manager?.id ?? null, ip, username)
    return json(res, 401, { error: "Invalid credentials" })
  }

  clearFailedLogin(ip)

  const token = randomUUID()
  const setting = getDb()
    .prepare("SELECT value FROM settings WHERE key = 'default_session_duration'")
    .get() as { value: string } | undefined

  const duration = setting?.value
  const expiresAt =
    duration && duration !== "unlimited"
      ? Math.floor(Date.now() / 1000) + parseInt(duration)
      : null

  getDb()
    .prepare(
      "INSERT INTO manager_sessions (token, manager_id, expires_at) VALUES (?, ?, ?)",
    )
    .run(token, manager.id, expiresAt)

  setSessionCookie(res, token)
  audit("login_success", manager.id, ip)

  return json(res, 200, {
    ok: true,
    manager: { id: manager.id, username: manager.username, role: manager.role },
  })
}

const handleLogout = (req: IncomingMessage, res: ServerResponse): void => {
  const token = getCookie(req, COOKIE_NAME)
  if (token) {
    getDb().prepare("DELETE FROM manager_sessions WHERE token = ?").run(token)
    audit("logout", null, getIp(req))
  }
  clearSessionCookie(res)
  return json(res, 200, { ok: true })
}

// PUT /auth/password — changer son propre mot de passe (tout manager authentifié)
const handleChangePassword = requireAuth(async (req, res, manager) => {
  const body = parseJson(await readBody(req))
  const currentPassword = body?.current_password as string | undefined
  const newPassword = body?.new_password as string | undefined

  if (!currentPassword || !newPassword) {
    return json(res, 400, { error: "current_password et new_password sont requis" })
  }
  if (newPassword.length < 8) {
    return json(res, 400, { error: "Le nouveau mot de passe doit faire au moins 8 caractères" })
  }
  if (newPassword === currentPassword) {
    return json(res, 400, { error: "Le nouveau mot de passe doit être différent de l'actuel" })
  }

  const row = getDb()
    .prepare("SELECT password_hash FROM managers WHERE id = ?")
    .get(manager.id) as { password_hash: string } | undefined

  if (!row) return json(res, 404, { error: "Compte introuvable" })

  const valid = await bcrypt.compare(currentPassword, row.password_hash)
  if (!valid) return json(res, 401, { error: "Mot de passe actuel incorrect" })

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  getDb()
    .prepare("UPDATE managers SET password_hash = ? WHERE id = ?")
    .run(newHash, manager.id)

  const currentToken = getCookie(req, COOKIE_NAME) ?? ""
  const { otherCount } = getDb()
    .prepare(
      "SELECT COUNT(*) as otherCount FROM manager_sessions WHERE manager_id = ? AND token != ?",
    )
    .get(manager.id, currentToken) as { otherCount: number }

  audit("password_changed", manager.id, getIp(req))
  return json(res, 200, { ok: true, other_sessions: otherCount })
})

// POST /auth/sessions/invalidate — invalider toutes les autres sessions
const handleInvalidateOtherSessions = requireAuth((req, res, manager) => {
  const currentToken = getCookie(req, COOKIE_NAME) ?? ""
  const { count } = getDb()
    .prepare(
      "SELECT COUNT(*) as count FROM manager_sessions WHERE manager_id = ? AND token != ?",
    )
    .get(manager.id, currentToken) as { count: number }

  getDb()
    .prepare("DELETE FROM manager_sessions WHERE manager_id = ? AND token != ?")
    .run(manager.id, currentToken)

  audit("sessions_invalidated", manager.id, getIp(req), `invalidated ${count} session(s)`)
  return json(res, 200, { ok: true, invalidated: count })
})

// GET /health — endpoint infra pour Docker HEALTHCHECK et reverse proxies
// Répond 200 si prêt, 503 si démarrage en cours ou arrêt
const handleHealth = (_req: IncomingMessage, res: ServerResponse): void => {
  const health = getHealth()
  const status = health.ready ? 200 : 503
  return json(res, status, health)
}

const handleStatus = (_req: IncomingMessage, res: ServerResponse): void => {
  const health = getHealth()
  return json(res, 200, {
    setupDone: isSetupDone(),
    ready: health.ready,
  })
}

const handleToken = (req: IncomingMessage, res: ServerResponse): void => {
  const token = getCookie(req, COOKIE_NAME)
  if (!token) return json(res, 401, { error: "Not authenticated" })
  // Valider que le token est bien actif avant de le retourner
  const m = validateSessionToken(token)
  if (!m) return json(res, 401, { error: "Not authenticated" })
  return json(res, 200, { token })
}

const handleMe = (req: IncomingMessage, res: ServerResponse): void => {
  const manager = getSessionManager(req)
  if (!manager) {
    return json(res, 401, { error: "Not authenticated" })
  }
  return json(res, 200, { manager })
}

// ============================================================
// --- Handlers Quiz ---
// ============================================================

// GET /api/quizzes
const handleListQuizzes = requireAuth((req, res, manager) => {
  const db = getDb()
  const all = db.prepare("SELECT * FROM quizzes ORDER BY updated_at DESC").all() as DbQuiz[]

  const rows = manager.role === "superadmin"
    ? all
    : all.filter((q) => canReadQuiz(q, manager.id, manager.role))

  return json(res, 200, { quizzes: rows.map(serializeQuiz) })
})

// POST /api/quizzes
const handleCreateQuiz = requireAuth(async (req, res, manager) => {
  const body = parseJson(await readBody(req))
  if (!body) return json(res, 400, { error: "Invalid JSON" })

  const result = quizzValidator.safeParse(body)
  if (!result.success) {
    return json(res, 400, { error: result.error.issues[0]?.message ?? "Validation error" })
  }

  const visibility = (body.visibility as string | undefined) ?? "private"
  if (!["private", "public", "shared"].includes(visibility)) {
    return json(res, 400, { error: "visibility must be private, public or shared" })
  }

  const sharedWith = Array.isArray(body.shared_with) ? body.shared_with : []

  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)

  getDb()
    .prepare(
      `INSERT INTO quizzes (id, owner_id, visibility, shared_with, subject, questions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      manager.id,
      visibility,
      JSON.stringify(sharedWith),
      result.data.subject,
      JSON.stringify(result.data.questions),
      now,
      now,
    )

  audit("quiz_created", manager.id, getIp(req), `quiz_id=${id}`)

  return json(res, 201, { id })
})

// GET /api/quizzes/:id
const handleGetQuiz = requireAuth((req, res, manager) => {
  const id = extractParam(req.url!, "/api/quizzes/", 1)
  if (!id) return json(res, 400, { error: "Missing id" })

  const quiz = getDb()
    .prepare("SELECT * FROM quizzes WHERE id = ?")
    .get(id) as DbQuiz | undefined

  if (!quiz) return json(res, 404, { error: "Quiz not found" })
  if (!canReadQuiz(quiz, manager.id, manager.role)) return json(res, 403, { error: "Forbidden" })

  return json(res, 200, serializeQuiz(quiz))
})

// PUT /api/quizzes/:id
const handleUpdateQuiz = requireAuth(async (req, res, manager) => {
  const id = extractParam(req.url!, "/api/quizzes/", 1)
  if (!id) return json(res, 400, { error: "Missing id" })

  const quiz = getDb()
    .prepare("SELECT * FROM quizzes WHERE id = ?")
    .get(id) as DbQuiz | undefined

  if (!quiz) return json(res, 404, { error: "Quiz not found" })
  if (!canWriteQuiz(quiz, manager.id, manager.role)) return json(res, 403, { error: "Forbidden" })

  const body = parseJson(await readBody(req))
  if (!body) return json(res, 400, { error: "Invalid JSON" })

  const result = quizzValidator.safeParse(body)
  if (!result.success) {
    return json(res, 400, { error: result.error.issues[0]?.message ?? "Validation error" })
  }

  const visibility = (body.visibility as string | undefined) ?? quiz.visibility
  if (!["private", "public", "shared"].includes(visibility)) {
    return json(res, 400, { error: "visibility must be private, public or shared" })
  }

  const sharedWith = Array.isArray(body.shared_with)
    ? body.shared_with
    : parseSharedWith(quiz.shared_with)

  getDb()
    .prepare(
      `UPDATE quizzes
       SET subject = ?, questions = ?, visibility = ?, shared_with = ?, updated_at = unixepoch()
       WHERE id = ?`,
    )
    .run(
      result.data.subject,
      JSON.stringify(result.data.questions),
      visibility,
      JSON.stringify(sharedWith),
      id,
    )

  audit("quiz_updated", manager.id, getIp(req), `quiz_id=${id}`)

  return json(res, 200, { id })
})

// DELETE /api/quizzes/:id
const handleDeleteQuiz = requireAuth((req, res, manager) => {
  const id = extractParam(req.url!, "/api/quizzes/", 1)
  if (!id) return json(res, 400, { error: "Missing id" })

  const quiz = getDb()
    .prepare("SELECT * FROM quizzes WHERE id = ?")
    .get(id) as DbQuiz | undefined

  if (!quiz) return json(res, 404, { error: "Quiz not found" })
  if (!canWriteQuiz(quiz, manager.id, manager.role)) return json(res, 403, { error: "Forbidden" })

  getDb().prepare("DELETE FROM quizzes WHERE id = ?").run(id)
  audit("quiz_deleted", manager.id, getIp(req), `quiz_id=${id}`)

  return json(res, 200, { ok: true })
})

// GET /api/quizzes/:id/export
const handleExportQuiz = requireAuth((req, res, manager) => {
  const id = extractParam(req.url!, "/api/quizzes/", 1)
  if (!id) return json(res, 400, { error: "Missing id" })

  const quiz = getDb()
    .prepare("SELECT * FROM quizzes WHERE id = ?")
    .get(id) as DbQuiz | undefined

  if (!quiz) return json(res, 404, { error: "Quiz not found" })
  if (!canReadQuiz(quiz, manager.id, manager.role)) return json(res, 403, { error: "Forbidden" })

  const exported = exportQuiz(quiz)
  const body = JSON.stringify(exported, null, 2)
  const filename = `quiz-${id}.json`

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": Buffer.byteLength(body),
  })
  res.end(body)
})

// POST /api/quizzes/import
const handleImportQuiz = requireAuth(async (req, res, manager) => {
  const body = parseJson(await readBody(req))
  if (!body) return json(res, 400, { error: "Invalid JSON" })

  const result = quizzValidator.safeParse(body)
  if (!result.success) {
    return json(res, 400, { error: result.error.issues[0]?.message ?? "Validation error" })
  }

  const id = randomUUID()
  const now = Math.floor(Date.now() / 1000)

  getDb()
    .prepare(
      `INSERT INTO quizzes (id, owner_id, visibility, shared_with, subject, questions, created_at, updated_at)
       VALUES (?, ?, 'private', '[]', ?, ?, ?, ?)`,
    )
    .run(id, manager.id, result.data.subject, JSON.stringify(result.data.questions), now, now)

  audit("quiz_imported", manager.id, getIp(req), `quiz_id=${id}`)

  return json(res, 201, { id })
})

// ============================================================
// --- Handlers Managers (superadmin) ---
// ============================================================

// GET /api/managers
const handleListManagers = requireAuth((req, res, manager) => {
  if (manager.role === "superadmin") {
    // Superadmin : liste complète avec rôle et date
    const managers = getDb()
      .prepare("SELECT id, username, role, created_at FROM managers ORDER BY created_at ASC")
      .all() as { id: string; username: string; role: string; created_at: number }[]
    return json(res, 200, { managers })
  } else {
    // Manager simple : juste id + username pour le partage
    const managers = getDb()
      .prepare("SELECT id, username FROM managers ORDER BY username ASC")
      .all() as { id: string; username: string }[]
    return json(res, 200, { managers })
  }
})

// POST /api/managers
const handleCreateManager = requireSuperadmin(async (req, res, caller) => {
  const body = parseJson(await readBody(req))
  const username = (body?.username as string | undefined)?.trim()
  const password = body?.password as string | undefined
  const role = (body?.role as string | undefined) ?? "manager"

  if (!username || !password) {
    return json(res, 400, { error: "username and password are required" })
  }
  if (username.length < 3 || username.length > 32) {
    return json(res, 400, { error: "username must be between 3 and 32 characters" })
  }
  if (password.length < 8) {
    return json(res, 400, { error: "password must be at least 8 characters" })
  }
  if (!["superadmin", "manager"].includes(role)) {
    return json(res, 400, { error: "role must be superadmin or manager" })
  }

  const existing = getDb()
    .prepare("SELECT id FROM managers WHERE username = ?")
    .get(username)
  if (existing) return json(res, 409, { error: "Username already taken" })

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  const id = randomUUID()

  getDb()
    .prepare("INSERT INTO managers (id, username, password_hash, role) VALUES (?, ?, ?, ?)")
    .run(id, username, passwordHash, role)

  audit("manager_created", caller.id, getIp(req), `new_manager=${username}`)

  return json(res, 201, { id, username, role })
})

// PUT /api/managers/:id
const handleUpdateManager = requireSuperadmin(async (req, res, caller) => {
  const id = extractParam(req.url!, "/api/managers/", 1)
  if (!id) return json(res, 400, { error: "Missing id" })

  const target = getDb()
    .prepare("SELECT id, username, role FROM managers WHERE id = ?")
    .get(id) as { id: string; username: string; role: string } | undefined

  if (!target) return json(res, 404, { error: "Manager not found" })

  const body = parseJson(await readBody(req))
  const username = (body?.username as string | undefined)?.trim()
  const password = body?.password as string | undefined
  const role = body?.role as string | undefined

  if (username !== undefined) {
    if (username.length < 3 || username.length > 32) {
      return json(res, 400, { error: "username must be between 3 and 32 characters" })
    }
    const conflict = getDb()
      .prepare("SELECT id FROM managers WHERE username = ? AND id != ?")
      .get(username, id)
    if (conflict) return json(res, 409, { error: "Username already taken" })
  }

  if (role !== undefined && !["superadmin", "manager"].includes(role)) {
    return json(res, 400, { error: "role must be superadmin or manager" })
  }

  if (password !== undefined && password.length < 8) {
    return json(res, 400, { error: "password must be at least 8 characters" })
  }

  // Build update
  const updates: string[] = []
  const params: unknown[] = []

  if (username !== undefined) { updates.push("username = ?"); params.push(username) }
  if (role !== undefined) { updates.push("role = ?"); params.push(role) }
  if (password !== undefined) {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    updates.push("password_hash = ?"); params.push(hash)
  }

  if (updates.length === 0) return json(res, 400, { error: "Nothing to update" })

  params.push(id)
  getDb()
    .prepare(`UPDATE managers SET ${updates.join(", ")} WHERE id = ?`)
    .run(...params)

  audit("manager_updated", caller.id, getIp(req), `target_id=${id}`)

  return json(res, 200, { ok: true })
})

// DELETE /api/managers/:id
const handleDeleteManager = requireSuperadmin((req, res, caller) => {
  const id = extractParam(req.url!, "/api/managers/", 1)
  if (!id) return json(res, 400, { error: "Missing id" })

  if (id === caller.id) return json(res, 400, { error: "Cannot delete yourself" })

  const target = getDb()
    .prepare("SELECT id FROM managers WHERE id = ?")
    .get(id)

  if (!target) return json(res, 404, { error: "Manager not found" })

  getDb().prepare("DELETE FROM managers WHERE id = ?").run(id)
  audit("manager_deleted", caller.id, getIp(req), `target_id=${id}`)

  return json(res, 200, { ok: true })
})

// ============================================================
// --- Handlers Résultats ---
// ============================================================

// GET /api/results
const handleListResults = requireAuth((req, res, manager) => {
  const results = listResultsMeta(manager.id, manager.role)
  return json(res, 200, { results })
})

// GET /api/results/:id
const handleGetResult = requireAuth((req, res, manager) => {
  const id = extractParam(req.url!, "/api/results/", 1)
  if (!id) return json(res, 400, { error: "Missing id" })

  const row = getResultRowDb(id)
  if (!row) return json(res, 404, { error: "Result not found" })
  if (!canReadResult(row, manager.id, manager.role))
    return json(res, 403, { error: "Forbidden" })

  const data = getResultDb(id)
  return json(res, 200, {
    ...data,
    visibility: row.visibility,
    shared_with: JSON.parse(row.shared_with) as string[],
    owner_id: row.owner_id,
  })
})

// DELETE /api/results/:id
const handleDeleteResult = requireAuth((req, res, manager) => {
  const id = extractParam(req.url!, "/api/results/", 1)
  if (!id) return json(res, 400, { error: "Missing id" })

  const row = getResultRowDb(id)
  if (!row) return json(res, 404, { error: "Result not found" })
  if (!canWriteResult(row, manager.id, manager.role))
    return json(res, 403, { error: "Forbidden" })

  deleteResultDb(id)
  audit("result_deleted", manager.id, getIp(req), `result_id=${id}`)
  return json(res, 200, { ok: true })
})

// PATCH /api/quizzes/:id/visibility
const handleUpdateQuizVisibility = requireAuth(async (req, res, manager) => {
  const id = extractParam(req.url!, "/api/quizzes/", 1)
  if (!id) return json(res, 400, { error: "Missing id" })

  const quiz = getDb()
    .prepare("SELECT * FROM quizzes WHERE id = ?")
    .get(id) as DbQuiz | undefined

  if (!quiz) return json(res, 404, { error: "Quiz not found" })
  if (!canWriteQuiz(quiz, manager.id, manager.role))
    return json(res, 403, { error: "Forbidden" })

  const body = parseJson(await readBody(req))
  const visibility = body?.visibility as string | undefined
  if (!visibility || !["private", "public", "shared"].includes(visibility))
    return json(res, 400, { error: "visibility must be private, public or shared" })

  const sharedWith = Array.isArray(body?.shared_with)
    ? (body.shared_with as string[])
    : []

  getDb()
    .prepare(
      "UPDATE quizzes SET visibility = ?, shared_with = ?, updated_at = unixepoch() WHERE id = ?",
    )
    .run(visibility, JSON.stringify(sharedWith), id)

  audit("quiz_visibility_updated", manager.id, getIp(req), `quiz_id=${id} visibility=${visibility}`)
  return json(res, 200, { ok: true })
})

// PATCH /api/results/:id/visibility
const handleUpdateResultVisibility = requireAuth(async (req, res, manager) => {
  const id = extractParam(req.url!, "/api/results/", 1)
  if (!id) return json(res, 400, { error: "Missing id" })

  const row = getResultRowDb(id)
  if (!row) return json(res, 404, { error: "Result not found" })
  if (!canWriteResult(row, manager.id, manager.role))
    return json(res, 403, { error: "Forbidden" })

  const body = parseJson(await readBody(req))
  const visibility = body?.visibility as string | undefined
  if (!visibility || !["private", "public", "shared"].includes(visibility))
    return json(res, 400, { error: "visibility must be private, public or shared" })

  const sharedWith = Array.isArray(body?.shared_with)
    ? (body.shared_with as string[])
    : []

  updateResultVisibility(id, visibility as "private" | "public" | "shared", sharedWith)
  audit("result_visibility_updated", manager.id, getIp(req), `result_id=${id} visibility=${visibility}`)
  return json(res, 200, { ok: true })
})

// ============================================================
// --- Handlers Branding (superadmin) ---
// ============================================================

const getBrandingPath = (sub = "") => {
  const base = process.env.CONFIG_PATH
    ? resolve(process.env.CONFIG_PATH, "branding")
    : resolve(process.cwd(), "../../config/branding")
  return sub ? join(base, sub) : base
}

const ALLOWED_UPLOAD_FIELDS = [
  "logo", "favicon", "background",
  "answersMusic", "answersSound", "resultsSound", "showSound",
  "boumpSound", "podiumThree", "podiumSecond", "podiumFirst", "podiumSnearRoll",
] as const

type UploadField = (typeof ALLOWED_UPLOAD_FIELDS)[number]

const FIELD_EXTENSIONS: Record<UploadField, string[]> = {
  logo:           [".svg", ".png", ".jpg", ".jpeg", ".webp"],
  favicon:        [".svg", ".png", ".ico"],
  background:     [".png", ".jpg", ".jpeg", ".webp"],
  answersMusic:   [".mp3", ".ogg", ".wav"],
  answersSound:   [".mp3", ".ogg", ".wav"],
  resultsSound:   [".mp3", ".ogg", ".wav"],
  showSound:      [".mp3", ".ogg", ".wav"],
  boumpSound:     [".mp3", ".ogg", ".wav"],
  podiumThree:    [".mp3", ".ogg", ".wav"],
  podiumSecond:   [".mp3", ".ogg", ".wav"],
  podiumFirst:    [".mp3", ".ogg", ".wav"],
  podiumSnearRoll:[".mp3", ".ogg", ".wav"],
}

const readBrandingTheme = (): Record<string, unknown> => {
  const path = getBrandingPath("theme.json")
  if (!fs.existsSync(path)) return {}
  try {
    return JSON.parse(fs.readFileSync(path, "utf-8")) as Record<string, unknown>
  } catch {
    return {}
  }
}

const writeBrandingTheme = (data: Record<string, unknown>): void => {
  const dir = getBrandingPath()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getBrandingPath("theme.json"), JSON.stringify(data, null, 2))
}

// GET /api/branding
const handleGetBranding = requireAuth((_req, res) => {
  return json(res, 200, { theme: readBrandingTheme() })
})

// PATCH /api/branding
const handlePatchBranding = requireSuperadmin(async (req, res, manager) => {
  const body = parseJson(await readBody(req))
  if (!body) return json(res, 400, { error: "Invalid JSON" })

  const current = readBrandingTheme()

  // Fusionner le patch : les valeurs string vides suppriment le champ (réinitialisation)
  for (const [key, value] of Object.entries(body)) {
    if (value === "" || value === null) {
      delete current[key]
    } else {
      current[key] = value as unknown
    }
  }

  writeBrandingTheme(current)
  audit("branding_updated", manager.id, getIp(req))
  return json(res, 200, { ok: true, theme: current })
})

// POST /api/branding/upload/:field
const handleBrandingUpload = requireSuperadmin(async (req, res, manager) => {
  const field = extractParam(req.url!, "/api/branding/upload/", 1) as UploadField | null
  if (!field || !ALLOWED_UPLOAD_FIELDS.includes(field)) {
    return json(res, 400, { error: "Invalid field" })
  }

  // Lire le nom de fichier depuis Content-Disposition ou X-Filename
  const rawFilename =
    (req.headers["x-filename"] as string | undefined) ?? `${field}.bin`
  const ext = extname(rawFilename).toLowerCase()
  const allowed = FIELD_EXTENSIONS[field]
  if (!allowed.includes(ext)) {
    return json(res, 400, { error: `Extension non autorisée pour ${field}. Acceptées : ${allowed.join(", ")}` })
  }

  // Lire le corps binaire
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", resolve)
    req.on("error", reject)
  })
  const buffer = Buffer.concat(chunks)

  // Limite configurable via MAX_UPLOAD_SIZE (défaut : 10 Mo)
  const maxUploadBytes = parseInt(process.env.MAX_UPLOAD_SIZE ?? "10", 10) * 1024 * 1024
  if (buffer.byteLength > maxUploadBytes) {
    const maxMb = process.env.MAX_UPLOAD_SIZE ?? "10"
    return json(res, 413, { error: `Fichier trop volumineux (max ${maxMb} Mo)` })
  }

  const dir = getBrandingPath()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const filename = `${field}${ext}`
  fs.writeFileSync(join(dir, filename), buffer)

  // Mettre à jour theme.json avec le chemin public
  const publicPath = `/branding/${filename}`
  const current = readBrandingTheme()

  // Les sons vont sous current.audio.*
  const audioFields: UploadField[] = [
    "answersMusic", "answersSound", "resultsSound", "showSound",
    "boumpSound", "podiumThree", "podiumSecond", "podiumFirst", "podiumSnearRoll",
  ]
  if (audioFields.includes(field)) {
    current.audio = {
      ...((current.audio as Record<string, unknown>) ?? {}),
      [field]: publicPath,
    }
  } else {
    current[field] = publicPath
  }

  writeBrandingTheme(current)
  audit("branding_upload", manager.id, getIp(req), `field=${field} file=${filename}`)
  return json(res, 200, { ok: true, path: publicPath, theme: current })
})

// DELETE /api/branding/field/:field — remet un champ à sa valeur par défaut
const handleBrandingResetField = requireSuperadmin(async (req, res, manager) => {
  const field = extractParam(req.url!, "/api/branding/field/", 1)
  if (!field) return json(res, 400, { error: "Missing field" })

  const current = readBrandingTheme()
  const audioFields = [
    "answersMusic", "answersSound", "resultsSound", "showSound",
    "boumpSound", "podiumThree", "podiumSecond", "podiumFirst", "podiumSnearRoll",
  ]
  if (audioFields.includes(field)) {
    const audio = (current.audio as Record<string, unknown>) ?? {}
    delete audio[field]
    if (Object.keys(audio).length === 0) {
      delete current.audio
    } else {
      current.audio = audio
    }
  } else {
    delete current[field]
  }

  writeBrandingTheme(current)
  audit("branding_field_reset", manager.id, getIp(req), `field=${field}`)
  return json(res, 200, { ok: true, theme: current })
})

// POST /api/branding/apply — diffuse BRANDING.RELOAD à tous les clients connectés
const handleBrandingApply = requireSuperadmin((req, res, manager) => {
  if (_io) {
    _io.emit(EVENTS.BRANDING.RELOAD)
    logger.info("Branding reload triggered", { manager: manager.username })
  }
  audit("branding_applied", manager.id, getIp(req))
  return json(res, 200, { ok: true })
})

// Extrait le Nth segment d'un chemin après le préfixe
// ex: extractParam("/api/quizzes/abc123/export", "/api/quizzes/", 1) → "abc123"
const extractParam = (url: string, prefix: string, segment: number): string | null => {
  const path = url.split("?")[0]
  if (!path.startsWith(prefix)) return null
  const rest = path.slice(prefix.length)
  const parts = rest.split("/")
  return parts[segment - 1] ?? null
}

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void

const STATIC_ROUTES: Record<string, Record<string, Handler>> = {
  "/health":                   { GET: handleHealth },
  "/auth/setup":               { POST: handleSetup },
  "/auth/status":              { GET: handleStatus },
  "/auth/login":               { POST: handleLogin },
  "/auth/logout":              { POST: handleLogout },
  "/auth/password":            { PUT: handleChangePassword },
  "/auth/sessions/invalidate": { POST: handleInvalidateOtherSessions },
  "/auth/me":                  { GET: handleMe },
  "/auth/token":               { GET: handleToken },
  "/api/quizzes":              { GET: handleListQuizzes, POST: handleCreateQuiz },
  "/api/quizzes/import":       { POST: handleImportQuiz },
  "/api/managers":             { GET: handleListManagers, POST: handleCreateManager },
  "/api/results":              { GET: handleListResults },
  "/api/branding":             { GET: handleGetBranding, PATCH: handlePatchBranding },
  "/api/branding/apply":       { POST: handleBrandingApply },
}

const resolveHandler = (url: string, method: string): Handler | null => {
  const path = url.split("?")[0]

  // Static routes (exact match)
  if (STATIC_ROUTES[path]?.[method]) return STATIC_ROUTES[path][method]!

  // Dynamic quiz routes: /api/quizzes/:id and /api/quizzes/:id/export|visibility
  if (path.startsWith("/api/quizzes/")) {
    const rest = path.slice("/api/quizzes/".length)
    const [id, sub] = rest.split("/")

    if (id && sub === "export" && method === "GET") return handleExportQuiz
    if (id && sub === "visibility" && method === "PATCH") return handleUpdateQuizVisibility
    if (id && !sub) {
      if (method === "GET") return handleGetQuiz
      if (method === "PUT") return handleUpdateQuiz
      if (method === "DELETE") return handleDeleteQuiz
    }
  }

  // Branding upload/reset: /api/branding/upload/:field et /api/branding/field/:field
  if (path.startsWith("/api/branding/upload/") && method === "POST") return handleBrandingUpload
  if (path.startsWith("/api/branding/field/") && method === "DELETE") return handleBrandingResetField

  // Dynamic results routes: /api/results/:id and /api/results/:id/visibility
  if (path.startsWith("/api/results/")) {
    const rest = path.slice("/api/results/".length)
    const [id, sub] = rest.split("/")

    if (id && sub === "visibility" && method === "PATCH") return handleUpdateResultVisibility
    if (id && !sub) {
      if (method === "GET") return handleGetResult
      if (method === "DELETE") return handleDeleteResult
    }
  }

  // Dynamic manager routes: /api/managers/:id
  if (path.startsWith("/api/managers/")) {
    const rest = path.slice("/api/managers/".length)
    const [id] = rest.split("/")

    if (id && !rest.includes("/", id.length)) {
      if (method === "PUT") return handleUpdateManager
      if (method === "DELETE") return handleDeleteManager
    }
  }

  return null
}

export const createHttpServer = () => {
  // Migrer la table quizzes au démarrage
  migrateQuizzesTable()

  const server = createServer(async (req, res) => {
    // CORS headers pour le frontend
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    res.setHeader("Access-Control-Allow-Credentials", "true")

    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    const url = req.url ?? "/"
    const method = req.method ?? "GET"
    const handler = resolveHandler(url, method)

    if (!handler) {
      return json(res, 404, { error: "Not found" })
    }

    try {
      await handler(req, res)
    } catch (err) {
      logger.error("HTTP handler error", { error: String(err) })
      json(res, 500, { error: "Internal server error" })
    }
  })

  return server
}
