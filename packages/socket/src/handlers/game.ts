import { EVENTS } from "@razzia/common/constants"
import logger from "@razzia/socket/services/logger"
import { inviteCodeValidator } from "@razzia/common/validators/auth"
import type { QuizzWithId } from "@razzia/common/types/game"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { getQuizz } from "@razzia/socket/services/config"
import { getDb } from "@razzia/socket/services/database"
import Game from "@razzia/socket/services/game"
import manager from "@razzia/socket/services/manager"
import Registry from "@razzia/socket/services/registry"
import { withGame } from "@razzia/socket/utils/game"
import { getClientId } from "@razzia/socket/utils/socket"

/** Cherche un quiz par id dans SQLite d'abord, puis dans config/quizz/ en fallback */
const findQuizz = (quizzId: string): QuizzWithId | undefined => {
  // 1. SQLite (quiz créés via dashboard)
  try {
    const row = getDb()
      .prepare("SELECT id, subject, questions FROM quizzes WHERE id = ?")
      .get(quizzId) as { id: string; subject: string; questions: string } | undefined

    if (row) {
      return {
        id: row.id,
        subject: row.subject,
        questions: JSON.parse(row.questions),
      }
    }
  } catch {
    // DB pas encore initialisée ou table absente — on continue vers les fichiers
  }

  // 2. Fichiers config/quizz/ (quiz legacy)
  return getQuizz().find((q) => q.id === quizzId)
}

export const gameSocketHandlers = ({ io, socket }: SocketContext) => {
  const registry = Registry.getInstance()
  const clientId = getClientId(socket)

  const handleManagerLeave = (game: Game) => {
    game.setManagerDisconnected()
    registry.markGameAsEmpty(game)

    if (!game.started) {
      game.abortCooldown()
      io.to(game.gameId).emit(
        EVENTS.GAME.RESET,
        "errors:game.managerDisconnected",
      )
      registry.removeGame(game.gameId)
    }
  }

  const handlePlayerLeave = (game: Game) => {
    if (!game.started) {
      const player = game.removePlayer(socket.id)

      if (player) {
        logger.info("Player left game", { player: player.username, gameId: game.gameId })
      }

      return
    }

    game.setPlayerDisconnected(socket.id)
  }

  socket.on(EVENTS.PLAYER.RECONNECT, ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "errors:game.notFound")
  })

  socket.on(EVENTS.MANAGER.RECONNECT, ({ gameId }) => {
    const game = registry.getManagerGame(gameId, clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "errors:game.expired")
  })

  socket.on(
    EVENTS.GAME.CREATE,
    manager.withAuth(socket, (quizzId: string) => {
      const quizz = findQuizz(quizzId)

      if (!quizz) {
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:quizz.notFound")

        return
      }

      const game = new Game(io, socket, quizz)
      registry.addGame(game)
    }),
  )

  socket.on(EVENTS.PLAYER.CHECK_PIN, (inviteCode) => {
    const game = registry.getGameByInviteCode(inviteCode)

    socket.emit(EVENTS.PLAYER.CHECK_PIN_RESULT, { valid: Boolean(game) })
  })

  socket.on(EVENTS.PLAYER.JOIN, (inviteCode) => {
    const result = inviteCodeValidator.safeParse(inviteCode)

    if (result.error) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, result.error.issues[0].message)

      return
    }

    const game = registry.getGameByInviteCode(inviteCode)

    if (!game) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.notFound")

      return
    }

    if (game.manager.clientId === clientId) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.managerCannotJoin")

      return
    }

    if (game.players.some((p) => p.clientId === clientId)) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.SUCCESS_ROOM, game.gameId)
  })

  socket.on(EVENTS.PLAYER.LOGIN, ({ gameId, data }) =>
    withGame(gameId, socket, (game) => game.join(socket, data.username, data.avatar)),
  )

  socket.on(EVENTS.MANAGER.KICK_PLAYER, ({ gameId, playerId }) =>
    withGame(gameId, socket, (game) => game.kickPlayer(socket, playerId)),
  )

  socket.on(EVENTS.MANAGER.START_GAME, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.start(socket)),
  )

  socket.on(EVENTS.PLAYER.REQUEST_PLAYER_LIST, ({ gameId }) =>
    withGame(gameId, socket, (game) => {
      socket.emit(
        EVENTS.GAME.PLAYER_LIST,
        game.getPlayers().map((p) => ({ id: p.id, username: p.username, avatar: p.avatar })),
      )
    }),
  )

  socket.on(EVENTS.PLAYER.UPDATE_AVATAR, ({ gameId, avatar }) =>
    withGame(gameId, socket, (game) => game.updateAvatar(socket, avatar)),
  )

  socket.on(EVENTS.PLAYER.SELECTED_ANSWER, ({ gameId, data }) =>
    withGame(gameId, socket, (game) =>
      game.selectAnswer(socket, data.answerKeys),
    ),
  )

  socket.on(EVENTS.MANAGER.ABORT_QUIZ, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.abortRound(socket)),
  )

  socket.on(EVENTS.MANAGER.NEXT_QUESTION, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.nextRound(socket)),
  )

  socket.on(EVENTS.MANAGER.SHOW_LEADERBOARD, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.showLeaderboard(socket)),
  )

  socket.on(EVENTS.MANAGER.LEAVE, ({ gameId }) => {
    const game = registry.getManagerGame(gameId, clientId)

    if (game) {
      logger.info("Manager left game", { inviteCode: game.inviteCode })
      handleManagerLeave(game)
    }
  })

  socket.on(EVENTS.PLAYER.LEAVE, ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, clientId)

    if (game) {
      handlePlayerLeave(game)
    }
  })

  socket.on("disconnect", () => {
    logger.info("User disconnected", { socketId: socket.id })

    const managerGame = registry.getGameByManagerSocketId(socket.id)

    if (managerGame) {
      logger.info("Manager disconnected from game", { inviteCode: managerGame.inviteCode })
      handleManagerLeave(managerGame)

      return
    }

    const playerGame = registry.getGameByPlayerSocketId(socket.id)

    if (playerGame) {
      handlePlayerLeave(playerGame)
    }
  })
}
