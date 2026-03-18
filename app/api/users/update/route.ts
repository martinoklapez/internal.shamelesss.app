import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserRole } from '@/lib/user-roles'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentRole = await getUserRole(user.id)
    if (currentRole !== 'admin' && currentRole !== 'dev' && currentRole !== 'developer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      userId,
      email,
      name,
      username,
      profile_picture_url,
      age,
      country_code,
      gender,
      instagram_handle,
      snapchat_handle,
      password,
      role,
      connection_count,
    } = body as {
      userId?: string
      email?: string | null
      name?: string | null
      username?: string | null
      profile_picture_url?: string | null
      age?: number | null
      country_code?: string | null
      gender?: string | null
      instagram_handle?: string | null
      snapchat_handle?: string | null
      password?: string | null
      role?: string | null
      connection_count?: number | null
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Service role key is not configured on the server' },
        { status: 500 }
      )
    }

    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Update auth user (email/password) if provided
    if ((email && email.length > 0) || (password && password.length > 0)) {
      const updateData: {
        email?: string
        password?: string
        email_confirm?: boolean
      } = {}

      if (email && email.length > 0) {
        updateData.email = email
        updateData.email_confirm = true
      }

      if (password && password.length > 0) {
        updateData.password = password
      }

      const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
        userId,
        updateData
      )

      if (updateError) {
        console.error('Error updating auth user:', updateError)
        return NextResponse.json(
          { error: `Failed to update auth user: ${updateError.message}` },
          { status: 500 }
        )
      }
    }

    // Update profile: all editable columns from profiles table
    const hasProfileUpdate =
      name !== undefined ||
      username !== undefined ||
      profile_picture_url !== undefined ||
      age !== undefined ||
      country_code !== undefined ||
      gender !== undefined ||
      instagram_handle !== undefined ||
      snapchat_handle !== undefined
    if (hasProfileUpdate) {
      const profileData: {
        user_id: string
        name?: string | null
        username?: string | null
        profile_picture_url?: string | null
        age?: number | null
        country_code?: string | null
        gender?: string | null
        instagram_handle?: string | null
        snapchat_handle?: string | null
      } = { user_id: userId }
      if (name !== undefined) profileData.name = name
      if (username !== undefined) profileData.username = username
      if (profile_picture_url !== undefined) profileData.profile_picture_url = profile_picture_url
      if (age !== undefined) profileData.age = age
      if (country_code !== undefined) profileData.country_code = country_code
      if (gender !== undefined) profileData.gender = gender
      if (instagram_handle !== undefined) profileData.instagram_handle = instagram_handle
      if (snapchat_handle !== undefined) profileData.snapchat_handle = snapchat_handle

      const { error: profileError } = await adminSupabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'user_id' })

      if (profileError) {
        console.error('Error updating profile:', profileError)
        return NextResponse.json(
          { error: `Failed to update profile: ${profileError.message}` },
          { status: 500 }
        )
      }
    }

    // Update role in user_roles if provided
    const allowedRoles = ['tester', 'demo', 'promoter', 'developer', 'admin']
    if (role !== undefined && role !== null && role !== '') {
      if (!allowedRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      const { error: roleError } = await adminSupabase
        .from('user_roles')
        .upsert({ user_id: userId, role }, { onConflict: 'user_id' })
      if (roleError) {
        console.error('Error updating user role:', roleError)
        return NextResponse.json(
          { error: `Failed to update role: ${roleError.message}` },
          { status: 500 }
        )
      }
    }

    if (connection_count !== undefined && connection_count !== null) {
      const { data: roleRow, error: roleFetchError } = await adminSupabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle()

      if (roleFetchError) {
        console.error('Error fetching role for connection_count:', roleFetchError)
        return NextResponse.json(
          { error: `Failed to verify user role: ${roleFetchError.message}` },
          { status: 500 }
        )
      }

      if (roleRow?.role !== 'demo') {
        return NextResponse.json(
          { error: 'Connection count can only be changed for users with the Demo role.' },
          { status: 403 }
        )
      }

      const n = Number(connection_count)
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000 || !Number.isInteger(n)) {
        return NextResponse.json(
          { error: 'connection_count must be an integer from 0 to 1000000' },
          { status: 400 }
        )
      }

      const { error: ccError } = await adminSupabase
        .from('profiles')
        .update({ connection_count: n })
        .eq('user_id', userId)

      if (ccError) {
        console.error('Error updating connection_count:', ccError)
        return NextResponse.json(
          { error: `Failed to update connection count: ${ccError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Error in update user route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


