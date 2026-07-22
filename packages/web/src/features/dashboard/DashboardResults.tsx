import type { GameResult } from "@razzia/common/types/game"
import AlertDialog from "@razzia/web/components/AlertDialog"
import Input from "@razzia/web/components/Input"
import ResultModal from "@razzia/web/features/manager/components/ResultModal"
import ShareResultModal from "@razzia/web/features/dashboard/ShareResultModal"
import { useAllManagers } from "@razzia/web/features/dashboard/useAllManagers"
import { Globe, Lock, Pencil, Search, Share2, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
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
  onRename: (_id: string, _subject: string) => Promise<void>
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
}

const VisibilityIcon = ({ v }: { v: "private" | "public" | "shared" }) => {
  if (v === "public")  return <Globe   className="size-3.5" />
  if (v === "shared")  return <Share2  className="size-3.5" />
  return                      <Lock    className="size-3.5" />
}

const NEXT_VISIBILITY: Record<
  "private" | "public" | "shared",
  "private" | "public"
> = {
  private: "public",
  public:  "private",
  shared:  "private",
}

const DashboardResults = ({
  results,
  loading,
  currentManagerId,
  onDelete,
  onGetResult,
  onSetVisibility,
  onRename,
}: Props) => {
  const { t } = useTranslation()
  const [selectedResult, setSelectedResult] = useState<GameResult | null>(null)
  const [sharingResult, setSharingResult] = useState<ApiResultMeta | null>(null)
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const VISIBILITY_LABEL: Record<"private" | "public" | "shared", string> = {
    private: t("manager:result.visibility.private"),
    public:  t("manager:result.visibility.public"),
    shared:  t("manager:result.visibility.shared"),
  }

  const filteredResults = results.filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    if (r.subject.toLowerCase().includes(q)) return true
    const d = new Date(r.date)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = String(d.getFullYear())
    const formatted = `${dd}/${mm}/${yyyy}`
    return formatted.includes(q)
  })
  const { managers: allManagers, reload: reloadManagers } = useAllManagers()

  const handleOpen = async (id: string) => {
    try {
      setSelectedResult(await onGetResult(id))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const startEdit = (r: ApiResultMeta) => {
    setEditingId(r.id)
    setEditValue(r.subject)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const commitEdit = async () => {
    if (!editingId || !editValue.trim()) { setEditingId(null); return }
    try {
      await onRename(editingId, editValue.trim())
      toast.success(t("manager:result.renamed"))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEditingId(null)
    }
  }

  const handleDelete = (id: string) => () => {
    onDelete(id).catch((e: Error) => toast.error(e.message))
  }

  const handleToggleVisibility =
    (id: string, current: "private" | "public" | "shared") => () => {
      const next = NEXT_VISIBILITY[current]
      onSetVisibility(id, next)
        .then(() => toast.success(t("manager:result.visibilityUpdated", { label: VISIBILITY_LABEL[next] })))
        .catch((e: Error) => toast.error(e.message))
    }

  if (loading) {
    return (
      <div className="text-muted-foreground my-8 text-center text-sm">
        {t("common:loading")}
      </div>
    )
  }

  return (
    <>
      <div className="relative mb-3 shrink-0">
        <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
        <Input
          variant="sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("manager:result.searchPlaceholder")}
          className="w-full pl-7"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {filteredResults.map((r) => {
          const isOwner = r.owner_id === currentManagerId
          return (
            <div
              key={r.id}
              className="border-accent flex h-14 w-full items-center justify-between rounded-md border-2 p-3"
            >
              <div className="min-w-0 flex-1">
                {editingId === r.id ? (
                  <Input
                    ref={inputRef}
                    variant="sm"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit()
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    className="w-full"
                  />
                ) : (
                  <button
                    className="min-w-0 w-full text-left"
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
                )}
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {isOwner && (
                  <>
                    <button
                      className="text-muted-foreground hover:bg-accent-foreground/10 rounded-sm p-2"
                      title={t("manager:result.renameTitle")}
                      onClick={() => startEdit(r)}
                    >
                      <Pencil className="size-3.5" />
                    </button>

                    <button
                      className="text-muted-foreground hover:bg-accent-foreground/10 rounded-sm p-2"
                      title={t("manager:result.visibility.toggleTitle", { label: VISIBILITY_LABEL[r.visibility] })}
                      onClick={handleToggleVisibility(r.id, r.visibility)}
                    >
                      <VisibilityIcon v={r.visibility} />
                    </button>

                    <button
                      className={`rounded-sm p-2 transition-colors ${
                        r.visibility === "shared"
                          ? "text-primary hover:bg-primary/10"
                          : "text-muted-foreground hover:bg-accent-foreground/10"
                      }`}
                      title={t("manager:result.shareTitle")}
                      onClick={() => {
                        reloadManagers()
                        setSharingResult(r)
                      }}
                    >
                      <Share2 className="size-3.5" />
                    </button>

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

        {filteredResults.length === 0 && (
          <p className="text-muted-foreground my-8 text-center text-sm">
            {search
              ? t("manager:result.searchNoResult", { search })
              : t("manager:result.none")}
          </p>
        )}
      </div>

      {selectedResult && (
        <ResultModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}

      {sharingResult && (
        <ShareResultModal
          result={sharingResult}
          allManagers={allManagers}
          currentManagerId={currentManagerId}
          onClose={() => setSharingResult(null)}
          onSetVisibility={async (id, v, sharedWith) => {
            await onSetVisibility(id, v, sharedWith)
            sharingResult.shared_with = sharedWith ?? []
            sharingResult.visibility = v
          }}
        />
      )}
    </>
  )
}

export default DashboardResults
