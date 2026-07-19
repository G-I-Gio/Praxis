import Background from "@razzia/web/components/Background"
import Card from "@razzia/web/components/Card"
import { CheckCircle, Circle, XCircle } from "lucide-react"
import { useEffect, useState } from "react"

interface HealthCheck {
  name: string
  label: string
  status: "pending" | "ok" | "error"
  detail?: string
}

interface HealthState {
  ready: boolean
  shutting_down: boolean
  started_at: string
  checks: HealthCheck[]
}

interface Props {
  onReady: () => void
}

const StatusIcon = ({ status }: { status: HealthCheck["status"] }) => {
  if (status === "ok")
    return <CheckCircle className="text-primary size-5 shrink-0" />
  if (status === "error")
    return <XCircle className="size-5 shrink-0 text-red-500" />
  return (
    <Circle className="text-muted-foreground size-5 shrink-0 animate-pulse" />
  )
}

const StartupPage = ({ onReady }: Props) => {
  const [health, setHealth] = useState<HealthState | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const r = await fetch("/health", { cache: "no-store" })
        const data = (await r.json()) as HealthState

        if (cancelled) return
        setHealth(data)
        setError(false)

        if (data.ready) {
          onReady()
          return
        }
      } catch {
        if (!cancelled) setError(true)
      }

      // Continuer à poller si pas encore prêt
      if (!cancelled) {
        setTimeout(poll, 1000)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [onReady])

  return (
    <Background>
      <Card className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <p className="text-foreground text-xl font-bold">Démarrage en cours</p>
          <p className="text-muted-foreground mt-1 text-sm">
            L'application s'initialise, merci de patienter…
          </p>
        </div>

        {/* Checkpoints */}
        <div className="space-y-3">
          {health?.checks.map((check) => (
            <div key={check.name} className="flex items-start gap-3">
              <StatusIcon status={check.status} />
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-medium">
                  {check.label}
                </p>
                {check.detail && (
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {check.detail}
                  </p>
                )}
                {check.status === "error" && (
                  <p className="mt-0.5 text-xs text-red-500">
                    Erreur — consultez les logs du conteneur
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Etat avant réception des données */}
          {!health && !error && (
            <div className="flex items-center gap-3">
              <Circle className="text-muted-foreground size-5 shrink-0 animate-pulse" />
              <p className="text-muted-foreground text-sm">
                Connexion au serveur…
              </p>
            </div>
          )}

          {/* Erreur réseau */}
          {error && (
            <div className="flex items-center gap-3">
              <XCircle className="size-5 shrink-0 text-red-500" />
              <p className="text-sm text-red-500">
                Serveur inaccessible — nouvelle tentative…
              </p>
            </div>
          )}
        </div>

        {/* Uptime */}
        {health?.started_at && (
          <p className="text-muted-foreground mt-6 text-center text-xs">
            Démarré à{" "}
            {new Date(health.started_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
        )}
      </Card>
    </Background>
  )
}

export default StartupPage
