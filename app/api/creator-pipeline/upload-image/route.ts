import { NextResponse } from 'next/server'
import {
  assertPipelineAssetOwnerId,
  isPipelineAssetScope,
  uploadPipelineAssetFile,
} from '@/lib/database/creator-pipeline/pipeline-assets'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

  try {
    const form = await request.formData()
    const file = form.get('file')
    const scope = String(form.get('scope') ?? '').trim()
    const ownerId = String(form.get('ownerId') ?? '').trim()

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }
    if (!isPipelineAssetScope(scope)) {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
    }

    try {
      assertPipelineAssetOwnerId(ownerId)
    } catch {
      return NextResponse.json({ error: 'Invalid owner id' }, { status: 400 })
    }

    const url = await uploadPipelineAssetFile(scope, ownerId, file)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('POST /api/creator-pipeline/upload-image:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
