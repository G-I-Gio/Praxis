import { useResultModal } from "@razzia/web/features/manager/contexts/result-modal-context"
import ExportModal from "@razzia/web/features/manager/components/ResultModal/ExportModal"
import { Download } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

const ResultModalPlayers = () => {
  const { result, triggerPlayerExport } = useResultModal()
  const { t } = useTranslation()
  const [exportingPlayer, setExportingPlayer] = useState<string | null>(null)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0">
          <tr className="border-accent bg-muted text-muted-foreground border-b-2 text-left text-xs font-semibold tracking-wide uppercase">
            <th className="px-5 py-2.5">{t("manager:result.players.rank")}</th>
            <th className="px-4 py-2.5">{t("manager:result.players.username")}</th>
            <th className="px-4 py-2.5 text-right">{t("manager:result.players.points")}</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-muted divide-y-2">
          {result.players.map((p) => (
            <tr key={p.username}>
              <td className="text-muted-foreground px-5 py-2.5 font-semibold">
                #{p.rank}
              </td>
              <td className="px-4 py-2.5 font-medium">{p.username}</td>
              <td className="px-4 py-2.5 text-right font-semibold">{p.points}</td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={() => setExportingPlayer(p.username)}
                  title={t("manager:result.players.exportTitle")}
                  className="text-muted-foreground hover:bg-accent-foreground/10 rounded p-1.5"
                >
                  <Download className="size-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {exportingPlayer && (
        <ExportModal
          playerUsername={exportingPlayer}
          onExport={(_fmt, ranking) =>
            triggerPlayerExport(exportingPlayer, ranking)
          }
          onClose={() => setExportingPlayer(null)}
        />
      )}
    </div>
  )
}

export default ResultModalPlayers
