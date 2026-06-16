import type {
  MultiQuestionOptions,
  QuestionType,
} from "@razzia/common/types/game"
import * as multi from "./multi"
import * as single from "./single"

type ScoringFn = (
  answerIds: number[],
  solutions: number[],
  options?: MultiQuestionOptions,
) => number

export const QUESTION_SCORING: Record<QuestionType, ScoringFn> = {
  [single.type]: single.scoring,
  [multi.type]: multi.scoring,
}
