import AlertDialog from "@razzia/web/components/AlertDialog"
import Button from "@razzia/web/components/Button"
import { useNavigate } from "@tanstack/react-router"
import { Download, SquarePen, Trash2, Upload } from "lucide-react"
import { type ChangeEvent, useRef } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import type { ApiQuiz } from "./useQuizApi"

interface Props {
  quizzes: ApiQuiz[]
  loading: boolean
  onDelete: (_id: string) => Promise<void>
  onImport: (_data: unknown) => Promise<void>
  onExport: (_id: string, _subject: string) => Promise<void>
}

const DashboardQuizList = ({
  quizzes,
  loading,
  onDelete,
  onImport,
  onExport,
}: Props) => {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data: unknown = JSON.parse(event.target?.result as string)
        onImport(data)
          .then(() => toast.success(t("manager:quizz.import") + " ✓"))
          .catch((err: Error) => toast.error(err.message))
      } catch {
        toast.error("Fichier JSON invalide")
      }
    }
    reader.readAsText(file)
    e.target.value = ""
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
        Chargement…
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Actions header */}
      <div className="mb-4 flex shrink-0 gap-2">
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
          accept=".json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      {/* Quiz list */}
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {quizzes.map((q) => (
          <div
            key={q.id}
            className="border-accent flex h-12 w-full items-center justify-between rounded-md border-2 p-3 pr-1.5"
          >
            <p className="text-foreground truncate font-medium">{q.subject}</p>
            <div className="flex gap-0.5">
              <button
                className="text-accent-foreground hover:bg-accent-foreground/10 rounded-sm p-2"
                onClick={() =>
                  navigate({
                    to: "/manager/quizz/$quizzId",
                    params: { quizzId: q.id },
                  })
                }
                title="Modifier"
              >
                <SquarePen className="size-4" />
              </button>

              <button
                className="text-accent-foreground hover:bg-accent-foreground/10 rounded-sm p-2"
                onClick={handleExport(q.id, q.subject)}
                title={t("manager:quizz.export")}
              >
                <Download className="size-4" />
              </button>

              <AlertDialog
                trigger={
                  <button className="rounded-sm p-2 hover:bg-red-600/10">
                    <Trash2 className="size-4 stroke-red-500" />
                  </button>
                }
                title={t("manager:quizz.delete")}
                description={t("manager:quizz.deleteConfirm", {
                  name: q.subject,
                })}
                confirmLabel={t("common:delete")}
                onConfirm={handleDelete(q.id)}
              />
            </div>
          </div>
        ))}

        {quizzes.length === 0 && (
          <div className="text-muted-foreground my-8 text-center">
            <p>{t("manager:quizz.none")}</p>
            <p className="mt-1 text-sm">{t("manager:quizz.pleaseCreate")}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default DashboardQuizList
