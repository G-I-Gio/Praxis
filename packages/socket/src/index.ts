import type { Server } from "@razzia/common/types/game/socket"
import { gameSocketHandlers } from "@razzia/socket/handlers/game"
import { managerSocketHandlers } from "@razzia/socket/handlers/manager"
import { quizzSocketHandlers } from "@razzia/socket/handlers/quizz"
import { resultsSocketHandlers } from "@razzia/socket/handlers/results"
import type { SocketHandler } from "@razzia/socket/handlers/types"
import { initConfig } from "@razzia/socket/services/config"
import {
  closeDatabase,
  initDatabase,
  isSetupDone,
  purgeExpiredSessions,
} from "@razzia/socket/services/database"
import { setCheck, setShuttingDown } from "@razzia/socket/services/health"
import { createHttpServer, setSocketIo } from "@razzia/socket/services/http"
import logger from "@razzia/socket/services/logger"
import Registry from "@razzia/socket/services/registry"
import { Server as ServerIO } from "socket.io"

const PORT = 3001

// ── 1. Configuration ──────────────────────────────────────────────────────────
try {
  initConfig()
  setCheck("config", "ok")
} catch (err) {
  setCheck("config", "error", String(err))
  logger.error("[startup] Échec initConfig", { error: String(err) })
  process.exit(1)
}

// ── 2. Base de données ────────────────────────────────────────────────────────
try {
  initDatabase()
  setCheck("database", "ok", `Setup effectué : ${isSetupDone()}`)
} catch (err) {
  setCheck("database", "error", String(err))
  logger.error("[startup] Échec initDatabase", { error: String(err) })
  process.exit(1)
}

// ── 3. Serveur HTTP + Socket.IO ───────────────────────────────────────────────
const httpServer = createHttpServer()
const io: Server = new ServerIO(httpServer, { path: "/ws" })

setSocketIo(io)

httpServer.listen(PORT, () => {
  setCheck("http", "ok", `Port ${PORT}`)
  logger.info("[startup] Serveur HTTP prêt", { port: PORT })
})

// ── 4. Handlers WebSocket ─────────────────────────────────────────────────────
const socketHandlers: SocketHandler[] = [
  managerSocketHandlers,
  quizzSocketHandlers,
  gameSocketHandlers,
  resultsSocketHandlers,
]

io.on("connection", (socket) => {
  socketHandlers.forEach((handler) => handler({ io, socket }))
})

// Socket.IO est prêt dès que les handlers sont enregistrés
setCheck("socket", "ok")
logger.info("[startup] Handlers WebSocket enregistrés — application prête")

// ── Tâches périodiques ────────────────────────────────────────────────────────
setInterval(purgeExpiredSessions, 60 * 60 * 1000)

// ── Arrêt propre ──────────────────────────────────────────────────────────────
const shutdown = (signal: string) => {
  logger.info("[shutdown] Signal reçu — arrêt en cours", { signal })

  // Signaler immédiatement aux reverse proxies que le serveur n'est plus dispo
  setShuttingDown()

  // Laisser le temps aux requêtes en cours de se terminer (10s max)
  const timeout = setTimeout(() => {
    logger.warn("[shutdown] Timeout dépassé — arrêt forcé")
    process.exit(1)
  }, 10_000)

  // Nettoyage
  Registry.getInstance().cleanup()
  closeDatabase()

  httpServer.close(() => {
    clearTimeout(timeout)
    logger.info("[shutdown] Arrêt propre effectué")
    process.exit(0)
  })
}

process.on("SIGINT",  () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))
