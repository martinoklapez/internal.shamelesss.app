import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/user-roles'
import ActivityFeed from '@/components/activity-feed'

export default async function ActivityPage() {
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Activity</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 max-w-3xl">
            Recent app usage in tabs: connections, friend requests, latest messages, latest uploads, and profile views.
            Data comes from <code className="text-xs bg-gray-100 px-1 rounded">connections</code>,{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">friend_requests</code>,{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">messages</code>,{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">explicit_photos</code>, and{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">profile_views</code>.
          </p>
        </div>

        <ActivityFeed />
      </div>
    </div>
  )
}
