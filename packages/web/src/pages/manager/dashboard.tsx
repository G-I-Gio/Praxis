import { STATUS } from "@razzia/common/types/game/status"
import { EVENTS } from "@razzia/common/constants"
import Background from "@razzia/web/components/Background"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import LanguageSwitcher from "@razzia/web/components/LanguageSwitcher"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import ConfigTabButton from "@razzia/web/features/manager/components/configurations/ConfigTabButton"
import DashboardQuizList from "@razzia/web/features/dashboard/DashboardQuizList"
import DashboardResults from "@razzia/web/features/dashboard/DashboardResults"
import DashboardManagers from "@razzia/web/features/dashboard/DashboardManagers"
import DashboardAppearance from "@razzia/web/features/dashboard/DashboardAppearance"
import { useDashboardAuth } from "@razzia/web/features/dashboard/useDashboardAuth"
import { useQuizApi } from "@razzia/web/features/dashboard/useQuizApi"
import { useResultsApi } from "@razzia/web/features/dashboard/useResultsApi"
import { useManagersApi } from "@razzia/web/features/dashboard/useManagersApi"
import { useBrandingApi } from "@razzia/web/features/dashboard/useBrandingApi"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { LogOut, Play } from "lucide-react"
import { useState, useRef } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

// ----------------------------------------------------------------
// Onglet "Jouer"
// ----------------------------------------------------------------
const TabPlay = ({ quizzes, loading }: { quizzes: ReturnType<typeof useQuizApi>["quizzes"]; loading: boolean }) => {
  const [selected, setSelected] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  const selectedRef = useRef<string | null>(null)
  const navigate = useNavigate()
  const { socket } = useSocket()
  const { setConfig, setGameId, setStatus } = useManagerStore()
  const { t } = useTranslation()

  useEvent(EVENTS.MANAGER.CONFIG, (data) => {
    if (!startingRef.current) return
    setConfig(data)
    socket.emit(EVENTS.GAME.CREATE, selectedRef.current!)
  })

  useEvent(EVENTS.MANAGER.UNAUTHORIZED, () => {
    if (!startingRef.current) return
    startingRef.current = false
    setStarting(false)
    toast.error("Session expirée, veuillez vous reconnecter")
    navigate({ to: "/manager" })
  })

  useEvent(EVENTS.MANAGER.GAME_CREATED, ({ gameId, inviteCode }) => {
    if (!startingRef.current) return
    startingRef.current = false
    setStarting(false)
    setGameId(gameId)
    setStatus(STATUS.SHOW_ROOM, { text: "game:waitingForPlayers", inviteCode })
    navigate({ to: "/party/manager/$gameId", params: { gameId } })
  })

  useEvent(EVENTS.GAME.ERROR_MESSAGE, (message) => {
    if (!startingRef.current) return
    startingRef.current = false
    setStarting(false)
    toast.error(t(message))
  })

  const handleStart = () => {
    if (!selected) {
      toast.error(t("manager:quizz.pleaseSelect"))
      return
    }
    selectedRef.current = selected
    startingRef.current = true
    setStarting(true)

    fetch("/auth/token", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { token?: string }) => {
        if (!data.token) {
          startingRef.current = false
          setStarting(false)
          toast.error("Session expirée, veuillez vous reconnecter")
          navigate({ to: "/manager" })
          return
        }
        socket.emit(EVENTS.MANAGER.AUTH_SESSION, data.token)
      })
      .catch(() => {
        startingRef.current = false
        setStarting(false)
        toast.error("Erreur réseau")
      })
  }

  if (loading) {
    return <div className="text-muted-foreground my-8 text-center text-sm">Chargement…</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {quizzes.length > 0 && (
        <Button className="mb-4 shrink-0" onClick={handleStart} disabled={starting}>
          <Play className="size-4" />
          {starting ? "Démarrage…" : t("manager:quizz.startGame")}
        </Button>
      )}
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {quizzes.map((q) => {
          const isSelected = selected === q.id
          return (
            <button
              key={q.id}
              className="border-accent flex h-12 w-full items-center justify-between rounded-md border-2 p-3"
              onClick={() => setSelected(isSelected ? null : q.id)}
            >
              <p className="text-foreground truncate font-medium">{q.subject}</p>
              <div className={isSelected ? "bg-primary border-primary/80 size-6 rounded" : "bg-muted size-6 rounded"}>
                {isSelected && (
                  <svg viewBox="0 0 24 24" className="size-full stroke-white stroke-[3] p-1" fill="none">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
        {!quizzes.length && (
          <div className="text-muted-foreground my-8 text-center">
            <p>{t("manager:quizz.notFound")}</p>
            <p className="text-sm">{t("manager:quizz.pleaseCreate")}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Onglets superadmin — composant isolé pour que les hooks
// ne s'exécutent QUE pour les superadmins
// ----------------------------------------------------------------
type TabKey = "play" | "quizz" | "results" | "managers" | "appearance"

interface SuperadminTabsProps {
  managerId: string
  activeTab: TabKey
  onTabChange: (_tab: TabKey) => void
}

const SuperadminTabs = ({ managerId, activeTab, onTabChange }: SuperadminTabsProps) => {
  const { managers, loading: managersLoading, createManager, updateManager, deleteManager } =
    useManagersApi()
  const { theme, saving: brandingSaving, save: saveBranding, uploadFile, resetField, apply: applyBrandingFn } =
    useBrandingApi()
  const { t } = useTranslation()

  const EXTRA_TABS: { key: "managers" | "appearance"; labelKey: string }[] = [
    { key: "managers",   labelKey: "manager:tabs.managers" },
    { key: "appearance", labelKey: "manager:tabs.appearance" },
  ]

  return (
    <>
      {/* Boutons d'onglets injectés dans la barre */}
      {EXTRA_TABS.map((tab) => (
        <ConfigTabButton
          key={tab.key}
          active={activeTab === tab.key}
          onClick={() => onTabChange(tab.key)}
        >
          {t(tab.labelKey)}
        </ConfigTabButton>
      ))}

      {/* Contenus rendus en dehors de la barre d'onglets via portail implicite */}
      {activeTab === "managers" && (
        <DashboardManagers
          managers={managers}
          loading={managersLoading}
          currentManagerId={managerId}
          onCreate={createManager}
          onUpdate={updateManager}
          onDelete={deleteManager}
        />
      )}
      {activeTab === "appearance" && (
        <DashboardAppearance
          theme={theme}
          saving={brandingSaving}
          onSave={saveBranding}
          onUpload={uploadFile}
          onReset={resetField}
          onApply={applyBrandingFn}
        />
      )}
    </>
  )
}

// ----------------------------------------------------------------
// Dashboard principal
// ----------------------------------------------------------------
const TABS_MANAGER = [
  { key: "play"    as const, labelKey: "manager:tabs.play" },
  { key: "quizz"   as const, labelKey: "manager:tabs.quizz" },
  { key: "results" as const, labelKey: "manager:tabs.results" },
]

const DashboardPage = () => {
  const { manager, loading: authLoading, logout } = useDashboardAuth()
  const isSuperadmin = manager?.role === "superadmin"

  const { quizzes, loading: quizLoading, deleteQuiz, importQuiz, exportQuiz } = useQuizApi()
  const { results, loading: resultsLoading, getResult, deleteResult, setVisibility } = useResultsApi()

  const [activeTab, setActiveTab] = useState<TabKey>("quizz")
  const { t } = useTranslation()

  const handleLogout = async () => {
    await logout()
    toast.success("Déconnecté")
  }

  if (authLoading) return null

  return (
    <Background>
      <Card className="max-h-[80svh] w-full max-w-md">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">{t("manager:configurationsTitle")}</p>
            {manager && (
              <p className="text-muted-foreground text-xs flex items-center gap-1.5">
                {manager.username}
                {isSuperadmin && (
                  <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    Super Admin
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-sm p-1.5"
              onClick={handleLogout}
              title={t("manager:logout")}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>

        {/* Barre d'onglets — les onglets superadmin sont injectés par SuperadminTabs */}
        <div className="bg-muted flex shrink-0 overflow-x-auto rounded-lg">
          {TABS_MANAGER.map((tab) => (
            <ConfigTabButton
              key={tab.key}
              active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {t(tab.labelKey)}
            </ConfigTabButton>
          ))}
          {isSuperadmin && (
            <>
              <ConfigTabButton
                active={activeTab === "managers"}
                onClick={() => setActiveTab("managers")}
              >
                {t("manager:tabs.managers")}
              </ConfigTabButton>
              <ConfigTabButton
                active={activeTab === "appearance"}
                onClick={() => setActiveTab("appearance")}
              >
                {t("manager:tabs.appearance")}
              </ConfigTabButton>
            </>
          )}
        </div>

        <hr className="text-muted my-4 border" />

        {/* Contenu */}
        <div className="flex min-h-0 flex-1 flex-col">
          {activeTab === "play" && <TabPlay quizzes={quizzes} loading={quizLoading} />}
          {activeTab === "quizz" && (
            <DashboardQuizList
              quizzes={quizzes}
              loading={quizLoading}
              onDelete={deleteQuiz}
              onImport={importQuiz}
              onExport={exportQuiz}
            />
          )}
          {activeTab === "results" && (
            <DashboardResults
              results={results}
              loading={resultsLoading}
              currentManagerId={manager?.id ?? ""}
              onDelete={deleteResult}
              onGetResult={getResult}
              onSetVisibility={setVisibility}
            />
          )}
          {/* Contenus superadmin — ne se montent que si isSuperadmin */}
          {isSuperadmin && (
            <SuperadminContent
              activeTab={activeTab}
              managerId={manager?.id ?? ""}
            />
          )}
        </div>
      </Card>
    </Background>
  )
}

// Contenu des onglets superadmin dans un composant séparé
// pour isoler useManagersApi et useBrandingApi
interface SuperadminContentProps {
  activeTab: TabKey
  managerId: string
}

const SuperadminContent = ({ activeTab, managerId }: SuperadminContentProps) => {
  const { managers, loading: managersLoading, createManager, updateManager, deleteManager } =
    useManagersApi()
  const { theme, saving: brandingSaving, save: saveBranding, uploadFile, resetField, apply: applyBrandingFn } =
    useBrandingApi()

  if (activeTab !== "managers" && activeTab !== "appearance") return null

  return (
    <>
      {activeTab === "managers" && (
        <DashboardManagers
          managers={managers}
          loading={managersLoading}
          currentManagerId={managerId}
          onCreate={createManager}
          onUpdate={updateManager}
          onDelete={deleteManager}
        />
      )}
      {activeTab === "appearance" && (
        <DashboardAppearance
          theme={theme}
          saving={brandingSaving}
          onSave={saveBranding}
          onUpload={uploadFile}
          onReset={resetField}
          onApply={applyBrandingFn}
        />
      )}
    </>
  )
}

export const Route = createFileRoute("/manager/dashboard")({
  component: DashboardPage,
})
