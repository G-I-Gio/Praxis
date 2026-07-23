import type { GameResult, QuestionResult } from "@razzia/common/types/game"
import { getBranding } from "@razzia/web/branding"
import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react"

interface ResultModalContextType {
  result: GameResult
  questionResult: QuestionResult
  questionIndex: number
  total: number
  totalPlayers: number
  answeredCount: number
  correctCount: number
  correctPct: number
  maxAnswerCount: number
  getPlayerPoints: (_name: string) => number
  goNext: () => void
  goPrev: () => void
  onClose: () => void
  triggerExport: (_format: "json" | "csv", _ranking: "final" | "temporal") => void
  triggerPlayerExport: (_username: string, _ranking: "final" | "temporal") => void
}

const ResultModalContext = createContext<ResultModalContextType | null>(null)

type Props = PropsWithChildren<{
  result: GameResult
  resultId: string
  onClose: () => void
}>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const slugify = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, "-")
    .replace(/[^a-z0-9-]/gu, "")
    .slice(0, 40)

const formatDateSlug = (iso: string): string => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`
  )
}

const getAppSlug = (): string => {
  const name = getBranding()?.appName
  return name ? slugify(name) : "praxis"
}

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const ResultModalProvider = ({ children, result, resultId, onClose }: Props) => {
  const [questionIndex, setQuestionIndex] = useState(0)

  const questionResult = result.questions[questionIndex]
  const total = result.questions.length
  const totalPlayers = result.players.length

  const answeredCount = questionResult.playerAnswers.filter(
    (pa) => pa.answerIds !== null && pa.answerIds.length > 0,
  ).length

  const correctCount = questionResult.playerAnswers.filter((pa) =>
    pa.answerIds?.some((id) => questionResult.solutions.includes(id)),
  ).length

  const correctPct =
    totalPlayers > 0 ? Math.round((correctCount / totalPlayers) * 100) : 0

  const maxAnswerCount = Math.max(
    1,
    ...questionResult.answers.map(
      (_, ai) =>
        questionResult.playerAnswers.filter((pa) => pa.answerIds?.includes(ai))
          .length,
    ),
  )

  const getPlayerPoints = (name: string) =>
    result.players.find((p) => p.username === name)?.points ?? 0

  const goNext = () => setQuestionIndex((i) => Math.min(i + 1, total - 1))
  const goPrev = () => setQuestionIndex((i) => Math.max(i - 1, 0))

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------

  const appSlug = getAppSlug()
  const subjectSlug = slugify(result.subject)
  const dateSlug = formatDateSlug(result.date)

  const triggerExport = (
    format: "json" | "csv",
    ranking: "final" | "temporal",
  ) => {
    const params = new URLSearchParams({ format, ranking })
    const url = `/api/results/${resultId}/export?${params.toString()}`
    const filename =
      format === "json"
        ? `${appSlug}-${subjectSlug}-${dateSlug}.json`
        : `${appSlug}-${subjectSlug}-${dateSlug}.csv`

    fetch(url, { credentials: "include" })
      .then((r) => r.blob())
      .then((blob) => downloadBlob(blob, filename))
      .catch(console.error)
  }

  const triggerPlayerExport = (
    username: string,
    ranking: "final" | "temporal",
  ) => {
    const usernameSlug = slugify(username)
    const params = new URLSearchParams({ format: "csv", player: username, ranking })
    const url = `/api/results/${resultId}/export?${params.toString()}`
    const filename = `${appSlug}-${subjectSlug}-${usernameSlug}-${dateSlug}.csv`

    fetch(url, { credentials: "include" })
      .then((r) => r.blob())
      .then((blob) => downloadBlob(blob, filename))
      .catch(console.error)
  }

  return (
    <ResultModalContext.Provider
      value={{
        result,
        questionResult,
        questionIndex,
        total,
        totalPlayers,
        answeredCount,
        correctCount,
        correctPct,
        maxAnswerCount,
        getPlayerPoints,
        goNext,
        goPrev,
        onClose,
        triggerExport,
        triggerPlayerExport,
      }}
    >
      {children}
    </ResultModalContext.Provider>
  )
}

export const useResultModal = () => {
  const ctx = useContext(ResultModalContext)

  if (!ctx) {
    throw new Error("useResultModal must be used inside ResultModalProvider")
  }

  return ctx
}
