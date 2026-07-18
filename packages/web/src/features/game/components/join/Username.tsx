import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import Avatar from "@razzia/web/features/game/components/Avatar"
import AvatarPicker from "@razzia/web/features/game/components/AvatarPicker"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useNavigate } from "@tanstack/react-router"
import { type KeyboardEvent, useState } from "react"
import { useTranslation } from "react-i18next"

const Username = () => {
  const { socket } = useSocket()
  const { gameId, login, setStatus, setAvatar, setPlayers } = usePlayerStore()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [selectedAvatar, setSelectedAvatar] = useState<string | undefined>()
  const [showPicker, setShowPicker] = useState(false)
  const { t } = useTranslation()

  const handleLogin = () => {
    if (!gameId) return
    socket.emit(EVENTS.PLAYER.LOGIN, { gameId, data: { username, avatar: selectedAvatar } })
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") handleLogin()
  }

  const handleSelectAvatar = (avatar: string | undefined) => {
    setSelectedAvatar(avatar)
    setShowPicker(false)
  }

  useEvent(EVENTS.GAME.PLAYER_LIST, (list) => {
    setPlayers(list)
  })

  useEvent(EVENTS.GAME.SUCCESS_JOIN, (joinedGameId) => {
    setStatus(STATUS.WAIT, { text: "game:waitingForPlayers" })
    login(username)
    setAvatar(selectedAvatar)
    navigate({ to: "/party/$gameId", params: { gameId: joinedGameId } })
  })

  return (
    <Card className="max-w-sm w-full overflow-visible">
      {/* Avatar + bouton toujours visible */}
      <div className="mb-4 flex flex-col items-center gap-2">
        <div className="relative">
          <Avatar username={username || "?"} avatar={selectedAvatar} size="lg" />
          <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-white text-xs shadow">
            ✏️
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="rounded-full bg-black/20 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-black/30"
        >
          {showPicker
            ? t("common:cancel", "Annuler")
            : selectedAvatar
              ? t("game:changeAvatar", "Changer")
              : t("game:chooseAvatar", "Choisir un avatar")}
        </button>
      </div>

      {/* Picker inline dans la Card */}
      {showPicker && (
        <div className="mb-4 rounded-xl bg-black/20 p-2">
          <AvatarPicker selected={selectedAvatar} onSelect={handleSelectAvatar} />
        </div>
      )}

      <Input
        className="text-center"
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("game:usernamePlaceholder")}
      />
      <Button className="mt-4" onClick={handleLogin}>
        {t("common:submit")}
      </Button>
    </Card>
  )
}

export default Username
