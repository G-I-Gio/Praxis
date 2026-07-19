import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

export interface DashboardManager {
  id: string
  username: string
  role: string
}

export const useDashboardAuth = () => {
  const navigate = useNavigate()
  const [manager, setManager] = useState<DashboardManager | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/auth/me", { credentials: "include" })
      .then((r) => {
        if (!r.ok) {
          navigate({ to: "/manager" })
          return null
        }
        return r.json() as Promise<{ manager: DashboardManager }>
      })
      .then((data) => {
        if (data) setManager(data.manager)
      })
      .catch(() => navigate({ to: "/manager" }))
      .finally(() => setLoading(false))
  }, [navigate])

  const logout = async () => {
    await fetch("/auth/logout", { method: "POST", credentials: "include" })
    navigate({ to: "/manager" })
  }

  return { manager, loading, logout }
}
