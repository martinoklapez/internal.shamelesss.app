import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/user-roles'
import ReengagementManager from '@/components/reengagement-manager'

export default async function ReengagementPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const userRole = await getUserRole(user.id)
  if (userRole !== 'admin' && userRole !== 'dev' && userRole !== 'developer') {
    redirect('/home')
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-full px-5 sm:px-8 lg:px-10 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Reengagement campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure campaign triggers, outputs, and test runs.
          </p>
        </div>
        <ReengagementManager />
      </div>
    </div>
  )
}
