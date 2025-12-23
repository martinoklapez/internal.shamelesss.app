import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { archiveGeneratedImage } from '@/lib/database/characters'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ characterId: string; imageId: string }> | { characterId: string; imageId: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = params instanceof Promise ? await params : params
    const { imageId } = resolvedParams

    const body = await request.json()
    const { is_archived } = body

    if (typeof is_archived !== 'boolean') {
      return NextResponse.json(
        { error: 'is_archived must be a boolean' },
        { status: 400 }
      )
    }

    const updatedImage = await archiveGeneratedImage(imageId, is_archived)

    return NextResponse.json(updatedImage, { status: 200 })
  } catch (error: any) {
    console.error('Error in archive image route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

