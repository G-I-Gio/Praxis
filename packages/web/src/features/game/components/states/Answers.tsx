import { EVENTS, MEDIA_TYPES, NO_TIME_LIMIT } from "@razzia/common/constants"
import type { QuestionMediaType } from "@razzia/common/types/game"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import Avatar from "@razzia/web/features/game/components/Avatar"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { getSFX } from "@razzia/web/features/game/utils/constants"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

interface Props {
  data: CommonStatusDataMap["SELECT_ANSWER"]
}

const Answers = ({
  data: { question, answers, media, time, totalPlayer, questionType, options },
}: Props) => {
  const SFX = getSFX()
  const { socket } = useSocket()
  const { player, gameId, answeredPlayers, addAnsweredPlayer } = usePlayerStore()

  const [cooldown, setCooldown] = useState(time)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const { t } = useTranslation()

  const [sfxPop] = useSound(SFX.ANSWERS.SOUND, {
    volume: 0.1,
  })

  const [playMusic, { stop: stopMusic }] = useSound(SFX.ANSWERS.MUSIC, {
    volume: 0.2,
    interrupt: true,
    loop: true,
  })

  const handleSubmit = (answerKeys: number[]) => {
    if (!player || !gameId) {
      return
    }

    socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId,
      data: {
        answerKeys,
      },
    })
    sfxPop()
  }

  useEffect(() => {
    const disabledMusicMedia: QuestionMediaType[] = [
      MEDIA_TYPES.AUDIO,
      MEDIA_TYPES.VIDEO,
    ]

    if (disabledMusicMedia.includes(media?.type)) {
      return
    }

    playMusic()

    return () => {
      stopMusic()
    }
    // oxlint-disable-next-line
  }, [playMusic])

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    setCooldown(sec)
  })

  useEvent(EVENTS.GAME.PLAYER_ANSWER, (count) => {
    setTotalAnswer(count)
    sfxPop()
  })

  useEvent(EVENTS.GAME.PLAYER_ANSWERED, (p) => {
    addAnsweredPlayer(p)
  })

  const { AnswerComponent } = QUESTION_REGISTRY[questionType]

  return (
    <div className="flex h-full flex-1 flex-col justify-between">
      <div className="mx-auto inline-flex h-full w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5">
        <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
          {question}
        </h2>

        <QuestionMedia media={media} alt={question} />
      </div>

      <div>
        <div className="mx-auto mb-4 flex w-full max-w-7xl items-end justify-between gap-1 px-2 text-lg font-bold text-white md:text-xl">
          {time !== NO_TIME_LIMIT && (
            <div className="flex shrink-0 flex-col items-center rounded-lg bg-black/40 px-4 text-lg font-bold">
              <span className="translate-y-1 text-sm">
                {t("game:hud.time")}
              </span>
              <span className="tabular-nums">{cooldown}</span>
            </div>
          )}
          <div className="flex flex-col items-center rounded-lg bg-black/40 px-3 py-2">
            <span className="mb-1 text-sm font-bold">
              {totalAnswer}/{totalPlayer}
            </span>
            <div className="flex flex-wrap gap-1">
				{answeredPlayers.map((p) => (
				<div key={p.id} className="flex flex-col items-center">
					<Avatar username={p.username} avatar={p.avatar} size="sm" />
					<span className="text-xs">{p.username}</span>
				</div>
				))}
			</div>
          </div>
        </div>

        <AnswerComponent
          answers={answers}
          options={options}
          onSubmit={handleSubmit}
          readOnly={!player}
        />
      </div>
    </div>
  )
}

export default Answers
