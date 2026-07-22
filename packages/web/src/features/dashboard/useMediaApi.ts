import { useState, useCallback } from "react"

export interface MediaRef {
  quiz_id:    string
  subject:    string | null
  owner_name: string | null
  own:        boolean
}

export interface MediaEntry {
  id:            string
  owner_id:      string | null
  hash:          string
  ext:           string
  mime_type:     string
  size:          number
  original_name: string
  visibility:    "private" | "public" | "shared"
  shared_with:   string[]
  created_at:    number
  referenced_by: MediaRef[]
}

const apiFetch = async <T>(
  url: string,
  opts?: RequestInit,
): Promise<T> => {
  const res = await fetch(url, { credentials: "include", ...opts })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const useMediaApi = () => {
  const [media, setMedia]     = useState<MediaEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [storageTotal, setStorageTotal] = useState<number | undefined>(undefined)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ media: MediaEntry[]; storage_total?: number }>("/api/media")
      setMedia(data.media)
      if (data.storage_total !== undefined) setStorageTotal(data.storage_total)
    } finally {
      setLoading(false)
    }
  }, [])

  const upload = useCallback(
    async (file: File): Promise<MediaEntry> => {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/media/upload", {
        method:      "POST",
        credentials: "include",
        body:        form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { media: MediaEntry }
      setMedia((prev) => [data.media, ...prev])
      return data.media
    },
    [],
  )

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await apiFetch(`/api/media/${id}`, { method: "DELETE" })
      setMedia((prev) => prev.filter((m) => m.id !== id))
    },
    [],
  )

  const setVisibility = useCallback(
    async (
      id: string,
      visibility: "private" | "public" | "shared",
      sharedWith: string[],
    ): Promise<void> => {
      await apiFetch(`/api/media/${id}/visibility`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ visibility, shared_with: sharedWith }),
      })
      setMedia((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, visibility, shared_with: sharedWith } : m
        )
      )
    },
    [],
  )

  const getFileUrl  = (id: string) => `/api/media/${id}/file`
  const getDownloadUrl = (id: string) => `/api/media/${id}/download`

  const formatSize = (bytes: number): string => {
    if (bytes < 1024)       return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
  }

  return {
    media,
    loading,
    storageTotal,
    reload,
    upload,
    remove,
    setVisibility,
    getFileUrl,
    getDownloadUrl,
    formatSize,
  }
}
