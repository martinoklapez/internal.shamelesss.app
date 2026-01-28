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
      email,
      name,
      role,
      password,
      username,
      age,
      country_code,
      gender,
      instagram_handle,
      snapchat_handle,
    } = body as {
      email?: string
      name?: string
      role?: string
      password?: string | null
      username?: string | null
      age?: number | null
      country_code?: string | null
      gender?: string | null
      instagram_handle?: string | null
      snapchat_handle?: string | null
    }

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
    }

    const allowedRoles = ['tester', 'demo', 'promoter', 'developer', 'admin']
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
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

    // Create user in auth with provided password or a random one
    const finalPassword = password && password.length > 0 ? password : crypto.randomUUID()

    const { data: created, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true, // auto-confirm email
    })

    if (createError || !created?.user) {
      console.error('Error creating auth user:', createError)
      const message = createError?.message || 'Failed to create auth user'
      // Duplicate email is a client error, not a server error
      const isDuplicateEmail =
        message.toLowerCase().includes('already been registered') ||
        message.toLowerCase().includes('already exists') ||
        createError?.status === 422
      return NextResponse.json(
        { error: message },
        { status: isDuplicateEmail ? 409 : 500 }
      )
    }

    const newUserId = created.user.id

    // Insert or update role using service client (bypasses RLS)
    const { error: roleError } = await adminSupabase
      .from('user_roles')
      .upsert({ user_id: newUserId, role }, { onConflict: 'user_id' })

    if (roleError) {
      console.error('Error inserting user role:', roleError)
      return NextResponse.json(
        { error: `Failed to assign role: ${roleError.message}` },
        { status: 500 }
      )
    }

    // Ensure a profile row exists with all provided fields (via service client to avoid RLS issues)
    const ageNum = age != null && !Number.isNaN(Number(age)) ? Number(age) : null
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .upsert(
        {
          user_id: newUserId,
          name: name || null,
          username: username || null,
          age: ageNum,
          country_code: country_code || null,
          gender: gender || null,
          instagram_handle: instagram_handle || null,
          snapchat_handle: snapchat_handle || null,
        },
        { onConflict: 'user_id' }
      )

    if (profileError) {
      console.error('Error upserting profile:', profileError)
      // Do not fail the whole request, but report it
    }

    return NextResponse.json(
      {
        id: newUserId,
        email,
        name: name || null,
        role,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error in create user route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


