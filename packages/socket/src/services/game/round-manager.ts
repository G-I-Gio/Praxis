// oxlint-disable typescript/no-unnecessary-condition
import { EVENTS, MEDIA_TYPES, NO_TIME_LIMIT } from "@razzia/common/constants"
import type {
  Answer,
  GameResult,
  Player,
  Question,
  QuestionResult,
  Quizz,
} from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import {
  type Status,
  STATUS,
  type StatusDataMap,
} from "@razzia/common/types/game/status"
import { CooldownTimer } from "@razzia/socket/services/game/cooldown-timer"
import { PlayerManager } from "@razzia/socket/services/game/player-manager"
import { QUESTION_SCORING } from "@razzia/socket/services/scoring"
import { orderToPoint, timeToPoint } from "@razzia/socket/utils/game"
import sleep from "@razzia/socket/utils/sleep"
import { nanoid } from "nanoid"

type BroadcastFn = <T extends Status>(
  _status: T,
  _data: StatusDataMap[T],
) => void
type SendFn = <T extends Status>(
  _target: string,
  _status: T,
  _data: StatusDataMap[T],
) => void

export interface RoundManagerOptions {
  quizz: Quizz
  players: PlayerManager
  cooldown: CooldownTimer
  io: Server
  gameId: string
  getManagerId: () => string
  broadcast: BroadcastFn
  send: SendFn
  onNewQuestion: () => void
  onGameFinished: (_result: GameResult) => void
}

export class RoundManager {
  private readonly opts: RoundManagerOptions
  private started = false
  private currentQuestion = 0
  private playersAnswers: Answer[] = []
  private startTime = 0
  private leaderboard: Player[] = []
  private tempOldLeaderboard: Player[] | null = null
  private questionsHistory: QuestionResult[] = []

  constructor(opts: RoundManagerOptions) {
    this.opts = opts
  }

  isStarted(): boolean {
    return this.started
  }

  getReconnectInfo() {
    return {
      current: this.currentQuestion + 1,
      total: this.opts.quizz.questions.length,
    }
  }

  async start(socket: Socket): Promise<void> {
    if (this.opts.getManagerId() !== socket.id) {
      return
    }

    if (this.started) {
      return
    }

    if (this.opts.players.count() === 0) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.noPlayersConnected")

      return
    }

    this.started = true

    this.opts.broadcast(STATUS.SHOW_START, {
      time: 3,
      subject: this.opts.quizz.subject,
    })

    await sleep(3)

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.START_COOLDOWN)
    await this.opts.cooldown.start(3)

    void this.newQuestion()
  }

  async newQuestion(): Promise<void> {
    if (!this.started) {
      return
    }

    const question = this.opts.quizz.questions[this.currentQuestion]

    this.opts.onNewQuestion()

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.UPDATE_QUESTION, {
      current: this.currentQuestion + 1,
      total: this.opts.quizz.questions.length,
    })

    this.opts.broadcast(STATUS.SHOW_PREPARED, {
      totalAnswers: question.answers.length,
      questionNumber: this.currentQuestion + 1,
    })

    await sleep(2)

    if (!this.started) {
      return
    }

    const imageMedia =
      question.media?.type === MEDIA_TYPES.IMAGE ? question.media : undefined

    this.opts.broadcast(STATUS.SHOW_QUESTION, {
      question: question.question,
      media: imageMedia,
      cooldown: question.cooldown,
    })

    await sleep(question.cooldown)

    if (!this.started) {
      return
    }

    this.startTime = Date.now()

    this.opts.broadcast(STATUS.SELECT_ANSWER, {
      question: question.question,
      answers: question.answers,
      media: question.media,
      time: question.time,
      totalPlayer: this.opts.players.count(),
      questionType: question.type,
      options: question.options,
    })

    await this.opts.cooldown.start(question.time)

    if (!this.started) {
      return
    }

    this.showResults(question)
  }

  private showResults(question: Question): void {
    const currentPlayers = this.opts.players.getAll()

    const oldLeaderboard = (() => {
      if (this.leaderboard.length === 0) {
        return currentPlayers.map((p) => ({ ...p }))
      }

      return this.leaderboard.map((p) => ({ ...p }))
    })()

    const answerCounts = this.playersAnswers
      .flatMap(({ answerIds }) => answerIds)
      .reduce<Record<number, number>>((acc, id) => {
        acc[id] = (acc[id] ?? 0) + 1

        return acc
      }, {})

    const sortedPlayers = currentPlayers
      .map((player) => {
        const playerAnswer = this.playersAnswers.find(
          (a) => a.playerId === player.id,
        )

        const scoreMultiplier = (() => {
          if (!playerAnswer) {
            return 0
          }

          const scoring = QUESTION_SCORING[question.type]

          return scoring(question, playerAnswer.answerIds)
        })()

        const points = Math.round((playerAnswer?.points ?? 0) * scoreMultiplier)
        const isCorrect = points > 0
        const penalty = !isCorrect && playerAnswer ? (question.penalty ?? 0) : 0

        const pointsBefore = player.points
        const gained = isCorrect ? points : -penalty
        player.points = Math.max(0, pointsBefore + gained)
        player.streak = isCorrect ? player.streak + 1 : 0

        return {
          ...player,
          lastCorrect: isCorrect,
          lastPoints: gained,
          pointsBefore,
        }
      })
      .sort((a, b) => b.points - a.points)

    this.opts.players.replace(sortedPlayers)

    sortedPlayers.forEach((player, index) => {
      const rank = index + 1
      const aheadPlayer = sortedPlayers[index - 1]

      this.opts.send(player.id, STATUS.SHOW_RESULT, {
        correct: player.lastCorrect,
        message: player.lastCorrect ? "game:correct" : "game:wrong",
        points: player.lastPoints,
        myPoints: player.points,
        rank,
        aheadOfMe: aheadPlayer ? aheadPlayer.username : null,
      })
    })

    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
      ...question,
      responses: answerCounts,
    })

    const leaderboardSnapshot = sortedPlayers.map((p, i) => ({
      username: p.username,
      pointsAfter: p.points,
      pointsGained: p.lastPoints ?? 0,
      rank: i + 1,
    }))

    this.questionsHistory.push({
      ...question,
      playerAnswers: currentPlayers.map((player) => {
        const pa = this.playersAnswers.find((a) => a.playerId === player.id)
        return {
          playerName: player.username,
          answerIds: pa?.answerIds ?? null,
          responseTime: pa?.responseTime ?? null,
        }
      }),
      leaderboardSnapshot,
    })

    this.leaderboard = sortedPlayers
    this.tempOldLeaderboard = oldLeaderboard
    this.playersAnswers = []
  }

  selectAnswer(socket: Socket, answerIds: number[]): void {
    const player = this.opts.players.findById(socket.id)
    const question = this.opts.quizz.questions[this.currentQuestion]

    if (!player) {
      return
    }

    if (this.playersAnswers.find((a) => a.playerId === socket.id)) {
      return
    }

    const points = (() => {
      if (question.time === NO_TIME_LIMIT) {
        return orderToPoint(
          this.playersAnswers.length,
          this.opts.players.count(),
          question.maxPoints,
        )
      }

      return timeToPoint(this.startTime, question)
    })()

    const responseTime = Date.now() - this.startTime

    this.playersAnswers.push({
      playerId: player.id,
      answerIds,
      points,
      responseTime,
    })

    this.opts.send(socket.id, STATUS.WAIT, {
      text: "game:waitingForAnswers",
    })

    const answeredPlayer = this.opts.players.findById(socket.id)
    // Broadcast le count au manager (comportement existant)
    socket
      .to(this.opts.gameId)
      .emit(EVENTS.GAME.PLAYER_ANSWER, this.playersAnswers.length)
    // Broadcast les infos du joueur ayant répondu à toute la room
    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.PLAYER_ANSWERED, {
      id: socket.id,
      username: answeredPlayer?.username ?? "",
      avatar: answeredPlayer?.avatar,
    })
    this.opts.players.broadcastCount()

    if (this.playersAnswers.length === this.opts.players.count()) {
      this.opts.cooldown.abort()
    }
  }

  nextQuestion(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    if (!this.opts.quizz.questions[this.currentQuestion + 1]) {
      return
    }

    this.currentQuestion += 1
    void this.newQuestion()
  }

  abortQuestion(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    this.opts.cooldown.abort()
  }

  showLeaderboard(socket: Socket): void {
    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    const isLastRound =
      this.currentQuestion + 1 === this.opts.quizz.questions.length

    if (isLastRound) {
      this.started = false

      const top = this.leaderboard.slice(0, 3)

      this.opts.onGameFinished({
        id: `${Date.now()}-${nanoid(8)}`,
        subject: this.opts.quizz.subject,
        date: new Date().toISOString(),
        players: this.leaderboard.map((player, index) => ({
          username: player.username,
          points: player.points,
          rank: index + 1,
        })),
        questions: this.questionsHistory,
      })

      this.opts.send(this.opts.getManagerId(), STATUS.FINISHED, {
        subject: this.opts.quizz.subject,
        top,
      })

      this.leaderboard.forEach((player, index) => {
        this.opts.send(player.id, STATUS.FINISHED, {
          subject: this.opts.quizz.subject,
          top,
          rank: index + 1,
        })
      })

      return
    }

    const oldLeaderboard = this.tempOldLeaderboard ?? this.leaderboard

    const leaderboardData = {
		oldLeaderboard: oldLeaderboard.slice(0, 5),
		leaderboard: this.leaderboard.slice(0, 5),
		}
	this.opts.broadcast(STATUS.SHOW_LEADERBOARD, leaderboardData)

    this.tempOldLeaderboard = null
  }
}
