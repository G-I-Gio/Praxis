import type { GameResult } from "@razzia/common/types/game"
import AlertDialog from "@razzia/web/components/AlertDialog"
import ResultModal from "@razzia/web/features/manager/components/ResultModal"
import ShareResultModal from "@razzia/web/features/dashboard/ShareResultModal"
import { useAllManagers } from "@razzia/web/features/dashboard/useAllManagers"
import { Globe, Lock, Share2, Trash2 } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import type { ApiResultMeta } from "./useResultsApi"

interface Props {
  results: ApiResultMeta[]
  loading: boolean
  currentManagerId: string
  onDelete: (_id: string) => Promise<void>
  onGetResult: (_id: string) => Promise<GameResult>
  onSetVisibility: (
    _id: string,
    _v: "private" | "public" | "shared",
    _sharedWith?: string[],
  ) => Promise<void>
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
}

const VISIBILITY_LABEL: Record<"private" | "public" | "shared", string> = {
  private: "Privé",
  public: "Public",
  shared: "Partagé",
}

// Cycle Privé ↔ Public uniquement (Partagé se gère via l'icône dédiée)
const NEXT_VISIBILITY: Record<
  "private" | "public" | "shared",
  "private" | "public"
> = {
  private: "public",
  public:  "private",
  shared:  "private",
}

const VisibilityIcon = ({ v }: { v: "private" | "public" | "shared" }) => {
  if (v === "public")  return <Globe   className="size-3.5" />
  if (v === "shared")  return <Share2  className="size-3.5" />
  return                      <Lock    className="size-3.5" />
}

const DashboardResults = ({
  results,
  loading,
  currentManagerId,
  onDelete,
  onGetResult,
  onSetVisibility,
}: Props) => {
  const [selectedResult, setSelectedResult] = useState<GameResult | null>(null)
  const [sharingResult, setSharingResult] = useState<ApiResultMeta | null>(null)
  const allManagers = useAllManagers()
  const { t } = useTranslation()

  const handleOpen = async (id: string) => {
    try {
      setSelectedResult(await onGetResult(id))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleDelete = (id: string) => () => {
    onDelete(id).catch((e: Error) => toast.error(e.message))
  }

  const handleToggleVisibility =
    (id: string, current: "private" | "public" | "shared") => () => {
      const next = NEXT_VISIBILITY[current]
      onSetVisibility(id, next)
        .then(() => toast.success(`Visibilité → ${VISIBILITY_LABEL[next]}`))
        .catch((e: Error) => toast.error(e.message))
    }

  if (loading) {
    return (
      <div className="text-muted-foreground my-8 text-center text-sm">
        Chargement…
      </div>
    )
  }

  return (
    <>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {results.map((r) => {
          const isOwner = r.owner_id === currentManagerId
          return (
            <div
              key={r.id}
              className="border-accent flex h-14 w-full items-center justify-between rounded-md border-2 p-3"
            >
              {/* Infos cliquables → ouvre ResultModal */}
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => handleOpen(r.id)}
              >
                <p className="text-foreground truncate font-medium">
                  {r.subject}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatDate(r.date)} ·{" "}
                  {t("manager:result.playerCount", { count: r.playerCount })}
                </p>
              </button>

              <div className="flex shrink-0 items-center gap-0.5">
                {isOwner && (
                  <>
                    {/* Visibilité Privé ↔ Public */}
                    <button
                      className="text-muted-foreground hover:bg-accent-foreground/10 rounded-sm p-2"
                      title={`Visibilité : ${VISIBILITY_LABEL[r.visibility]} (cliquer pour basculer Privé/Public)`}
                      onClick={handleToggleVisibility(r.id, r.visibility)}
                    >
                      <VisibilityIcon v={r.visibility} />
                    </button>

                    {/* Partage avec des managers spécifiques */}
                    <button
                      className={`rounded-sm p-2 transition-colors ${
                        r.visibility === "shared"
                          ? "text-primary hover:bg-primary/10"
                          : "text-muted-foreground hover:bg-accent-foreground/10"
                      }`}
                      title="Gérer le partage"
                      onClick={() => setSharingResult(r)}
                    >
                      <Share2 className="size-3.5" />
                    </button>

                    {/* Suppression */}
                    <AlertDialog
                      trigger={
                        <button className="rounded-sm p-2 hover:bg-red-600/10">
                          <Trash2 className="size-3.5 stroke-red-500" />
                        </button>
                      }
                      title={t("manager:result.delete")}
                      description={t("manager:result.deleteConfirm", {
                        name: r.subject,
                      })}
                      confirmLabel={t("common:delete")}
                      onConfirm={handleDelete(r.id)}
                    />
                  </>
                )}
              </div>
            </div>
          )
        })}

        {results.length === 0 && (
          <p className="text-muted-foreground my-8 text-center text-sm">
            {t("manager:result.none")}
          </p>
        )}
      </div>

      {/* Modale résultat */}
      {selectedResult && (
        <ResultModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}

      {/* Modale de partage */}
      {sharingResult && (
        <ShareResultModal
          result={sharingResult}
          allManagers={allManagers}
          currentManagerId={currentManagerId}
          onClose={() => setSharingResult(null)}
          onSetVisibility={async (id, v, sharedWith) => {
            await onSetVisibility(id, v, sharedWith)
            // Mettre à jour la référence locale pour que la modale reflète le nouvel état
            sharingResult.shared_with = sharedWith ?? []
            sharingResult.visibility = v
          }}
        />
      )}
    </>
  )
}

export default DashboardResults
