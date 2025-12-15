import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserRole } from '@/lib/user-roles'
import UsersManager from '@/components/users-manager'
import { AddUserDialog } from '@/components/add-user-dialog'

export default async function UsersPage() {
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

  const { data: userRoles, error } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .in('role', ['admin', 'developer', 'promoter', 'tester'])

  if (error) {
    console.error('Error fetching user roles for users page:', error)
  }

  const ids = Array.from(new Set((userRoles || []).map((u) => u.user_id)))

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, profile_picture_url')
    .in('user_id', ids)

  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]))

  // Fetch emails via admin client so we can show current email in edit dialog
  let emailMap = new Map<string, string | null>()

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const emailResults = await Promise.all(
      ids.map(async (userId) => {
        try {
          const { data: authUser, error: authError } =
            await adminSupabase.auth.admin.getUserById(userId)

          if (authError || !authUser?.user) {
            return { userId, email: null }
          }

          return { userId, email: authUser.user.email || null }
        } catch {
          return { userId, email: null }
        }
      })
    )

    emailMap = new Map(emailResults.map((r) => [r.userId, r.email]))
  }

  const users = (userRoles || [])
    .map((u) => {
      const profile = profileMap.get(u.user_id)
      const email = emailMap.get(u.user_id) || null
      return {
        id: u.user_id,
        role: u.role as string,
        name: profile?.name || null,
        profile_picture_url: profile?.profile_picture_url || null,
        email,
      }
    })
    .sort((a, b) => {
      const order: Record<string, number> = {
        admin: 0,
        dev: 0, // treat dev as admin-level
        developer: 1,
        promoter: 2,
        tester: 3,
      }
      const aRank = order[a.role] ?? 99
      const bRank = order[b.role] ?? 99
      if (aRank !== bRank) return aRank - bRank
      return (a.name || '').localeCompare(b.name || '')
    })

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Users
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage tester, promoter, developer and admin accounts.
            </p>
          </div>
          <AddUserDialog />
        </div>

        <UsersManager initialUsers={users} />
      </div>
    </div>
  )
}


