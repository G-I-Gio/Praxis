import type { QuestionMediaType } from "@razzia/common/types/game"
import { questionMediaValidator } from "@razzia/common/validators/quizz"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import MediaLibraryModal from "@razzia/web/features/dashboard/MediaLibraryModal"
import type { MediaEntry } from "@razzia/web/features/dashboard/useMediaApi"
import { useMediaApi } from "@razzia/web/features/dashboard/useMediaApi"
import { useDashboardAuth } from "@razzia/web/features/dashboard/useDashboardAuth"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { FileAudio, FileVideo, Image, ImageOff, Library, Music, Upload, Video } from "lucide-react"
import { type ChangeEvent, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type MediaTab = "url" | "library" | "upload"

const QuestionEditorMedia = () => {
  const { updateQuestion, currentIndex, currentQuestion } = useQuizzEditor()
  const questionMedia = currentQuestion.media
  const { t } = useTranslation()
  const { manager } = useDashboardAuth()

  const [tab, setTab]               = useState<MediaTab>("url")
  const [showLibrary, setShowLibrary] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const fileInputRef                = useRef<HTMLInputElement>(null)
  const { upload }                  = useMediaApi()

  const handleChangeMediaType = (type: QuestionMediaType) => () => {
    const result = questionMediaValidator.safeParse({
      type,
      url: questionMedia?.url,
    })
    if (!result.success) {
      toast.error(t(result.error.issues[0].message))
      return
    }
    updateQuestion(currentIndex, { media: result.data })
  }

  const handleRemoveMedia = () => {
    if (!questionMedia) return
    updateQuestion(currentIndex, { media: undefined })
  }

  const handleChangeUrl = (e: ChangeEvent<HTMLInputElement>) => {
    updateQuestion(currentIndex, { media: { url: e.target.value } })
  }

  // Sélection depuis la bibliothèque
  const handleSelectFromLibrary = (entry: MediaEntry) => {
    setShowLibrary(false)
    const mimePrefix = entry.mime_type.split("/")[0] as QuestionMediaType
    const type: QuestionMediaType =
      mimePrefix === "image" || mimePrefix === "video" || mimePrefix === "audio"
        ? mimePrefix
        : "image"
    updateQuestion(currentIndex, {
      media: { type, url: `media:${entry.id}` },
    })
  }

  // Upload direct depuis l'éditeur
  const handleDirectUpload = async (file: File) => {
    setUploading(true)
    try {
      const entry = await upload(file)
      toast.success(t("manager:media.uploaded"))
      handleSelectFromLibrary(entry)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  // Résoudre l'URL d'affichage dans l'éditeur
  const resolvePreviewUrl = (url: string): string => {
    if (url.startsWith("media:")) {
      const id = url.slice("media:".length)
      return `/api/media/${id}/file`
    }
    return url
  }

  // Reconstruire le media pour la preview (remplacer l'URL interne)
  const previewMedia = questionMedia
    ? { ...questionMedia, url: questionMedia.url ? resolvePreviewUrl(questionMedia.url) : undefined }
    : undefined

  // Filtre MIME selon le tab actuel
  const mimeFilter = tab === "library" ? undefined : undefined

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 p-4">
      <QuestionMedia media={previewMedia} alt="Question Media" />

      {!questionMedia?.type && (
        <Card className="my-auto flex max-h-[32rem] w-full max-w-xl flex-1 flex-col gap-0 overflow-hidden">

          {/* Onglets */}
          <div className="flex shrink-0 border-b border-[var(--color-accent)]">
            {(["url", "library", "upload"] as MediaTab[]).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors ${
                  tab === tabKey
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tabKey === "url"     && <Image    className="size-3.5" />}
                {tabKey === "library" && <Library  className="size-3.5" />}
                {tabKey === "upload"  && <Upload   className="size-3.5" />}
                {t(`manager:media.editorTab.${tabKey}`)}
              </button>
            ))}
          </div>

          {/* ── Onglet URL externe ── */}
          {tab === "url" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
              <ImageOff className="stroke-accent-foreground size-12" />
              <p className="text-accent-foreground text-center text-sm">
                {t("quizz:question.addMediaHint")}
              </p>
              <Input
                variant="sm"
                className="w-full max-w-md"
                placeholder={t("quizz:question.mediaUrlPlaceholder")}
                value={questionMedia?.url ?? ""}
                onChange={handleChangeUrl}
              />
              <div className="flex flex-wrap justify-center gap-2">
                {(["image", "video", "audio"] as QuestionMediaType[]).map((type) => (
                  <Button
                    key={type}
                    onClick={handleChangeMediaType(type)}
                    className="bg-accent text-accent-foreground hover:bg-accent"
                  >
                    <div className="flex items-center gap-1.5">
                      {type === "image" && <Image className="size-5" />}
                      {type === "video" && <Video className="size-5" />}
                      {type === "audio" && <Music className="size-5" />}
                      <p>{t(`quizz:question.media.${type}`)}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* ── Onglet Bibliothèque ── */}
          {tab === "library" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
              <Library className="stroke-accent-foreground size-12" />
              <p className="text-accent-foreground text-center text-sm">
                {t("manager:media.libraryHint")}
              </p>
              <Button
                onClick={() => setShowLibrary(true)}
                className="bg-accent text-accent-foreground hover:bg-accent"
              >
                <Library className="size-5" />
                {t("manager:media.openLibrary")}
              </Button>
            </div>
          )}

          {/* ── Onglet Upload ── */}
          {tab === "upload" && (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-4 p-6"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) void handleDirectUpload(f)
              }}
            >
              <Upload className="stroke-accent-foreground size-12" />
              <p className="text-accent-foreground text-center text-sm">
                {t("manager:media.uploadHint", {
                  max: process.env.VITE_MAX_MEDIA_SIZE ?? "20",
                })}
              </p>
              <p className="text-muted-foreground text-xs text-center">
                {t("manager:media.dropHint")}
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-accent text-accent-foreground hover:bg-accent"
              >
                <Upload className="size-5" />
                {uploading ? t("manager:media.uploading") : t("manager:media.upload")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mp3,.ogg,.wav"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleDirectUpload(f)
                  e.target.value = ""
                }}
              />
            </div>
          )}
        </Card>
      )}

      {questionMedia?.type && (
        <div className="absolute bottom-4">
          <Button
            className="bg-accent text-foreground hover:bg-accent rounded-sm px-4 py-2 font-semibold transition-colors"
            onClick={handleRemoveMedia}
          >
            {t("common:delete")}
          </Button>
        </div>
      )}

      {showLibrary && (
        <MediaLibraryModal
          currentManagerId={manager?.id ?? ""}
          allManagers={[]}
          onClose={() => setShowLibrary(false)}
          onSelect={handleSelectFromLibrary}
        />
      )}
    </div>
  )
}

export default QuestionEditorMedia
