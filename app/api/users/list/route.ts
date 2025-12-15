import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch users who have roles we care about in the admin panel
    // Using .select('*') to get all columns and ensure we're not missing any data
    const { data: usersWithRoles, error } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['admin', 'developer', 'promoter', 'tester'])

    if (error) {
      console.error('Error fetching users from user_roles:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { error: `Failed to fetch users: ${error.message}` },
        { status: 500 }
      )
    }

    if (!usersWithRoles || usersWithRoles.length === 0) {
      console.warn('No users found with roles: admin, developer, promoter, tester')
      return NextResponse.json({ users: [] }, { status: 200 })
    }

    // Get unique user IDs (in case a user has multiple roles)
    const userIds = [...new Set(usersWithRoles.map((u) => u.user_id))]
    console.log('Unique user IDs extracted:', userIds)
    console.log('Number of unique users:', userIds.length)

    // Fetch profiles for these users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, name, profile_picture_url')
      .in('user_id', userIds)

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      // Continue anyway, we'll use fallback data
    }

    console.log('Profiles fetched:', profiles)

    // Create a map of user_id to profile data for quick lookup
    const profileMap = new Map(
      (profiles || []).map((profile) => [profile.user_id, profile])
    )

    // Use admin client to fetch user emails as fallback
    let emailMap = new Map<string, string | null>()
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const adminSupabase = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Fetch user emails using admin API for fallback
        const emailPromises = userIds.map(async (userId) => {
          try {
            const { data: authUser, error: authError } = await adminSupabase.auth.admin.getUserById(userId)
            
            if (authError || !authUser?.user) {
              return { userId, email: null }
            }

            return { userId, email: authUser.user.email || null }
          } catch (error) {
            return { userId, email: null }
          }
        })

        const emailResults = await Promise.all(emailPromises)
        emailMap = new Map(emailResults.map((r) => [r.userId, r.email]))
      } catch (error) {
        console.error('Error fetching emails:', error)
      }
    }

    // Combine profile data with user IDs
    const users = userIds.map((userId) => {
      const profile = profileMap.get(userId)
      const email = emailMap.get(userId) || null

      return {
        id: userId,
        name: profile?.name || null,
        profile_picture_url: profile?.profile_picture_url || null,
        email: email, // Keep email as fallback
      }
    })

    console.log('Final users array:', users) // Debug log
    return NextResponse.json({ users }, { status: 200 })
  } catch (error) {
    console.error('Error in list users route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

