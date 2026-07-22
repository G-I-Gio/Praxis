import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import { Search, UserMinus, UserPlus, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
  const [sharedWith, setSharedWith] = useState<string[]>(result.shared_with ?? [])
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const hasAccess = allManagers.filter(
    (m) => sharedWith.includes(m.id) && m.id !== currentManagerId,
  )
  const canAdd = allManagers.filter(
    (m) =>
      !sharedWith.includes(m.id) &&
      m.id !== currentManagerId &&
      m.username.toLowerCase().includes(search.toLowerCase()),
  )

  const apply = async (nextShared: string[]) => {
    setBusy(true)
    try {
      const visibility = nextShared.length > 0 ? "shared" : "private"
      await onSetVisibility(result.id, visibility, nextShared)
      setSharedWith(nextShared)
      toast.success(
        nextShared.length > 0
          ? nextShared.length === 1
            ? t("manager:share.sharedWith", { count: nextShared.length })
            : t("manager:share.sharedWithPlural", { count: nextShared.length })
          : t("manager:share.restricted"),
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
      <div className="bg-background flex max-h-[80svh] w-full max-w-sm flex-col rounded-xl p-5 shadow-xl">

        <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-foreground font-semibold">{t("manager:share.title")}</p>
            <p className="text-muted-foreground truncate text-xs">{result.subject}</p>
          </div>
          <button
            className="text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-1"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-4 shrink-0">
          <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
            {t("manager:share.hasAccess", { count: hasAccess.length })}
          </p>
          {hasAccess.length === 0 ? (
            <p className="text-muted-foreground text-xs italic">
              {t("manager:share.nobody", { subject: result.subject })}
            </p>
          ) : (
            <ul className="max-h-32 space-y-1.5 overflow-y-auto pr-0.5">
              {hasAccess.map((m) => (
                <li
                  key={m.id}
                  className="border-accent flex h-9 items-center justify-between rounded-md border-2 px-3"
                >
                  <span className="text-foreground text-sm font-medium">{m.username}</span>
                  <button
                    className="text-muted-foreground hover:text-red-500 rounded-sm p-1 transition-colors"
                    onClick={handleRemove(m.id)}
                    disabled={busy}
                    title={t("manager:share.removeTitle")}
                  >
                    <UserMinus className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <hr className="text-muted mb-4 shrink-0 border" />

        <div className="flex min-h-0 flex-1 flex-col">
          <p className="text-muted-foreground mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide">
            {t("manager:share.addAccess")}
          </p>

          <div className="relative mb-2 shrink-0">
            <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
            <Input
              variant="sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("manager:share.searchPlaceholder")}
              className="w-full pl-7"
            />
          </div>

          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
            {canAdd.length === 0 ? (
              <p className="text-muted-foreground py-2 text-center text-xs italic">
                {search
                  ? t("manager:share.noResult", { search })
                  : t("manager:share.allHaveAccess")}
              </p>
            ) : (
              canAdd.map((m) => (
                <li
                  key={m.id}
                  className="border-accent flex h-9 items-center justify-between rounded-md border-2 px-3"
                >
                  <span className="text-foreground text-sm font-medium">{m.username}</span>
                  <button
                    className="text-muted-foreground hover:text-primary rounded-sm p-1 transition-colors"
                    onClick={handleAdd(m.id)}
                    disabled={busy}
                    title={t("manager:share.addTitle")}
                  >
                    <UserPlus className="size-4" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <Button
          className="bg-accent text-accent-foreground mt-4 shrink-0 w-full"
          onClick={onClose}
        >
          {t("manager:share.close")}
        </Button>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

export default ShareResultModal
