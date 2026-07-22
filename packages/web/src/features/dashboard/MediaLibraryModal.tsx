import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import { useMediaApi, type MediaEntry } from "@razzia/web/features/dashboard/useMediaApi"
import {
  Download, FileAudio, FileVideo, Globe, Lock, Search,
  Share2, Trash2, Upload, X, Info, HardDrive,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import type { ManagerEntry } from "./useAllManagers"
import ShareMediaModal from "./ShareMediaModal"

type Tab = "mine" | "shared" | "public"

interface Props {
  currentManagerId: string
  allManagers:      ManagerEntry[]
  onClose:          () => void
  /** Si défini, un clic sur un média le sélectionne et ferme la modale */
  onSelect?:        (_media: MediaEntry) => void
  /** Filtre par type MIME (ex: "image/", "video/", "audio/") */
  mimeFilter?:      string
}

const MIME_ICON = (mime: string) => {
  if (mime.startsWith("video/")) return <FileVideo className="size-8 text-blue-400" />
  if (mime.startsWith("audio/")) return <FileAudio className="size-8 text-purple-400" />
  return null
}

const VisibilityIcon = ({ v }: { v: "private" | "public" | "shared" }) => {
  if (v === "public")  return <Globe  className="size-3.5" />
  if (v === "shared")  return <Share2 className="size-3.5" />
  return                      <Lock   className="size-3.5" />
}

const NEXT_VIS: Record<"private" | "public" | "shared", "private" | "public"> = {
  private: "public",
  public:  "private",
  shared:  "private",
}

const MediaLibraryModal = ({
  currentManagerId,
  allManagers,
  onClose,
  onSelect,
  mimeFilter,
}: Props) => {
  const { t }                        = useTranslation()
  const { media, loading, storageTotal, reload, upload, remove, setVisibility, getFileUrl, getDownloadUrl, formatSize } = useMediaApi()
  const [tab, setTab]                = useState<Tab>("mine")
  const [search, setSearch]          = useState("")
  const [selected, setSelected]      = useState<MediaEntry | null>(null)
  const [sharingMedia, setSharingMedia] = useState<MediaEntry | null>(null)
  const [uploading, setUploading]    = useState(false)
  const [dragOver, setDragOver]      = useState(false)
  const fileInputRef                 = useRef<HTMLInputElement>(null)
  const overlayRef                   = useRef<HTMLDivElement>(null)

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const entry = await upload(file)
      toast.success(t("manager:media.uploaded"))
      setSelected(entry)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }, [upload, t])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void handleUpload(f)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) void handleUpload(f)
  }

  const handleDelete = async (m: MediaEntry) => {
    if (m.referenced_by.length > 0) {
      toast.error(t("manager:media.deleteBlocked"))
      return
    }
    try {
      await remove(m.id)
      toast.success(t("manager:media.deleted"))
      if (selected?.id === m.id) setSelected(null)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleToggleVisibility = async (m: MediaEntry) => {
    const next = NEXT_VIS[m.visibility]
    try {
      await setVisibility(m.id, next, [])
      toast.success(t("manager:media.visibilityUpdated"))
      if (selected?.id === m.id) setSelected((prev) => prev ? { ...prev, visibility: next, shared_with: [] } : null)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Filtrer par onglet
  const filtered = media.filter((m) => {
    if (mimeFilter && !m.mime_type.startsWith(mimeFilter)) return false
    const q = search.toLowerCase()
    if (q && !m.original_name.toLowerCase().includes(q)) return false
    if (tab === "mine")   return m.owner_id === currentManagerId
    if (tab === "shared") return m.visibility === "shared" && m.owner_id !== currentManagerId
    if (tab === "public") return m.visibility === "public"
    return false
  })

  const isOwner = (m: MediaEntry) => m.owner_id === currentManagerId || m.owner_id === null

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-background flex h-full max-h-[90svh] w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden">

        {/* ── Colonne gauche — liste ── */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-[var(--color-accent)]">

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-accent)] px-4 py-3">
            <p className="text-foreground font-semibold">{t("manager:media.title")}</p>
            <div className="flex items-center gap-2">
              {storageTotal !== undefined && (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <HardDrive className="size-3" />
                  {formatSize(storageTotal)}
                </span>
              )}
              <button
                className="text-muted-foreground hover:text-foreground rounded-sm p-1"
                onClick={onClose}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 border-b border-[var(--color-accent)]">
            {(["mine", "shared", "public"] as Tab[]).map((t2) => (
              <button
                key={t2}
                onClick={() => setTab(t2)}
                className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                  tab === t2
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`manager:media.tab.${t2}`)}
              </button>
            ))}
          </div>

          {/* Search + Upload */}
          <div className="flex shrink-0 gap-2 p-3">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
              <Input
                variant="sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("manager:media.searchPlaceholder")}
                className="w-full pl-7"
              />
            </div>
            {tab === "mine" && (
              <button
                className="bg-primary text-white rounded-md px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="size-3.5" />
                {uploading ? t("manager:media.uploading") : t("manager:media.upload")}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mp3,.ogg,.wav"
              onChange={handleFileInput}
            />
          </div>

          {/* Drop zone (onglet mine uniquement) */}
          {tab === "mine" && (
            <div
              className={`mx-3 mb-2 shrink-0 rounded-md border-2 border-dashed py-2 text-center text-xs transition-colors ${
                dragOver
                  ? "border-primary text-primary bg-primary/5"
                  : "border-[var(--color-accent)] text-muted-foreground"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {t("manager:media.dropHint")}
            </div>
          )}

          {/* Grille */}
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {loading ? (
              <p className="text-muted-foreground py-8 text-center text-sm">{t("common:loading")}</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {search ? t("manager:media.noResult", { search }) : t("manager:media.empty")}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (onSelect) { onSelect(m) }
                      else setSelected(selected?.id === m.id ? null : m)
                    }}
                    className={`group relative flex flex-col items-center overflow-hidden rounded-lg border-2 p-1.5 transition-colors ${
                      selected?.id === m.id
                        ? "border-primary bg-primary/5"
                        : "border-[var(--color-accent)] hover:border-primary/50"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-md bg-[var(--color-accent)]">
                      {m.mime_type.startsWith("image/") ? (
                        <img
                          src={`/api/media/${m.id}/file`}
                          alt={m.original_name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        MIME_ICON(m.mime_type)
                      )}
                    </div>
                    <p className="mt-1 w-full truncate text-center text-[10px] text-foreground">
                      {m.original_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatSize(m.size)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Colonne droite — détail ── */}
        {selected ? (
          <div className="flex w-72 shrink-0 flex-col">
            <div className="shrink-0 border-b border-[var(--color-accent)] px-4 py-3">
              <p className="text-foreground truncate font-semibold text-sm">{selected.original_name}</p>
              <p className="text-muted-foreground text-xs">
                {selected.mime_type} · {formatSize(selected.size)}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4 space-y-4">
              {/* Preview */}
              <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-accent)]">
                {selected.mime_type.startsWith("image/") ? (
                  <img
                    src={`/api/media/${selected.id}/file`}
                    alt={selected.original_name}
                    className="h-full w-full object-contain"
                  />
                ) : selected.mime_type.startsWith("video/") ? (
                  <video
                    src={`/api/media/${selected.id}/file`}
                    controls
                    className="h-full w-full"
                  />
                ) : selected.mime_type.startsWith("audio/") ? (
                  <audio
                    src={`/api/media/${selected.id}/file`}
                    controls
                    className="w-full px-2"
                  />
                ) : (
                  MIME_ICON(selected.mime_type)
                )}
              </div>

              {/* Infos */}
              <div className="space-y-1 text-xs">
                <p className="text-muted-foreground">
                  {t("manager:media.addedOn", {
                    date: new Date(selected.created_at * 1000).toLocaleDateString(),
                  })}
                </p>
                <p className="text-muted-foreground font-mono text-[10px] break-all">
                  SHA256: {selected.hash.slice(0, 16)}…
                </p>
              </div>

              {/* referenced_by */}
              {selected.referenced_by.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-foreground flex items-center gap-1">
                    <Info className="size-3" />
                    {t("manager:media.usedIn", { count: selected.referenced_by.length })}
                  </p>
                  <ul className="space-y-1">
                    {selected.referenced_by.map((ref) => (
                      <li key={ref.quiz_id} className="text-xs text-muted-foreground">
                        {ref.own
                          ? `→ ${ref.subject}`
                          : `→ ${t("manager:media.usedByOther", { name: ref.owner_name })}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="shrink-0 space-y-2 border-t border-[var(--color-accent)] p-4">
              <a
                href={getDownloadUrl(selected.id)}
                download={selected.original_name}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-accent-foreground hover:opacity-80 transition-opacity"
              >
                <Download className="size-3.5" />
                {t("manager:media.download")}
              </a>

              {isOwner(selected) && (
                <>
                  <button
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-accent-foreground hover:opacity-80 transition-opacity"
                    onClick={() => void handleToggleVisibility(selected)}
                  >
                    <VisibilityIcon v={selected.visibility} />
                    {t(`manager:media.visibility.${selected.visibility}`)}
                  </button>

                  <button
                    className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                      selected.visibility === "shared"
                        ? "bg-primary/10 text-primary"
                        : "bg-[var(--color-accent)] text-accent-foreground hover:opacity-80"
                    }`}
                    onClick={() => setSharingMedia(selected)}
                  >
                    <Share2 className="size-3.5" />
                    {t("manager:media.share")}
                  </button>

                  <button
                    className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                      selected.referenced_by.length > 0
                        ? "opacity-40 cursor-not-allowed bg-[var(--color-accent)] text-accent-foreground"
                        : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    }`}
                    onClick={() => {
                      if (selected.referenced_by.length > 0) {
                        toast.error(t("manager:media.deleteBlocked"))
                        return
                      }
                      void handleDelete(selected)
                    }}
                    title={
                      selected.referenced_by.length > 0
                        ? t("manager:media.deleteBlockedTitle", { count: selected.referenced_by.length })
                        : undefined
                    }
                  >
                    <Trash2 className="size-3.5" />
                    {t("common:delete")}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex w-72 shrink-0 items-center justify-center">
            <p className="text-muted-foreground text-sm">{t("manager:media.selectHint")}</p>
          </div>
        )}
      </div>

      {sharingMedia && (
        <ShareMediaModal
          media={sharingMedia}
          allManagers={allManagers}
          currentManagerId={currentManagerId}
          onClose={() => setSharingMedia(null)}
          onSetVisibility={async (id, v, sw) => {
            await setVisibility(id, v, sw)
            setSharingMedia((prev) => prev ? { ...prev, visibility: v, shared_with: sw } : null)
            setSelected((prev) => prev?.id === id ? { ...prev, visibility: v, shared_with: sw } : prev)
          }}
        />
      )}
    </div>
  )

  return createPortal(modal, document.body)
}

export default MediaLibraryModal
