import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserRole } from '@/lib/user-roles'
import UsersManager from '@/components/users-manager'

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
    .in('role', ['admin', 'developer', 'promoter', 'tester', 'demo'])

  if (error) {
    console.error('Error fetching user roles for users page:', error)
  }

  const ids = Array.from(new Set((userRoles || []).map((u) => u.user_id)))

  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'user_id, name, username, profile_picture_url, age, country_code, gender, instagram_handle, snapchat_handle, connection_count, created_at, updated_at'
    )
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
      const p = profile as {
        user_id: string
        name?: string | null
        username?: string | null
        profile_picture_url?: string | null
        age?: number | null
        country_code?: string | null
        gender?: string | null
        instagram_handle?: string | null
        snapchat_handle?: string | null
        connection_count?: number
        created_at?: string | null
        updated_at?: string | null
      } | undefined
      return {
        id: u.user_id,
        role: u.role as string,
        name: p?.name ?? null,
        username: p?.username ?? null,
        profile_picture_url: p?.profile_picture_url ?? null,
        age: p?.age ?? null,
        country_code: p?.country_code ?? null,
        gender: p?.gender ?? null,
        instagram_handle: p?.instagram_handle ?? null,
        snapchat_handle: p?.snapchat_handle ?? null,
        connection_count: p?.connection_count ?? 0,
        created_at: p?.created_at ?? null,
        updated_at: p?.updated_at ?? null,
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
        demo: 4,
      }
      const aRank = order[a.role] ?? 99
      const bRank = order[b.role] ?? 99
      if (aRank !== bRank) return aRank - bRank
      return (a.name || '').localeCompare(b.name || '')
    })

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Users
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 break-words">
            Manage tester, demo, promoter, developer and admin accounts.
          </p>
        </div>

        <UsersManager initialUsers={users} />
      </div>
    </div>
  )
}


