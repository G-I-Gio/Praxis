import Loader from "@razzia/web/components/Loader"
import { useDashboardAuth } from "@razzia/web/features/dashboard/useDashboardAuth"
import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/manager/quizz")({
  component: RouteComponent,
})

function RouteComponent() {
  const { loading } = useDashboardAuth()

  if (loading) {
    return (
      <div className="bg-muted flex h-svh items-center justify-center">
        <Loader className="text-background max-h-23" />
      </div>
    )
  }

  return <Outlet />
}
