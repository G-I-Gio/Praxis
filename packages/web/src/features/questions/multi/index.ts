import { SCORING_MODES } from "@razzia/common/constants"
import type { MultiQuestionOptions } from "@razzia/common/types/game"

export { default as AnswerComponent } from "@razzia/web/features/questions/multi/AnswerComponent"

export { default as ConfigComponent } from "@razzia/web/features/questions/multi/ConfigComponent"

export { default as SolutionPicker } from "@razzia/web/features/questions/multi/SolutionPicker"

export const labelKey = "quizz:questionType.multi"

export const defaultOptions: MultiQuestionOptions = {
  scoringMode: SCORING_MODES.BALANCED,
}
