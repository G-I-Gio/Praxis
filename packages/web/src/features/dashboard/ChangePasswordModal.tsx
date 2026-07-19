import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import { Eye, EyeOff, X } from "lucide-react"
import { useState } from "react"
import { createPortal } from "react-dom"
import toast from "react-hot-toast"

interface Props {
  onClose: () => void
  onSuccess: (_otherSessions: number) => void
}

const PasswordField = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (_v: string) => void
  placeholder?: string
}) => {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted-foreground text-xs font-medium">{label}</label>
      <div className="relative">
        <Input
          variant="sm"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-9"
        />
        <button
          type="button"
          tabIndex={-1}
          className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  )
}

const ChangePasswordModal = ({ onClose, onSuccess }: Props) => {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)

  const validate = (): string | null => {
    if (!current) return "Le mot de passe actuel est requis"
    if (!next) return "Le nouveau mot de passe est requis"
    if (next.length < 8) return "Le nouveau mot de passe doit faire au moins 8 caractères"
    if (next === current) return "Le nouveau mot de passe doit être différent de l'actuel"
    if (next !== confirm) return "Les mots de passe ne correspondent pas"
    return null
  }

  const handleSubmit = async () => {
    const error = validate()
    if (error) { toast.error(error); return }

    setBusy(true)
    try {
      const r = await fetch("/auth/password", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      const data = await r.json() as { ok?: boolean; error?: string; other_sessions?: number }
      if (!r.ok) { toast.error(data.error ?? `Erreur ${r.status}`); return }
      onSuccess(data.other_sessions ?? 0)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-background w-full max-w-sm rounded-xl p-5 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-foreground font-semibold">Changer le mot de passe</p>
          <button className="text-muted-foreground hover:text-foreground rounded-sm p-1" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <PasswordField label="Mot de passe actuel" value={current} onChange={setCurrent} placeholder="••••••••" />
          <PasswordField label="Nouveau mot de passe" value={next} onChange={setNext} placeholder="8 caractères minimum" />
          <PasswordField label="Confirmer le nouveau mot de passe" value={confirm} onChange={setConfirm} placeholder="••••••••" />
        </div>

        <div className="mt-5 flex gap-2">
          <Button className="bg-accent text-accent-foreground flex-1" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button className="bg-primary flex-1" onClick={handleSubmit} disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default ChangePasswordModal
