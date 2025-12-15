import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/user-roles'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const userRole = await getUserRole(user.id)
  const allowedRoles = ['admin', 'dev', 'developer']
  if (!userRole || !allowedRoles.includes(userRole)) {
    redirect('/home')
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Onboarding
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Tools and workflows for bringing new team members online.
          </p>
        </div>

        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">Coming soon</p>
          <p className="text-sm text-gray-600">
            We&apos;re working on a streamlined onboarding flow for developers and promoters.
          </p>
        </div>
      </div>
    </div>
  )
}


