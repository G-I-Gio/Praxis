import { EVENTS } from "@razzia/common/constants"
import type { PlayerStatusDataMap } from "@razzia/common/types/game/status"
import Loader from "@razzia/web/components/Loader"
import Avatar from "@razzia/web/features/game/components/Avatar"
import AvatarPicker from "@razzia/web/features/game/components/AvatarPicker"
import { useSocket } from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  data: PlayerStatusDataMap["WAIT"]
}

const Wait = ({ data: { text } }: Props) => {
  const { t } = useTranslation()
  const { socket } = useSocket()
  const { player, gameId, setAvatar, players, addOrUpdatePlayer } = usePlayerStore()
  const [showPicker, setShowPicker] = useState(false)

  const isLobby = text === "game:waitingForPlayers"

  useEffect(() => {
    if (!isLobby) setShowPicker(false)
  }, [isLobby])

  const handleSelectAvatar = (avatar: string | undefined) => {
    // Fermer le picker EN PREMIER pour éviter tout re-render intermédiaire
    setShowPicker(false)
    // Mettre à jour le store
    setAvatar(avatar)
    // Mettre à jour sa propre entrée dans la liste via getState() pour éviter closure stale
    const currentPlayers = usePlayerStore.getState().players
    const currentPlayer = usePlayerStore.getState().player
    if (currentPlayer?.username) {
      const self = currentPlayers.find((p) => p.username === currentPlayer.username)
      if (self) addOrUpdatePlayer({ ...self, avatar })
    }
    // Notifier le serveur
    if (gameId) {
      socket.emit(EVENTS.PLAYER.UPDATE_AVATAR, { gameId, avatar })
    }
  }

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-6 px-4">

      {isLobby && player && (
        <div className="flex flex-col items-center gap-2">
          <button type="button" onClick={() => setShowPicker(!showPicker)} className="relative">
            <Avatar username={player.username ?? "?"} avatar={player.avatar} size="lg" />
            <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-white text-xs shadow">
              ✏️
            </span>
          </button>
          <p className="text-lg font-bold text-white drop-shadow">{player.username}</p>
        </div>
      )}

      {isLobby && showPicker && (
        <div className="w-full max-w-xs rounded-xl bg-black/60 p-3">
          <AvatarPicker selected={player?.avatar} onSelect={handleSelectAvatar} />
        </div>
      )}

      <Loader className="h-20" />
      <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl">
        {t(text)}
      </h2>

      {isLobby && players.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4">
          {players.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-1">
              <Avatar username={p.username} avatar={p.avatar} size="md" />
              <span className="max-w-16 truncate text-center text-xs font-semibold text-white drop-shadow">
                {p.username}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default Wait
