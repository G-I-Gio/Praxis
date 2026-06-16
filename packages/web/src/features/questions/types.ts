import type { MultiQuestionOptions } from "@razzia/common/types/game"

export interface AnswerComponentProps {
  answers: string[]
  options?: MultiQuestionOptions
  onSubmit: (_answerKeys: number[]) => void
  readOnly?: boolean
}

export interface SolutionPickerProps {
  index: number
  isSelected: boolean
}
