import { useCallback, useEffect, useState } from "react"

export interface ApiQuiz {
  id: string
  owner_id: string
  visibility: "private" | "public" | "shared"
  shared_with: string[]
  subject: string
  questions: unknown[]
}

const apiFetch = async <T>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const r = await fetch(url, { credentials: "include", ...options })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`)
  }
  return r.json() as Promise<T>
}

export const useQuizApi = () => {
  const [quizzes, setQuizzes] = useState<ApiQuiz[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    apiFetch<{ quizzes: ApiQuiz[] }>("/api/quizzes")
      .then((data) => setQuizzes(data.quizzes))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const deleteQuiz = useCallback(
    async (id: string) => {
      await apiFetch(`/api/quizzes/${id}`, { method: "DELETE" })
      reload()
    },
    [reload],
  )

  const importQuiz = useCallback(
    async (data: unknown) => {
      await apiFetch("/api/quizzes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      reload()
    },
    [reload],
  )

  const exportQuiz = useCallback(async (id: string, subject: string) => {
    const r = await fetch(`/api/quizzes/${id}/export`, {
      credentials: "include",
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${subject}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return { quizzes, loading, error, reload, deleteQuiz, importQuiz, exportQuiz }
}
