import { useCallback, useEffect, useState } from "react"

export interface ManagerEntry {
  id: string
  username: string
}

export const useAllManagers = () => {
  const [managers, setManagers] = useState<ManagerEntry[]>([])

  const reload = useCallback(() => {
    fetch("/api/managers", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { managers: ManagerEntry[] }) => setManagers(d.managers))
      .catch(() => {
        // Silencieux si non autorisé
      })
  }, [])

  useEffect(() => { reload() }, [reload])

  return { managers, reload }
}
