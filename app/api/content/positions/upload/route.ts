import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Verify authentication first
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const gameId = formData.get('game_id') as string

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Determine bucket name based on gameId
    const bucketName = gameId === 'date-roulette' ? 'date-roulette-poses' : 'poses'

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading file to storage:', uploadError)
      
      // Provide helpful error message for missing bucket
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        return NextResponse.json(
          { error: `Storage bucket "${bucketName}" not found. Please create it in Supabase Dashboard > Storage.` },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message || uploadError.toString()}` },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    return NextResponse.json({ imageUrl: publicUrl }, { status: 200 })
  } catch (error: any) {
    console.error('Error in upload position image route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

