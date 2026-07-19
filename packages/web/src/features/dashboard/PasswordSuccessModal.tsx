import Button from "@razzia/web/components/Button"
import { CheckCircle } from "lucide-react"
import { useState } from "react"
import { createPortal } from "react-dom"
import toast from "react-hot-toast"

interface Props {
  otherSessions: number
  onClose: () => void
}

const PasswordSuccessModal = ({ otherSessions, onClose }: Props) => {
  const [busy, setBusy] = useState(false)

  const handleInvalidate = async () => {
    setBusy(true)
    try {
      await fetch("/auth/sessions/invalidate", { method: "POST", credentials: "include" })
      toast.success(`${otherSessions} session(s) déconnectée(s)`)
      onClose()
    } catch {
      toast.error("Erreur lors de la déconnexion des sessions")
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background w-full max-w-sm rounded-xl p-5 shadow-xl">
        <div className="mb-4 flex justify-center">
          <CheckCircle className="text-primary size-12" />
        </div>

        <p className="text-foreground mb-2 text-center text-lg font-semibold">
          Mot de passe modifié
        </p>

        {otherSessions > 0 ? (
          <>
            <p className="text-muted-foreground mb-5 text-center text-sm">
              Vous avez{" "}
              <span className="text-foreground font-semibold">
                {otherSessions} autre{otherSessions > 1 ? "s" : ""} session
                {otherSessions > 1 ? "s" : ""} active{otherSessions > 1 ? "s" : ""}
              </span>
              . Souhaitez-vous les déconnecter ?
            </p>
            <div className="flex flex-col gap-2">
              <Button className="bg-primary w-full" onClick={handleInvalidate} disabled={busy}>
                {busy ? "Déconnexion…" : "Déconnecter toutes les autres sessions"}
              </Button>
              <Button className="bg-accent text-accent-foreground w-full" onClick={onClose} disabled={busy}>
                Garder les sessions actives
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-5 text-center text-sm">
              Votre mot de passe a été mis à jour avec succès.
            </p>
            <Button className="bg-primary w-full" onClick={onClose}>
              Fermer
            </Button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

export default PasswordSuccessModal
