import { Suspense } from 'react'
import DevicePageContent from '@/components/device-page-content'
import { requirePanelUser } from '@/lib/auth/panel-access'

interface DevicePageProps {
  params: Promise<{ deviceId: string }>
  searchParams?: Promise<{ from?: string }>
}

export default async function DevicePage({ params, searchParams }: DevicePageProps) {
  await requirePanelUser()
  const { deviceId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const backHref = resolvedSearchParams?.from === 'org' ? '/devices?view=org' : '/devices'

  return (
    <Suspense fallback={null}>
      <DevicePageContent deviceId={deviceId} backHref={backHref} />
    </Suspense>
  )
}
