import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AccountsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Accounts
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage user accounts
        </p>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-600 dark:text-gray-400">
          Accounts management coming soon.
        </p>
      </div>
    </div>
  )
}
