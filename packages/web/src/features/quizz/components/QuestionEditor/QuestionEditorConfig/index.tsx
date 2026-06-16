import { QUESTION_TYPES, SCORING_MODES } from "@razzia/common/constants"
import type { QuestionType } from "@razzia/common/types/game"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigSection from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import ConfigSelect from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSelect"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import { LayoutList } from "lucide-react"
import { useTranslation } from "react-i18next"

const QuestionEditorConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const questionType: QuestionType = currentQuestion.type ?? "single"

  const handleTypeChange = (type: string) => {
    updateQuestion(currentIndex, {
      type: type as QuestionType,
      ...(type === QUESTION_TYPES.MULTI && {
        options: { scoringMode: SCORING_MODES.BALANCED },
      }),
    })
  }

  const { ConfigComponent } = QUESTION_REGISTRY[questionType]

  const typeOptions = (Object.keys(QUESTION_REGISTRY) as QuestionType[]).map(
    (type) => ({ value: type, label: t(QUESTION_REGISTRY[type].labelKey) }),
  )

  return (
    <aside className="z-10 m-3 flex w-68 shrink-0 flex-col gap-6 self-start overflow-auto rounded-xl bg-white p-4 shadow-sm">
      <ConfigSection title={t("quizz:question.config.questionType")}>
        <ConfigField>
          <ConfigField.Label
            icon={<LayoutList className="size-4" />}
            label={t("quizz:question.config.answerMode")}
          />
          <ConfigSelect
            value={questionType}
            options={typeOptions}
            onValueChange={handleTypeChange}
          />
        </ConfigField>
      </ConfigSection>

      <ConfigComponent />
    </aside>
  )
}

export default QuestionEditorConfig
