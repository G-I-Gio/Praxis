import Button from "@razzia/web/components/Button"
import { CheckCircle } from "lucide-react"
import { useState } from "react"
import { createPortal } from "react-dom"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

interface Props {
  otherSessions: number
  onClose: () => void
}

const PasswordSuccessModal = ({ otherSessions, onClose }: Props) => {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  const handleInvalidate = async () => {
    setBusy(true)
    try {
      await fetch("/auth/sessions/invalidate", { method: "POST", credentials: "include" })
      toast.success(t("manager:password.sessionsDisconnected_other", { count: otherSessions }))
      onClose()
    } catch {
      toast.error(t("manager:password.sessionsError"))
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
          {t("manager:password.successTitle")}
        </p>

        {otherSessions > 0 ? (
          <>
            <p className="text-muted-foreground mb-5 text-center text-sm">
              {t("manager:password.sessionsActive_other", { count: otherSessions })}
            </p>
            <div className="flex flex-col gap-2">
              <Button className="bg-primary w-full" onClick={handleInvalidate} disabled={busy}>
                {busy ? t("manager:password.disconnecting") : t("manager:password.disconnectAll")}
              </Button>
              <Button className="bg-accent text-accent-foreground w-full" onClick={onClose} disabled={busy}>
                {t("manager:password.keepSessions")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-5 text-center text-sm">
              {t("manager:password.successBody")}
            </p>
            <Button className="bg-primary w-full" onClick={onClose}>
              {t("manager:password.close")}
            </Button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

export default PasswordSuccessModal
