import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { characterId: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { characterId } = params
    const body = await request.json()
    const { id, is_default } = body

    if (!id || typeof is_default !== 'boolean') {
      return NextResponse.json(
        { error: 'Reference image ID and is_default are required' },
        { status: 400 }
      )
    }

    // Update the is_default flag
    const { data: referenceImage, error: updateError } = await supabase
      .from('character_reference_images')
      .update({ is_default })
      .eq('id', id)
      .eq('character_id', characterId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating reference image:', updateError)
      return NextResponse.json(
        { error: `Failed to update reference image: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(referenceImage, { status: 200 })
  } catch (error: any) {
    console.error('Error in toggle default reference image route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

