import type { GameResult } from "@razzia/common/types/game"
import ResultModalAnswers from "@razzia/web/features/manager/components/ResultModal/ResultModalAnswers"
import ResultModalHeader from "@razzia/web/features/manager/components/ResultModal/ResultModalHeader"
import ResultModalPlayers from "@razzia/web/features/manager/components/ResultModal/ResultModalPlayers"
import ResultModalStats from "@razzia/web/features/manager/components/ResultModal/ResultModalStats"
import ResultModalTable from "@razzia/web/features/manager/components/ResultModal/ResultModalTable"
import { ResultModalProvider } from "@razzia/web/features/manager/contexts/result-modal-context"
import clsx from "clsx"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  result: GameResult
  resultId: string
  onClose: () => void
}

type Tab = "questions" | "players"

const ResultModal = ({ result, resultId, onClose }: Props) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>("questions")

  useEffect(() => {
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl shadow-2xl">
        <ResultModalProvider result={result} resultId={resultId} onClose={onClose}>
          <ResultModalHeader />

          {/* Tab bar */}
          <div className="border-accent flex shrink-0 border-b-2">
            {(["questions", "players"] as Tab[]).map((t_) => (
              <button
                key={t_}
                onClick={() => setTab(t_)}
                className={clsx(
                  "px-5 py-2.5 text-sm font-semibold transition-colors",
                  tab === t_
                    ? "border-primary text-primary border-b-2"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`manager:result.tabs.${t_}`)}
              </button>
            ))}
          </div>

          {tab === "questions" && (
            <>
              <ResultModalAnswers />
              <ResultModalStats />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ResultModalTable />
              </div>
            </>
          )}

          {tab === "players" && <ResultModalPlayers />}
        </ResultModalProvider>
      </div>
    </div>
  )
}

export default ResultModal
