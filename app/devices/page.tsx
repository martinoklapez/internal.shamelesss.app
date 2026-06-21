import { Suspense } from 'react'
import DevicesPageContent from '@/components/devices-page-content'
import { requirePanelUser } from '@/lib/auth/panel-access'

export default async function DevicesPage() {
  await requirePanelUser()

  return (
    <div className="flex min-h-screen w-full min-w-0 max-w-full flex-col overflow-hidden bg-white">
      <div className="mx-auto flex w-full max-w-7xl min-h-0 min-w-0 flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <Suspense fallback={<DevicesPageSkeleton />}>
          <DevicesPageContent />
        </Suspense>
      </div>
    </div>
  )
}

function DevicesPageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 space-y-2">
        <div className="h-9 w-64 rounded bg-gray-200" />
        <div className="h-4 w-96 max-w-full rounded bg-gray-100" />
      </div>
      <div className="space-y-3">
        <div className="h-24 rounded-lg border border-gray-200 bg-gray-50" />
        <div className="h-24 rounded-lg border border-gray-200 bg-gray-50" />
        <div className="h-24 rounded-lg border border-gray-200 bg-gray-50" />
      </div>
    </div>
  )
}
