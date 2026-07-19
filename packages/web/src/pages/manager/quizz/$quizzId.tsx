import type { QuizzWithId } from "@razzia/common/types/game"
import Loader from "@razzia/web/components/Loader"
import QuestionEditor from "@razzia/web/features/quizz/components/QuestionEditor"
import QuizzEditorHeader from "@razzia/web/features/quizz/components/QuizzEditorHeader"
import QuizzEditorSidebar from "@razzia/web/features/quizz/components/QuizzEditorSidebar"
import { QuizzEditorProvider } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"

const QuizzEditPage = () => {
  const { quizzId } = Route.useParams()
  const [quizz, setQuizz] = useState<QuizzWithId | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/quizzes/${quizzId}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<QuizzWithId & { owner_id: string; visibility: string; shared_with: string[] }>
      })
      .then((data) => {
        // Normaliser : QuizzWithId = { id, subject, questions }
        setQuizz({ id: data.id, subject: data.subject, questions: data.questions })
      })
      .catch((e: Error) => setError(e.message))
  }, [quizzId])

  if (error) {
    return (
      <div className="bg-muted flex h-svh items-center justify-center text-red-500">
        Erreur : {error}
      </div>
    )
  }

  if (!quizz) {
    return (
      <div className="bg-muted flex h-svh items-center justify-center">
        <Loader className="text-background max-h-23" />
      </div>
    )
  }

  return (
    <QuizzEditorProvider initialData={quizz}>
      <div className="bg-muted relative flex h-svh flex-col">
        <QuizzEditorHeader apiMode />
        <div className="flex flex-1 overflow-hidden">
          <QuizzEditorSidebar />
          <QuestionEditor />
        </div>
      </div>
    </QuizzEditorProvider>
  )
}

export const Route = createFileRoute("/manager/quizz/$quizzId")({
  component: QuizzEditPage,
})
