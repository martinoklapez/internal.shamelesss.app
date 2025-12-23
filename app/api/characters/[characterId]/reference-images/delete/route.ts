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
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Reference image ID is required' },
        { status: 400 }
      )
    }

    // Get the image URL before deleting
    const { data: referenceImage } = await supabase
      .from('character_reference_images')
      .select('image_url')
      .eq('id', id)
      .eq('character_id', characterId)
      .single()

    // Delete from database
    const { error: deleteError } = await supabase
      .from('character_reference_images')
      .delete()
      .eq('id', id)
      .eq('character_id', characterId)

    if (deleteError) {
      console.error('Error deleting reference image:', deleteError)
      return NextResponse.json(
        { error: `Failed to delete reference image: ${deleteError.message}` },
        { status: 500 }
      )
    }

    // Try to delete from storage if URL exists
    if (referenceImage?.image_url) {
      try {
        const urlParts = referenceImage.image_url.split('/')
        const fileName = urlParts[urlParts.length - 1].split('?')[0]
        const filePath = `${characterId}/${fileName}`
        await supabase.storage
          .from('character-references')
          .remove([filePath])
      } catch (storageError) {
        // Log but don't fail if storage deletion fails
        console.error('Error deleting file from storage:', storageError)
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Error in delete reference image route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

