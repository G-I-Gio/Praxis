import { QUESTION_TYPES, SCORING_MODES } from "@razzia/common/constants"
import type { MultiQuestionOptions } from "@razzia/common/types/game"

export const type = QUESTION_TYPES.MULTI

const SCORING_BY_MODE = [
  {
    mode: SCORING_MODES.STRICT,
    compute: (answerIds: number[], solutions: number[]) => {
      const allCorrect = solutions.every((s) => answerIds.includes(s))
      const noneWrong = answerIds.every((id) => solutions.includes(id))

      return allCorrect && noneWrong ? 1 : 0
    },
  },
  {
    mode: SCORING_MODES.BALANCED,
    compute: (answerIds: number[], solutions: number[]) => {
      const x = answerIds.filter((id) => solutions.includes(id)).length
      const y = answerIds.filter((id) => !solutions.includes(id)).length

      return Math.max((x - y) / solutions.length, 0)
    },
  },
  {
    mode: SCORING_MODES.LENIENT,
    compute: (answerIds: number[], solutions: number[]) => {
      const x = answerIds.filter((id) => solutions.includes(id)).length

      return x / solutions.length
    },
  },
]

export const scoring = (
  answerIds: number[],
  solutions: number[],
  options?: MultiQuestionOptions,
): number => {
  const mode = options?.scoringMode ?? SCORING_MODES.BALANCED
  const entry = SCORING_BY_MODE.find((s) => s.mode === mode)

  return entry ? entry.compute(answerIds, solutions) : 0
}
