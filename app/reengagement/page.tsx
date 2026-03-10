import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/user-roles'
import { getDemoReengagementConfig } from '@/lib/database/demo-reengagement-config'
import DemoReengagementManager from '@/components/demo-reengagement-manager'
import DemoReengagementLogs from '@/components/demo-reengagement-logs'

export default async function ReengagementPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const role = await getUserRole(user.id)
  const canEdit = role === 'admin' || role === 'dev' || role === 'developer'
  const config = await getDemoReengagementConfig()

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Reengagement
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Campaigns for the reengagement edge function. Each campaign has its own trigger, target
            selection, and rate limits.
          </p>
        </div>

        <DemoReengagementManager initialConfig={config} canEdit={canEdit} />

        <div className="mt-10 border-t border-gray-200 pt-10">
          <DemoReengagementLogs />
        </div>
      </div>
    </div>
  )
}
