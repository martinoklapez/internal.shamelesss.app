import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/user-roles'
import { getNotificationContentTemplates } from '@/lib/database/notification-content-templates'
import NotificationTemplatesManager from '@/components/notification-templates-manager'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const userRole = await getUserRole(user.id)
  if (userRole !== 'admin' && userRole !== 'dev' && userRole !== 'developer') {
    redirect('/home')
  }

  const templates = await getNotificationContentTemplates()

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-full px-5 sm:px-8 lg:px-10 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Push notifications
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Templates per type. Use the play button on a row to send a test push.
          </p>
        </div>

        <NotificationTemplatesManager initialTemplates={templates} />
      </div>
    </div>
  )
}
