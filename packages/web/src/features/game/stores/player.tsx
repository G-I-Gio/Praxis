import type { StatusDataMap } from "@razzia/common/types/game/status"
import {
  createStatus,
  type Status,
} from "@razzia/web/features/game/utils/createStatus"
import { create } from "zustand"

interface PlayerState {
  username?: string
  points?: number
  avatar?: string
}

export interface PlayerSummary {
  id: string
  username: string
  avatar?: string
}

interface PlayerStore<T> {
  gameId: string | null
  player: PlayerState | null
  status: Status<T> | null
  // Liste des joueurs dans la room
  players: PlayerSummary[]
  // Joueurs ayant déjà répondu à la question en cours
  answeredPlayers: PlayerSummary[]

  setGameId: (_gameId: string | null) => void
  setPlayer: (_state: PlayerState) => void
  login: (_username: string) => void
  join: (_gameId: string) => void
  updatePoints: (_points: number) => void
  setAvatar: (_avatar: string | undefined) => void

  setPlayers: (_players: PlayerSummary[]) => void
  addOrUpdatePlayer: (_player: PlayerSummary) => void
  removePlayer: (_id: string) => void

  setAnsweredPlayers: (_players: PlayerSummary[]) => void
  addAnsweredPlayer: (_player: PlayerSummary) => void

  setStatus: <K extends keyof T>(_name: K, _data: T[K]) => void
  reset: () => void
}

const initialState = {
  gameId: null,
  player: null,
  status: null,
  players: [] as PlayerSummary[],
  answeredPlayers: [] as PlayerSummary[],
}

export const usePlayerStore = create<PlayerStore<StatusDataMap>>((set) => ({
  ...initialState,

  setGameId: (gameId) => set({ gameId }),

  setPlayer: (player) => set({ player }),

  login: (username) =>
    set((state) => ({ player: { ...state.player, username } })),

  join: (gameId) =>
    set((state) => ({ gameId, player: { ...state.player, points: 0 } })),

  updatePoints: (points) =>
    set((state) => ({ player: { ...state.player, points } })),

  setAvatar: (avatar) =>
    set((state) => ({ player: { ...state.player, avatar } })),

  setPlayers: (players) => set({ players }),

  addOrUpdatePlayer: (player) =>
    set((state) => ({
      players: [
        ...state.players.filter((p) => p.id !== player.id),
        player,
      ],
    })),

  removePlayer: (id) =>
    set((state) => ({
      players: state.players.filter((p) => p.id !== id),
    })),

  setAnsweredPlayers: (answeredPlayers) => set({ answeredPlayers }),

  addAnsweredPlayer: (player) =>
    set((state) => ({
      answeredPlayers: state.answeredPlayers.some((p) => p.id === player.id)
        ? state.answeredPlayers
        : [...state.answeredPlayers, player],
    })),

  setStatus: (name, data) => set({ status: createStatus(name, data) }),

  reset: () => set(initialState),
}))
