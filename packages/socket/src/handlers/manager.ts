import { EVENTS } from "@razzia/common/constants"
import logger from "@razzia/socket/services/logger"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { getGameConfig } from "@razzia/socket/services/config"
import { validateSessionToken } from "@razzia/socket/services/http"
import manager, { emitConfig } from "@razzia/socket/services/manager"

export const managerSocketHandlers = ({ socket }: SocketContext) => {
  // Authentification via token de session HTTP (dashboard /manager/dashboard)
  socket.on(EVENTS.MANAGER.AUTH_SESSION, (token: string) => {
    const sessionManager = validateSessionToken(token)

    if (!sessionManager) {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)
      return
    }

    // Stocker l'id SQLite du manager pour usage ultérieur (ex: saveResult)
    ;(socket as unknown as { data: Record<string, unknown> }).data.managerId =
      sessionManager.id

    manager.login(socket)
    emitConfig(socket)
  })

  socket.on(
    EVENTS.MANAGER.GET_CONFIG,
    manager.withAuth(socket, () => {
      emitConfig(socket)
    }),
  )

  socket.on(EVENTS.MANAGER.LOGOUT, () => {
    manager.logout(socket)
  })

  socket.on(EVENTS.MANAGER.AUTH, (password) => {
    try {
      const config = getGameConfig()

      if (config.managerPassword === "PASSWORD") {
        socket.emit(
          EVENTS.MANAGER.ERROR_MESSAGE,
          "errors:manager.passwordNotConfigured",
        )

        return
      }

      if (password !== config.managerPassword) {
        socket.emit(
          EVENTS.MANAGER.ERROR_MESSAGE,
          "errors:manager.invalidPassword",
        )

        return
      }

      manager.login(socket)
      emitConfig(socket)
    } catch (error) {
      logger.error("Failed to read game config", { error: String(error) })
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:failedToReadConfig")
    }
  })
}
