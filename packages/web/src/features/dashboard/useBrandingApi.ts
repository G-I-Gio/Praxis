import type { BrandingTheme } from "@razzia/web/branding"
import { useCallback, useEffect, useState } from "react"

const apiFetch = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const r = await fetch(url, { credentials: "include", ...options })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`)
  }
  return r.json() as Promise<T>
}

export const useBrandingApi = () => {
  const [theme, setTheme] = useState<BrandingTheme>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    apiFetch<{ theme: BrandingTheme }>("/api/branding")
      .then((d) => setTheme(d.theme))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  const save = useCallback(
    async (patch: Partial<BrandingTheme>) => {
      setSaving(true)
      try {
        const data = await apiFetch<{ theme: BrandingTheme }>("/api/branding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
        setTheme(data.theme)
        return data.theme
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  const uploadFile = useCallback(
    async (field: string, file: File): Promise<BrandingTheme> => {
      const r = await fetch(`/api/branding/upload/${field}`, {
        method: "POST",
        credentials: "include",
        headers: { "x-filename": file.name },
        body: file,
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`)
      }
      const data = await r.json() as { theme: BrandingTheme }
      setTheme(data.theme)
      return data.theme
    },
    [],
  )

  const resetField = useCallback(
    async (field: string): Promise<BrandingTheme> => {
      const data = await apiFetch<{ theme: BrandingTheme }>(
        `/api/branding/field/${field}`,
        { method: "DELETE" },
      )
      setTheme(data.theme)
      return data.theme
    },
    [],
  )

  const apply = useCallback(async (): Promise<void> => {
    await apiFetch("/api/branding/apply", { method: "POST" })
  }, [])

  return { theme, loading, saving, reload, save, uploadFile, resetField, apply }
}
