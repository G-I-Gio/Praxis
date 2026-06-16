import * as Switch from "@radix-ui/react-switch"
import { NO_TIME_LIMIT } from "@razzia/common/constants"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { Clock, Timer } from "lucide-react"
import { useTranslation } from "react-i18next"

const DEFAULT_TIME = 20

const BaseConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const isTimeLimitEnabled = currentQuestion.time !== NO_TIME_LIMIT

  const handleUpdateQuestion = (key: string) => (value: string | number) => {
    updateQuestion(currentIndex, { [key]: value })
  }

  const handleToggleTimeLimit = (checked: boolean) => {
    updateQuestion(currentIndex, {
      time: checked ? DEFAULT_TIME : NO_TIME_LIMIT,
    })
  }

  return (
    <ConfigSection title={t("quizz:question.config.timings")}>
      <ConfigField>
        <ConfigField.Label
          icon={<Clock className="size-4" />}
          label={t("quizz:question.config.questionDisplay")}
          unit="sec"
        />
        <ConfigNumberInput
          value={currentQuestion.cooldown}
          min={3}
          onChange={handleUpdateQuestion("cooldown")}
        />
        <ConfigField.Description>
          {t("quizz:question.config.questionDisplayHint")}
        </ConfigField.Description>
      </ConfigField>

      <ConfigField>
        <ConfigField.Label
          icon={<Timer className="size-4" />}
          label={t("quizz:question.config.answerTime")}
          unit={isTimeLimitEnabled ? "sec" : undefined}
          action={
            <Switch.Root
              checked={isTimeLimitEnabled}
              onCheckedChange={handleToggleTimeLimit}
              className="data-[state=checked]:bg-primary focus-visible:outline-primary relative h-5 w-9 cursor-pointer rounded-full bg-gray-200 transition-colors focus-visible:outline-2"
            >
              <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4.5" />
            </Switch.Root>
          }
        />
        {isTimeLimitEnabled && (
          <ConfigNumberInput
            value={currentQuestion.time}
            min={5}
            onChange={handleUpdateQuestion("time")}
          />
        )}
        <ConfigField.Description>
          {isTimeLimitEnabled
            ? t("quizz:question.config.answerTimeHint")
            : t("quizz:question.config.noTimeLimitHint")}
        </ConfigField.Description>
      </ConfigField>
    </ConfigSection>
  )
}

export default BaseConfig
