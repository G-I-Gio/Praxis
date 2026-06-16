import type { QuestionType } from "@razzia/common/types/game"
import * as multi from "@razzia/web/features/questions/multi"
import * as single from "@razzia/web/features/questions/single"
import type {
  AnswerComponentProps,
  SolutionPickerProps,
} from "@razzia/web/features/questions/types"
import type { ComponentType } from "react"

interface QuestionRegistryEntry {
  labelKey: string
  AnswerComponent: ComponentType<AnswerComponentProps>
  ConfigComponent: ComponentType
  SolutionPicker: ComponentType<SolutionPickerProps>
}

export const QUESTION_REGISTRY: Record<QuestionType, QuestionRegistryEntry> = {
  single,
  multi,
}
