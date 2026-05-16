import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/user-roles'
import ProfilesCleanupPanel from '@/components/profiles-cleanup-panel'

export default async function ProfilesPage() {
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
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Profiles</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            List and search <code className="text-xs bg-gray-100 px-1 rounded">profiles</code>, filter by
            demo role, delete accounts (profile, roles, auth — storage untouched). When{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">PROFILES_BACKUP_PASSCODE</code> is set on the
            server, backup/export/restore unlocks via the archive icon and that passcode.
          </p>
        </div>

        <ProfilesCleanupPanel />
      </div>
    </div>
  )
}
