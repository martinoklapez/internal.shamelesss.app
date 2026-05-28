import { requireCreatorCrmPage } from '@/lib/creator-outreach/require-creator-crm-page'

export default async function CreatorCrmLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireCreatorCrmPage()

  return (
    <div className="flex min-h-0 flex-1 w-full overflow-hidden bg-white">{children}</div>
  )
}
