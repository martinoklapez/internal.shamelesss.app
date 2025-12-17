import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/user-roles'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = await getUserRole(user.id)
    const allowedRoles = ['admin', 'dev', 'developer']
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as 'quiz' | 'conversion' | null

    let query = supabase
      .from('onboarding_components')
      .select('*')
      .order('component_name', { ascending: true })

    if (category) {
      // Filter by categories array containing the category
      // Supabase .contains() method checks if array contains the value
      query = query.contains('categories', [category])
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching onboarding components:', error)
      return NextResponse.json(
        { error: `Failed to fetch components: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ components: data || [] }, { status: 200 })
  } catch (error: any) {
    console.error('Error in components route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

