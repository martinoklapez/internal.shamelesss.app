import { NextRequest, NextResponse } from 'next/server'
import { loadCreatorOutreachStoreFromDb } from '@/lib/database/creator-pipeline/load-store'
import { getCreatorPipelineSupabase } from '@/lib/database/creator-pipeline/supabase'
import { lookupProfileContext } from '@/lib/creator-outreach/lookup-profile-context'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

  const tabUrl = request.nextUrl.searchParams.get('url')?.trim()
  if (!tabUrl) {
    return NextResponse.json({ error: 'Provide url query parameter' }, { status: 400 })
  }

  let supabase
  try {
    supabase = getCreatorPipelineSupabase()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    const store = await loadCreatorOutreachStoreFromDb(supabase)
    const context = lookupProfileContext(store, tabUrl)
    return NextResponse.json(context)
  } catch (error) {
    console.error('GET /api/creator-pipeline/context:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load context' },
      { status: 500 }
    )
  }
}
