import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"

const SetupPage = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)

  // Rediriger si le setup est déjà fait
  useEffect(() => {
    fetch("/auth/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.setupDone) navigate({ to: "/manager" })
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async () => {
    if (!username || !password || !confirm) {
      toast.error("Tous les champs sont requis")
      return
    }
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas")
      return
    }
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue")
        return
      }

      toast.success("Compte administrateur créé !")
      navigate({ to: "/manager" })
    } catch {
      toast.error("Impossible de contacter le serveur")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-sm w-full gap-3 flex flex-col">
        <h1 className="text-xl font-bold text-center text-foreground mb-2">
          Configuration initiale
        </h1>
        <p className="text-sm text-center text-foreground/60 mb-2">
          Créez le compte administrateur pour commencer
        </p>

        <Input
          placeholder="Nom d'utilisateur"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <Input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <Input
          type="password"
          placeholder="Confirmer le mot de passe"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        <Button
          className="mt-2 w-full"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Création..." : "Créer le compte"}
        </Button>
      </Card>
  )
}

export const Route = createFileRoute("/(auth)/setup/")({
  component: SetupPage,
})
