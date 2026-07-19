import Button from "@razzia/web/components/Button"
import { UserMinus, UserPlus, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import toast from "react-hot-toast"
import type { ManagerEntry } from "./useAllManagers"
import type { ApiResultMeta } from "./useResultsApi"

interface Props {
  result: ApiResultMeta
  allManagers: ManagerEntry[]
  currentManagerId: string
  onClose: () => void
  onSetVisibility: (
    _id: string,
    _v: "private" | "public" | "shared",
    _sharedWith: string[],
  ) => Promise<void>
}

const ShareResultModal = ({
  result,
  allManagers,
  currentManagerId,
  onClose,
  onSetVisibility,
}: Props) => {
  const [sharedWith, setSharedWith] = useState<string[]>(result.shared_with ?? [])
  const [busy, setBusy] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Fermer sur Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  // Listes dérivées — exclure soi-même des personnes à qui partager
  const hasAccess = allManagers.filter(
    (m) => sharedWith.includes(m.id) && m.id !== currentManagerId,
  )
  const canAdd = allManagers.filter(
    (m) => !sharedWith.includes(m.id) && m.id !== currentManagerId,
  )

  const apply = async (nextShared: string[]) => {
    setBusy(true)
    try {
      const visibility = nextShared.length > 0 ? "shared" : "private"
      await onSetVisibility(result.id, visibility, nextShared)
      setSharedWith(nextShared)
      toast.success(
        nextShared.length > 0
          ? `Partagé avec ${nextShared.length} personne${nextShared.length > 1 ? "s" : ""}`
          : "Accès restreint (privé)",
      )
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = (id: string) => () => apply([...sharedWith, id])
  const handleRemove = (id: string) => () => apply(sharedWith.filter((x) => x !== id))

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-background w-full max-w-sm rounded-xl p-5 shadow-xl">

        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-foreground font-semibold">Partage</p>
            <p className="text-muted-foreground truncate text-xs">{result.subject}</p>
          </div>
          <button
            className="text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-1"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* A accès */}
        <div className="mb-4">
          <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
            A accès ({hasAccess.length})
          </p>
          {hasAccess.length === 0 ? (
            <p className="text-muted-foreground text-xs italic">
              Personne — le résultat est privé
            </p>
          ) : (
            <ul className="space-y-1.5">
              {hasAccess.map((m) => (
                <li
                  key={m.id}
                  className="border-accent flex h-9 items-center justify-between rounded-md border-2 px-3"
                >
                  <span className="text-foreground text-sm font-medium">
                    {m.username}
                  </span>
                  <button
                    className="text-muted-foreground hover:text-red-500 rounded-sm p-1 transition-colors"
                    onClick={handleRemove(m.id)}
                    disabled={busy}
                    title="Retirer l'accès"
                  >
                    <UserMinus className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Séparateur */}
        {canAdd.length > 0 && (
          <>
            <hr className="text-muted mb-4 border" />

            {/* Ajouter */}
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                Ajouter un accès
              </p>
              <ul className="max-h-40 space-y-1.5 overflow-auto">
                {canAdd.map((m) => (
                  <li
                    key={m.id}
                    className="border-accent flex h-9 items-center justify-between rounded-md border-2 px-3"
                  >
                    <span className="text-foreground text-sm font-medium">
                      {m.username}
                    </span>
                    <button
                      className="text-muted-foreground hover:text-primary rounded-sm p-1 transition-colors"
                      onClick={handleAdd(m.id)}
                      disabled={busy}
                      title="Donner l'accès"
                    >
                      <UserPlus className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Bouton fermer */}
        <Button
          className="bg-accent text-accent-foreground mt-4 w-full"
          onClick={onClose}
        >
          Fermer
        </Button>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

export default ShareResultModal
