import { EVENTS } from "@razzia/common/constants"
import logger from "@razzia/socket/services/logger"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { deleteResult, getResultById } from "@razzia/socket/services/config"
import manager, { emitConfig } from "@razzia/socket/services/manager"

export const resultsSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.RESULTS.GET,
    manager.withAuth(socket, (id) => {
      try {
        socket.emit(EVENTS.RESULTS.DATA, getResultById(id))
      } catch (error) {
        logger.error("Failed to get result", { error: String(error) })
      }
    }),
  )

  socket.on(
    EVENTS.RESULTS.DELETE,
    manager.withAuth(socket, (id) => {
      try {
        deleteResult(id)
        emitConfig(socket)
      } catch (error) {
        logger.error("Failed to delete result", { error: String(error) })
      }
    }),
  )
}
