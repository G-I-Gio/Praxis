import ErrorPage from "@razzia/web/components/ErrorPage"
import NotFound from "@razzia/web/components/NotFound"
import {
  SocketProvider,
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { applyBranding, loadBranding } from "@razzia/web/branding"
import { EVENTS } from "@razzia/common/constants"
import StartupPage from "@razzia/web/pages/startup"
import { createRootRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"

const GameLayout = () => {
  const { isConnected, connect } = useSocket()
  const navigate = useNavigate()
  const location = useLocation()
  const [appState, setAppState] = useState<"starting" | "ready">("starting")

  // ── Étape 1 : attendre que le backend soit prêt ──────────────────────────
  const handleReady = useCallback(() => {
    setAppState("ready")
  }, [])

  // ── Étape 2 : vérifications post-démarrage (setup, socket, branding) ────
  useEffect(() => {
    if (appState !== "ready") return

    if (location.pathname.startsWith("/setup")) return

    fetch("/auth/status")
      .then((r) => r.json())
      .then((data: { setupDone: boolean; ready: boolean }) => {
        if (!data.setupDone) {
          navigate({ to: "/setup" })
        }
      })
      .catch(() => {
        // En cas d'erreur réseau, on laisse passer
      })
  }, [appState, location.pathname, navigate])

  useEffect(() => {
    if (appState !== "ready") return
    if (!isConnected) connect()
  }, [appState, connect, isConnected])

  useEffect(() => {
    document.body.classList.add("bg-secondary")
    return () => {
      document.body.classList.remove("bg-secondary")
    }
  }, [])

  // Recharger et appliquer le branding sur signal du serveur
  useEvent(EVENTS.BRANDING.RELOAD, () => {
    loadBranding().then((theme) => {
      applyBranding(theme)
    })
  })

  // Page de démarrage — affichée jusqu'à ce que le backend soit prêt
  if (appState === "starting") {
    return <StartupPage onReady={handleReady} />
  }

  return (
    <div className="bg-secondary antialiased">
      <Outlet />
    </div>
  )
}

export const Route = createRootRoute({
  component: () => (
    <SocketProvider>
      <GameLayout />
    </SocketProvider>
  ),
  errorComponent: ({ error }) => (
    <div className="bg-secondary antialiased">
      <ErrorPage error={error} />
    </div>
  ),
  notFoundComponent: () => (
    <div className="bg-secondary antialiased">
      <NotFound />
    </div>
  ),
})
