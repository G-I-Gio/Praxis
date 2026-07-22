import AlertDialog from "@razzia/web/components/AlertDialog"
import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import MediaLibraryModal from "@razzia/web/features/dashboard/MediaLibraryModal"
import ShareQuizModal from "@razzia/web/features/dashboard/ShareQuizModal"
import { useAllManagers } from "@razzia/web/features/dashboard/useAllManagers"
import { useNavigate } from "@tanstack/react-router"
import { Download, Images, Search, Share2, SquarePen, Trash2, Upload } from "lucide-react"
import { type ChangeEvent, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import type { ApiQuiz } from "./useQuizApi"

interface Props {
  quizzes:          ApiQuiz[]
  loading:          boolean
  currentManagerId: string
  onDelete:         (_id: string) => Promise<void>
  onImport:         (_data: unknown, _isZip: boolean, _raw: File) => Promise<void>
  onExport:         (_id: string, _subject: string) => Promise<void>
  onSetVisibility:  (
    _id: string,
    _visibility: "private" | "public" | "shared",
    _sharedWith: string[],
  ) => Promise<void>
}

const DashboardQuizList = ({
  quizzes,
  loading,
  currentManagerId,
  onDelete,
  onImport,
  onExport,
  onSetVisibility,
}: Props) => {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch]         = useState("")
  const [sharingQuiz, setSharingQuiz] = useState<ApiQuiz | null>(null)
  const [showMedia, setShowMedia]   = useState(false)
  const { managers: allManagers, reload: reloadManagers } = useAllManagers()
  const { t } = useTranslation()

  const filteredQuizzes = quizzes.filter((q) =>
    q.subject.toLowerCase().includes(search.toLowerCase()),
  )

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    // ZIP — envoyé directement au backend
    if (file.name.toLowerCase().endsWith(".zip")) {
      onImport({}, true, file).catch((err: Error) => toast.error(err.message))
      return
    }

    // JSON legacy — parsé côté client
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data: unknown = JSON.parse(event.target?.result as string)
        onImport(data, false, file)
          .then(() => toast.success(t("manager:quizz.import") + " ✓"))
          .catch((err: Error) => toast.error(err.message))
      } catch {
        toast.error(t("manager:quizz.invalidJson"))
      }
    }
    reader.readAsText(file)
  }

  const handleDelete = (id: string) => () => {
    onDelete(id)
      .then(() => toast.success(t("manager:quizz.deleted")))
      .catch((err: Error) => toast.error(err.message))
  }

  const handleExport = (id: string, subject: string) => () => {
    onExport(id, subject).catch((err: Error) => toast.error(err.message))
  }

  if (loading) {
    return (
      <div className="text-muted-foreground my-8 text-center text-sm">
        {t("common:loading")}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">

      {/* Barre de recherche */}
      <div className="relative mb-3 shrink-0">
        <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
        <Input
          variant="sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("manager:quizz.searchPlaceholder")}
          className="w-full pl-7"
        />
      </div>

      {/* Boutons Créer + Import */}
      <div className="mb-2 flex shrink-0 gap-2">
        <Button
          className="flex-1"
          onClick={() => navigate({ to: "/manager/quizz" })}
        >
          {t("manager:quizz.create")}
        </Button>
        <Button
          className="bg-accent text-accent-foreground aspect-square px-3"
          onClick={() => fileInputRef.current?.click()}
          title={t("manager:quizz.import")}
        >
          <Upload className="size-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.zip"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      {/* Bouton Gestion des médias */}
      <Button
        size="sm"
        className="bg-accent text-accent-foreground mb-4 shrink-0 w-full"
        onClick={() => setShowMedia(true)}
      >
        <Images className="size-4" />
        {t("manager:media.manageButton")}
      </Button>

      {/* Liste des quiz */}
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {filteredQuizzes.map((q) => {
          const isOwner = q.owner_id === currentManagerId
          return (
            <div
              key={q.id}
              className="border-accent flex h-12 w-full items-center justify-between rounded-md border-2 p-3 pr-1.5"
            >
              <p className="text-foreground truncate font-medium">{q.subject}</p>
              <div className="flex gap-0.5">
                {isOwner && (
                  <button
                    className={`rounded-sm p-2 transition-colors ${
                      q.visibility === "shared"
                        ? "text-primary hover:bg-primary/10"
                        : "text-accent-foreground hover:bg-accent-foreground/10"
                    }`}
                    onClick={() => {
                      reloadManagers()
                      setSharingQuiz(q)
                    }}
                    title={t("manager:result.shareTitle")}
                  >
                    <Share2 className="size-4" />
                  </button>
                )}

                {isOwner && (
                  <button
                    className="text-accent-foreground hover:bg-accent-foreground/10 rounded-sm p-2"
                    onClick={() =>
                      navigate({
                        to: "/manager/quizz/$quizzId",
                        params: { quizzId: q.id },
                      })
                    }
                    title={t("manager:managers.editTitle")}
                  >
                    <SquarePen className="size-4" />
                  </button>
                )}

                <button
                  className="text-accent-foreground hover:bg-accent-foreground/10 rounded-sm p-2"
                  onClick={handleExport(q.id, q.subject)}
                  title={t("manager:quizz.export")}
                >
                  <Download className="size-4" />
                </button>

                {isOwner && (
                  <AlertDialog
                    trigger={
                      <button className="rounded-sm p-2 hover:bg-red-600/10">
                        <Trash2 className="size-4 stroke-red-500" />
                      </button>
                    }
                    title={t("manager:quizz.delete")}
                    description={t("manager:quizz.deleteConfirm", { name: q.subject })}
                    confirmLabel={t("common:delete")}
                    onConfirm={handleDelete(q.id)}
                  />
                )}
              </div>
            </div>
          )
        })}

        {filteredQuizzes.length === 0 && (
          <div className="text-muted-foreground my-8 text-center">
            {search ? (
              <p>{t("manager:result.searchNoResult", { search })}</p>
            ) : (
              <>
                <p>{t("manager:quizz.none")}</p>
                <p className="mt-1 text-sm">{t("manager:quizz.pleaseCreate")}</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modales */}
      {showMedia && (
        <MediaLibraryModal
          currentManagerId={currentManagerId}
          allManagers={allManagers}
          onClose={() => setShowMedia(false)}
        />
      )}

      {sharingQuiz && (
        <ShareQuizModal
          quiz={sharingQuiz}
          allManagers={allManagers}
          currentManagerId={currentManagerId}
          onClose={() => setSharingQuiz(null)}
          onSetVisibility={async (id, visibility, sharedWith) => {
            await onSetVisibility(id, visibility, sharedWith)
            sharingQuiz.shared_with = sharedWith
            sharingQuiz.visibility = visibility
          }}
        />
      )}
    </div>
  )
}

export default DashboardQuizList
