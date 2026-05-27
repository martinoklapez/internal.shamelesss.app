import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/user-roles'
import AnalyticsProfileSignupsPanel from '@/components/analytics-profile-signups-panel'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const role = await getUserRole(user.id)
  if (role !== 'admin' && role !== 'dev' && role !== 'developer') {
    redirect('/home')
  }

  return (
    <div className="min-h-0 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            Pick a UTC date range: gender donut and age bar charts (<code className="rounded bg-gray-100 px-1 text-xs">profiles.created_at</code>; average age bars use profiles where <code className="rounded bg-gray-100 px-1 text-xs">age</code> is set).
          </p>
        </div>

        <AnalyticsProfileSignupsPanel />
      </div>
    </div>
  )
}
