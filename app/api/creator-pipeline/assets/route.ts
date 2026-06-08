import { NextResponse } from 'next/server'
import { listPipelineAssets } from '@/lib/database/creator-pipeline/list-pipeline-assets'
import {
  assertPipelineAssetOwnerId,
  isPipelineAssetScope,
} from '@/lib/database/creator-pipeline/pipeline-assets'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

  const params = new URL(request.url).searchParams
  const scopeParam = params.get('scope')?.trim()
  const ownerId = params.get('ownerId')?.trim()

  const scope = scopeParam && isPipelineAssetScope(scopeParam) ? scopeParam : undefined

  if (ownerId) {
    try {
      assertPipelineAssetOwnerId(ownerId)
    } catch {
      return NextResponse.json({ error: 'Invalid owner id' }, { status: 400 })
    }
  }

  try {
    const assets = await listPipelineAssets({ scope, ownerId })
    return NextResponse.json({ assets })
  } catch (error) {
    console.error('GET /api/creator-pipeline/assets:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list assets' },
      { status: 500 }
    )
  }
}
