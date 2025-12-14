import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getFeatureFlags } from '@/lib/database/feature-flags'
import FeatureFlagsManager from '@/components/feature-flags-manager'
import { getUserRole } from '@/lib/user-roles'

export default async function FeatureFlagsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const userRole = await getUserRole(user.id)
  
  // Only allow admin, dev, and developer roles
  if (userRole !== 'admin' && userRole !== 'dev' && userRole !== 'developer') {
    redirect('/home')
  }

  const featureFlags = await getFeatureFlags()

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Feature Flags
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage feature flags for the application
          </p>
        </div>

        <FeatureFlagsManager featureFlags={featureFlags} />
      </div>
    </div>
  )
}

