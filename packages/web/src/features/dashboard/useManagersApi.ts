import { useCallback, useEffect, useState } from "react"

export interface ApiManager {
  id: string
  username: string
  role: "superadmin" | "manager"
  created_at: number
}

const apiFetch = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const r = await fetch(url, { credentials: "include", ...options })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`)
  }
  return r.json() as Promise<T>
}

export const useManagersApi = () => {
  const [managers, setManagers] = useState<ApiManager[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    apiFetch<{ managers: ApiManager[] }>("/api/managers")
      .then((d) => setManagers(d.managers))
      .catch((e: Error) => {
        // 403 = manager simple sans accès — silencieux
        if (!e.message.includes("403") && !e.message.toLowerCase().includes("forbidden")) {
          console.error(e)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  const createManager = useCallback(
    async (username: string, password: string, role: "manager" | "superadmin") => {
      await apiFetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      })
      reload()
    },
    [reload],
  )

  const updateManager = useCallback(
    async (id: string, data: { username?: string; password?: string; role?: string }) => {
      await apiFetch(`/api/managers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      reload()
    },
    [reload],
  )

  const deleteManager = useCallback(
    async (id: string) => {
      await apiFetch(`/api/managers/${id}`, { method: "DELETE" })
      reload()
    },
    [reload],
  )

  return { managers, loading, reload, createManager, updateManager, deleteManager }
}
