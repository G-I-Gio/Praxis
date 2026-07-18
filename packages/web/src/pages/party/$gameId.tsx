import { EVENTS } from "@razzia/common/constants"
import GameWrapper from "@razzia/web/features/game/components/GameWrapper"
import {
  socketClient,
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import {
  GAME_STATE_COMPONENTS,
  isKeyOf,
} from "@razzia/web/features/game/utils/constants"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { useEffect } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const PlayerGamePage = () => {
  const navigate = useNavigate()
  const { socket } = useSocket()
  const { gameId: gameIdParam } = useParams({ from: "/party/$gameId" })
  const {
    status, setPlayer, setGameId, setStatus, reset,
    setPlayers, addOrUpdatePlayer,
    setAnsweredPlayers, addAnsweredPlayer,
  } = usePlayerStore()
  const { setQuestionStates } = useQuestionStore()
  const { t } = useTranslation()

  // Demander la liste des joueurs dès le montage du composant
  useEffect(() => {
    if (gameIdParam) {
      socket.emit(EVENTS.PLAYER.REQUEST_PLAYER_LIST, { gameId: gameIdParam })
    }
  }, [gameIdParam, socket])

  useEvent("connect", () => {
    if (gameIdParam) {
      socket.emit(EVENTS.PLAYER.RECONNECT, { gameId: gameIdParam })
    }
  })

  useEvent(EVENTS.PLAYER.SUCCESS_RECONNECT, ({
    gameId: reconnectGameId, status: reconnectStatus, player, currentQuestion,
  }) => {
    setGameId(reconnectGameId)
    setStatus(reconnectStatus.name, reconnectStatus.data)
    setPlayer(player)
    setQuestionStates(currentQuestion)
  })

  useEvent(EVENTS.GAME.STATUS, ({ name, data }) => {
    if (name in GAME_STATE_COMPONENTS) {
      setStatus(name, data)
      if (name === "SELECT_ANSWER") {
        setAnsweredPlayers([])
      }
    }
  })

  useEvent(EVENTS.GAME.RESET, (message) => {
    localStorage.removeItem("game_pin")
    navigate({ to: "/" })
    reset()
    setQuestionStates(null)
    toast.error(t(message))
  })

  useEvent(EVENTS.GAME.PLAYER_LIST, (list) => {
    setPlayers(list)
  })

  useEvent(EVENTS.GAME.PLAYER_JOINED, (player) => {
    addOrUpdatePlayer(player)
  })

  useEvent(EVENTS.GAME.PLAYER_ANSWERED, (player) => {
    addAnsweredPlayer(player)
  })

  if (!gameIdParam) return null

  const CurrentComponent =
    status && isKeyOf(GAME_STATE_COMPONENTS, status.name)
      ? GAME_STATE_COMPONENTS[status.name]
      : null

  if (!status) return null

  return (
    <GameWrapper statusName={status.name}>
      {CurrentComponent && <CurrentComponent data={status.data as never} />}
    </GameWrapper>
  )
}

export const Route = createFileRoute("/party/$gameId")({
  component: PlayerGamePage,
  onLeave: ({ params: { gameId } }) => {
    socketClient.emit(EVENTS.PLAYER.LEAVE, { gameId })
  },
})
