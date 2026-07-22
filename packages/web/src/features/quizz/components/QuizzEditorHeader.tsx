import { EVENTS } from "@razzia/common/constants"
import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { useNavigate } from "@tanstack/react-router"
import type { ChangeEvent } from "react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

// ---------------------------------------------------------------------------
// Mode Socket.IO (legacy + /manager/config) — comportement d'origine inchangé
// ---------------------------------------------------------------------------
const QuizzEditorHeaderSocket = () => {
  const { quizzId, subject, setSubject, questions } = useQuizzEditor()
  const { socket } = useSocket()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleChangeSubject = (e: ChangeEvent<HTMLInputElement>) => {
    setSubject(e.target.value)
  }

  const handleSave = () => {
    if (quizzId) {
      socket.emit(EVENTS.QUIZZ.UPDATE, { id: quizzId, subject, questions })
    } else {
      socket.emit(EVENTS.QUIZZ.SAVE, { subject, questions })
    }
  }

  useEvent(EVENTS.QUIZZ.SAVE_SUCCESS, () => {
    toast.success(t("quizz:quizzSaved"))
    navigate({ to: "/manager/config" })
  })

  useEvent(EVENTS.QUIZZ.UPDATE_SUCCESS, (_data) => {
    toast.success(t("quizz:quizzUpdated"))
    navigate({ to: "/manager/config" })
  })

  useEvent(EVENTS.QUIZZ.ERROR, (message) => {
    toast.error(t(message))
  })

  return (
    <header className="bg-background z-20 flex h-14 items-center justify-between gap-4 px-4 shadow-sm">
      <div className="flex items-center gap-6">
        <Input
          variant="sm"
          className="w-64"
          value={subject}
          onChange={handleChangeSubject}
          placeholder={t("quizz:titleQuizzPlaceholder")}
        />
      </div>
      <div className="flex gap-2">
        <Button
          className="text-md bg-accent text-accent-foreground px-4 py-2 font-semibold"
          onClick={() => navigate({ to: "/manager" })}
        >
          {t("common:exit")}
        </Button>
        <Button className="bg-primary text-md px-4 py-2" onClick={handleSave}>
          {t("common:save")}
        </Button>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Mode REST API (dashboard /manager/dashboard)
// ---------------------------------------------------------------------------
const QuizzEditorHeaderApi = () => {
  const { quizzId, subject, setSubject, questions } = useQuizzEditor()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)

  const handleChangeSubject = (e: ChangeEvent<HTMLInputElement>) => {
    setSubject(e.target.value)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const url = quizzId ? `/api/quizzes/${quizzId}` : "/api/quizzes"
      const method = quizzId ? "PUT" : "POST"
      const r = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, questions }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        toast.error((body as { error?: string }).error ?? `Erreur ${r.status}`)
        return
      }
      toast.success(quizzId ? t("quizz:quizzUpdated") : t("quizz:quizzSaved"))
      navigate({ to: "/manager/dashboard" })
    } catch {
      toast.error(t("manager:dashboard.networkError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <header className="bg-background z-20 flex h-14 items-center justify-between gap-4 px-4 shadow-sm">
      <div className="flex items-center gap-6">
        <Input
          variant="sm"
          className="w-64"
          value={subject}
          onChange={handleChangeSubject}
          placeholder={t("quizz:titleQuizzPlaceholder")}
        />
      </div>
      <div className="flex gap-2">
        <Button
          className="text-md bg-accent text-accent-foreground px-4 py-2 font-semibold"
          onClick={() => navigate({ to: "/manager/dashboard" })}
        >
          {t("common:exit")}
        </Button>
        <Button
          className="bg-primary text-md px-4 py-2"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "…" : t("common:save")}
        </Button>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Export : bascule selon la prop `apiMode`
// ---------------------------------------------------------------------------
interface Props {
  /** true = sauvegarde via REST /api/quizzes, false = Socket.IO (défaut) */
  apiMode?: boolean
}

const QuizzEditorHeader = ({ apiMode = false }: Props) =>
  apiMode ? <QuizzEditorHeaderApi /> : <QuizzEditorHeaderSocket />

export default QuizzEditorHeader
