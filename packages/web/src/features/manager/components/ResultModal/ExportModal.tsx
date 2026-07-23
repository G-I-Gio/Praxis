import { Download, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  onExport: (_format: "json" | "csv", _ranking: "final" | "temporal") => void
  onClose: () => void
  // If set, this is a single-player export (CSV only, no JSON option)
  playerUsername?: string
}

const ExportModal = ({ onExport, onClose, playerUsername }: Props) => {
  const { t } = useTranslation()
  const [ranking, setRanking] = useState<"final" | "temporal">("final")

  const handleCsv = () => {
    onExport("csv", ranking)
    onClose()
  }

  const handleJson = () => {
    onExport("json", ranking)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-background border-accent w-full max-w-sm rounded-xl border-2 shadow-2xl">
        <div className="border-accent flex items-center justify-between border-b-2 px-5 py-3">
          <h3 className="text-foreground font-bold">
            {playerUsername
              ? t("manager:result.export.playerTitle")
              : t("manager:result.export.title")}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted rounded p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <p className="text-muted-foreground text-sm">
            {playerUsername
              ? t("manager:result.export.playerDescription", {
                  username: playerUsername,
                })
              : t("manager:result.export.description")}
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-foreground text-xs font-semibold uppercase tracking-wide">
              {t("manager:result.export.rankingLabel")}
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="ranking"
                value="final"
                checked={ranking === "final"}
                onChange={() => setRanking("final")}
                className="accent-primary"
              />
              {t("manager:result.export.rankingFinal")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="ranking"
                value="temporal"
                checked={ranking === "temporal"}
                onChange={() => setRanking("temporal")}
                className="accent-primary"
              />
              {t("manager:result.export.rankingTemporal")}
            </label>
          </div>

          <div className="flex flex-col gap-2">
            {!playerUsername && (
              <button
                onClick={handleJson}
                className="bg-muted hover:bg-accent flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                <Download className="size-4" />
                {t("manager:result.export.json")}
              </button>
            )}
            <button
              onClick={handleCsv}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              <Download className="size-4" />
              {playerUsername
                ? t("manager:result.export.playerCsv")
                : t("manager:result.export.csv")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExportModal
