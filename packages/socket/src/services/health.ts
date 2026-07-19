import logger from "@razzia/socket/services/logger"

/**
 * Service Health — état de démarrage et de santé de l'application.
 *
 * Principe : une seule source de vérité, alimentée séquentiellement
 * par index.ts au fil de l'initialisation. Aucun état éparpillé
 * dans d'autres modules.
 */

export type CheckStatus = "pending" | "ok" | "error"

export interface HealthCheck {
  name: string
  label: string
  status: CheckStatus
  detail?: string
}

export interface HealthState {
  ready: boolean
  shutting_down: boolean
  started_at: string // ISO8601
  checks: HealthCheck[]
}

// ── État interne ──────────────────────────────────────────────────────────────

const CHECKS: HealthCheck[] = [
  { name: "config",   label: "Chargement de la configuration", status: "pending" },
  { name: "database", label: "Base de données",                status: "pending" },
  { name: "http",     label: "Serveur HTTP",                   status: "pending" },
  { name: "socket",   label: "Serveur WebSocket",              status: "pending" },
]

const state: HealthState = {
  ready: false,
  shutting_down: false,
  started_at: new Date().toISOString(),
  checks: CHECKS,
}

// ── API publique ──────────────────────────────────────────────────────────────

/** Retourne une copie de l'état courant (immuable pour l'appelant). */
export const getHealth = (): Readonly<HealthState> => ({
  ...state,
  checks: state.checks.map((c) => ({ ...c })),
})

/** Marque un checkpoint comme réussi ou échoué. */
export const setCheck = (
  name: string,
  status: "ok" | "error",
  detail?: string,
): void => {
  const check = state.checks.find((c) => c.name === name)
  if (!check) {
    logger.warn("[health] Checkpoint inconnu", { name })
    return
  }
  check.status = status
  if (detail) check.detail = detail

  // L'application est prête quand tous les checks sont ok
  state.ready = state.checks.every((c) => c.status === "ok")
}

/**
 * Signale que l'arrêt est en cours.
 * /health répondra immédiatement 503 pour que le reverse proxy
 * cesse d'envoyer du trafic avant la fermeture effective.
 */
export const setShuttingDown = (): void => {
  state.ready = false
  state.shutting_down = true
}
