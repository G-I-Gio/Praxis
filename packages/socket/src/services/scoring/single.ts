import { QUESTION_TYPES } from "@razzia/common/constants"

export const type = QUESTION_TYPES.SINGLE

export const scoring = (answerIds: number[], solutions: number[]): number =>
  answerIds.length === 1 && solutions.includes(answerIds[0]) ? 1 : 0
