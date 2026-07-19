import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import toast from "react-hot-toast"

const ManagerLoginPage = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!username || !password) {
      toast.error("Identifiants requis")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          toast.error("Trop de tentatives, réessayez dans 15 minutes")
        } else {
          toast.error("Identifiants incorrects")
        }
        return
      }

      toast.success(`Bienvenue, ${data.manager.username} !`)
      navigate({ to: "/manager/dashboard" })
    } catch {
      toast.error("Impossible de contacter le serveur")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-sm w-full flex flex-col gap-3">
        <h1 className="text-xl font-bold text-center text-foreground mb-2">
          Espace Manager
        </h1>

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
          autoComplete="current-password"
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />

        <Button
          className="mt-2 w-full"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Connexion..." : "Se connecter"}
        </Button>
      </Card>
  )
}

export const Route = createFileRoute("/(auth)/manager/")({
  component: ManagerLoginPage,
})
