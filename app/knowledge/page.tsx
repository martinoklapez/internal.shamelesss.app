import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/user-roles'

export default async function KnowledgePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const userRole = await getUserRole(user.id)
  const allowedRoles = ['admin', 'dev', 'developer', 'promoter']
  if (!userRole || !allowedRoles.includes(userRole)) {
    redirect('/home')
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Knowledge
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Central place for internal documentation, playbooks, and best practices.
          </p>
        </div>

        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">Coming soon</p>
          <p className="text-sm text-gray-600">
            We&apos;re building a shared knowledge base for your team.
          </p>
        </div>
      </div>
    </div>
  )
}


