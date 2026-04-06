import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/user-roles'
import {
  QUIZ_COMPONENT_IDS,
  CONVERSION_COMPONENT_IDS,
  COMPONENT_DISPLAY,
} from '@/lib/onboarding-component-ids'

export const dynamic = 'force-dynamic'

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
    const fallback = searchParams.get('fallback') !== 'false'

    let data: any[] = []

    if (category === 'quiz' || category === 'conversion') {
      // Which flow (quiz vs conversion) is controlled only by the categories column in onboarding_components
      const query = supabase
        .from('onboarding_components')
        .select('*')
        .order('component_name', { ascending: true })
        .contains('categories', [category])

      const { data: dbData, error } = await query

      if (error) {
        console.error('Error fetching onboarding components:', error)
        return NextResponse.json(
          { error: `Failed to fetch components: ${error.message}` },
          { status: 500 }
        )
      }

      data = dbData || []

      // Fallback: if DB is missing known components, add static entries so UI still works (with requested category)
      if (fallback) {
        const allowedIds =
          category === 'quiz' ? QUIZ_COMPONENT_IDS : CONVERSION_COMPONENT_IDS
        const hasKey = new Set(data.map((r: any) => r.component_key))
        for (const id of allowedIds) {
          if (!hasKey.has(id) && COMPONENT_DISPLAY[id]) {
            data.push({
              id: `static-${id}`,
              component_key: id,
              component_name: COMPONENT_DISPLAY[id].component_name,
              description: COMPONENT_DISPLAY[id].description,
              categories: [category],
              props_schema: null,
              default_options: null,
              created_at: null,
              updated_at: null,
            })
          }
        }
      }
      data.sort((a: any, b: any) =>
        (a.component_name || '').localeCompare(b.component_name || '')
      )

      // Enforce allowlists so mis-tagged DB rows (e.g. conversion-only components with "quiz" in categories)
      // never appear in the wrong funnel or pass the picker but fail on save.
      const allowedKeys =
        category === 'quiz'
          ? new Set(QUIZ_COMPONENT_IDS)
          : new Set(CONVERSION_COMPONENT_IDS)
      data = data.filter((r: any) => r.component_key && allowedKeys.has(r.component_key))
    } else {
      const { data: dbData, error } = await supabase
        .from('onboarding_components')
        .select('*')
        .order('component_name', { ascending: true })
      if (!error) data = dbData || []
    }

    return NextResponse.json({ components: data }, { status: 200 })
  } catch (error: any) {
    console.error('Error in components route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

