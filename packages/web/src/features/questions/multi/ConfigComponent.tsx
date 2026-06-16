import type { ScoringMode } from "@razzia/common/types/game"
import BaseConfig from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/BaseConfig"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigSection from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import ConfigSelect from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSelect"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { ListChecks } from "lucide-react"
import { useTranslation } from "react-i18next"

const SCORING_MODES: ScoringMode[] = ["strict", "balanced", "lenient"]

const MultiConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  const scoringMode = currentQuestion.options?.scoringMode ?? "balanced"

  const scoringOptions = SCORING_MODES.map((mode) => ({
    value: mode,
    label: t(`quizz:question.config.scoringMode.${mode}`),
  }))

  const handleScoringModeChange = (mode: string) => {
    updateQuestion(currentIndex, {
      options: { scoringMode: mode as ScoringMode },
    })
  }

  return (
    <>
      <ConfigSection title={t("quizz:question.config.multiSelect")}>
        <ConfigField>
          <ConfigField.Label
            icon={<ListChecks className="size-4" />}
            label={t("quizz:question.config.scoringMode")}
          />
          <ConfigSelect
            value={scoringMode}
            options={scoringOptions}
            onValueChange={handleScoringModeChange}
          />
          <ConfigField.Description>
            {t(`quizz:question.config.scoringModeHint.${scoringMode}`)}
          </ConfigField.Description>
        </ConfigField>
      </ConfigSection>

      <BaseConfig />
    </>
  )
}

export default MultiConfig
