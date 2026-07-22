import type { GameResult } from "@razzia/common/types/game"
import { useCallback, useEffect, useState } from "react"

export interface ApiResultMeta {
  id: string
  subject: string
  date: string
  playerCount: number
  visibility: "private" | "public" | "shared"
  owner_id: string | null
}

export type ApiResultFull = GameResult & {
  visibility: "private" | "public" | "shared"
  shared_with: string[]
  owner_id: string | null
}

const apiFetch = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const r = await fetch(url, { credentials: "include", ...options })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`)
  }
  return r.json() as Promise<T>
}

export const useResultsApi = () => {
  const [results, setResults] = useState<ApiResultMeta[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    apiFetch<{ results: ApiResultMeta[] }>("/api/results")
      .then((d) => setResults(d.results))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  const getResult = useCallback(
    (id: string) => apiFetch<ApiResultFull>(`/api/results/${id}`),
    [],
  )

  const deleteResult = useCallback(
    async (id: string) => {
      await apiFetch(`/api/results/${id}`, { method: "DELETE" })
      reload()
    },
    [reload],
  )

  const setVisibility = useCallback(
    async (
      id: string,
      visibility: "private" | "public" | "shared",
      sharedWith: string[] = [],
    ) => {
      await apiFetch(`/api/results/${id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility, shared_with: sharedWith }),
      })
      reload()
    },
    [reload],
  )

  const renameResult = useCallback(
    async (id: string, subject: string) => {
      await apiFetch(`/api/results/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject }),
      })
      reload()
    },
    [reload],
  )

  return { results, loading, reload, getResult, deleteResult, setVisibility, renameResult }
}
