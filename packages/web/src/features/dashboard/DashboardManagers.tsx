import AlertDialog from "@razzia/web/components/AlertDialog"
import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import type { ApiManager } from "./useManagersApi"

interface Props {
  managers: ApiManager[]
  loading: boolean
  currentManagerId: string
  onCreate: (_username: string, _password: string, _role: "manager" | "superadmin") => Promise<void>
  onUpdate: (_id: string, _data: { username?: string; password?: string; role?: string }) => Promise<void>
  onDelete: (_id: string) => Promise<void>
}

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin",
  manager: "Manager",
}

interface FormState {
  username: string
  password: string
  role: "manager" | "superadmin"
}

const emptyForm = (): FormState => ({ username: "", password: "", role: "manager" })

const DashboardManagers = ({
  managers,
  loading,
  currentManagerId,
  onCreate,
  onUpdate,
  onDelete,
}: Props) => {
  const { t } = useTranslation()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editForm, setEditForm] = useState<Omit<FormState, "password"> & { password: string }>({
    username: "",
    password: "",
    role: "manager",
  })
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")

  const filteredManagers = managers.filter((m) =>
    m.username.toLowerCase().includes(search.toLowerCase()),
  )

  const handleCreate = async () => {
    if (!form.username || !form.password) {
      toast.error(t("manager:managers.identifierRequired"))
      return
    }
    setBusy(true)
    try {
      await onCreate(form.username, form.password, form.role)
      setCreating(false)
      setForm(emptyForm())
      toast.success(t("manager:managers.created", { name: form.username }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (m: ApiManager) => {
    setEditingId(m.id)
    setEditForm({ username: m.username, password: "", role: m.role })
  }

  const handleUpdate = async (id: string) => {
    setBusy(true)
    try {
      const patch: { username?: string; password?: string; role?: string } = {
        username: editForm.username || undefined,
        role: editForm.role,
      }
      if (editForm.password) patch.password = editForm.password
      await onUpdate(id, patch)
      setEditingId(null)
      toast.success(t("manager:managers.updated"))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = (id: string, username: string) => () => {
    onDelete(id)
      .then(() => toast.success(t("manager:managers.created", { name: username })))
      .catch((e: Error) => toast.error(e.message))
  }

  if (loading) {
    return (
      <div className="text-muted-foreground my-8 text-center text-sm">
        {t("common:loading")}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Recherche */}
      <div className="relative shrink-0">
        <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
        <Input
          variant="sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("manager:managers.searchPlaceholder")}
          className="w-full pl-7"
        />
      </div>

      {/* Bouton créer */}
      {!creating && (
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => { setCreating(true); setEditingId(null) }}
        >
          <Plus className="size-4" />
          {t("manager:managers.createAccount")}
        </Button>
      )}

      {/* Formulaire de création */}
      {creating && (
        <div className="border-accent rounded-lg border-2 p-3 flex flex-col gap-2">
          <Input
            variant="sm"
            placeholder={t("manager:managers.identifierPlaceholder")}
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            autoFocus
          />
          <Input
            variant="sm"
            type="password"
            placeholder={t("manager:managers.passwordPlaceholder")}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          <div className="flex gap-2">
            {(["manager", "superadmin"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setForm((f) => ({ ...f, role: r }))}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                  form.role === r
                    ? "bg-primary text-white"
                    : "bg-muted text-accent-foreground"
                }`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleCreate} disabled={busy}>
              <Check className="size-3.5" />
              {t("manager:managers.createBtn")}
            </Button>
            <Button
              size="sm"
              className="bg-accent text-accent-foreground"
              onClick={() => { setCreating(false); setForm(emptyForm()) }}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {filteredManagers.map((m) => (
          <div key={m.id}>
            {editingId === m.id ? (
              /* Ligne édition */
              <div className="border-primary rounded-lg border-2 p-3 flex flex-col gap-2">
                <Input
                  variant="sm"
                  placeholder={t("manager:managers.identifierPlaceholder")}
                  value={editForm.username}
                  onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                  autoFocus
                />
                <Input
                  variant="sm"
                  type="password"
                  placeholder={t("manager:managers.newPasswordPlaceholder")}
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                />
                <div className="flex gap-2">
                  {(["manager", "superadmin"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setEditForm((f) => ({ ...f, role: r }))}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                        editForm.role === r
                          ? "bg-primary text-white"
                          : "bg-muted text-accent-foreground"
                      }`}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => handleUpdate(m.id)} disabled={busy}>
                    <Check className="size-3.5" />
                    {t("common:save")}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-accent text-accent-foreground"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              /* Ligne normale */
              <div className="border-accent flex h-12 w-full items-center justify-between rounded-md border-2 p-3">
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">
                    {m.username}
                    {m.id === currentManagerId && (
                      <span className="text-primary ml-1.5 text-xs">({t("common:you") ?? "vous"})</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">{ROLE_LABEL[m.role]}</p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    className="text-accent-foreground hover:bg-accent-foreground/10 rounded-sm p-2"
                    onClick={() => startEdit(m)}
                    title={t("manager:managers.editTitle")}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  {m.id !== currentManagerId && (
                    <AlertDialog
                      trigger={
                        <button className="rounded-sm p-2 hover:bg-red-600/10">
                          <Trash2 className="size-3.5 stroke-red-500" />
                        </button>
                      }
                      title={t("manager:managers.deleteTitle")}
                      description={t("manager:quizz.deleteConfirm", { name: m.username })}
                      confirmLabel={t("common:delete")}
                      onConfirm={handleDelete(m.id, m.username)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredManagers.length === 0 && (
          <p className="text-muted-foreground my-8 text-center text-sm">
            {search ? t("manager:managers.noResult", { search }) : t("manager:managers.none")}
          </p>
        )}
      </div>
    </div>
  )
}

export default DashboardManagers
