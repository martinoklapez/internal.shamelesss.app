import { NextResponse } from 'next/server'
import { loadCreatorOutreachStoreFromDb } from '@/lib/database/creator-pipeline/load-store'
import { getCreatorPipelineSupabase } from '@/lib/database/creator-pipeline/supabase'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

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
    return NextResponse.json(store)
  } catch (error) {
    console.error('GET /api/creator-pipeline:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load pipeline' },
      { status: 500 }
    )
  }
}
