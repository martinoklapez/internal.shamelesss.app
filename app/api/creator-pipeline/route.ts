import { NextResponse } from 'next/server'
import { loadCreatorOutreachStoreFromDb } from '@/lib/database/creator-pipeline/load-store'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireCreatorCrmApi()
  if (auth instanceof NextResponse) return auth

  try {
    const store = await loadCreatorOutreachStoreFromDb(auth.supabase)
    return NextResponse.json(store)
  } catch (error) {
    console.error('GET /api/creator-pipeline:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load pipeline' },
      { status: 500 }
    )
  }
}
