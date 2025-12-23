import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ characterId: string }> | { characterId: string } }
) {
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

    console.log('Authenticated user:', user.id)

    // Handle both Promise and direct params (Next.js 14 vs 15)
    const resolvedParams = params instanceof Promise ? await params : params
    const { characterId } = resolvedParams
    
    // Verify the character exists and user has access BEFORE uploading
    const { data: character, error: charError } = await supabase
      .from('ai_characters')
      .select('id')
      .eq('id', characterId)
      .single()

    if (charError || !character) {
      console.error('Character not found:', charError)
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
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

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${characterId}/${Date.now()}.${fileExt}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('character-references')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading file to storage:', uploadError)
      
      // Provide helpful error message for missing bucket
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        return NextResponse.json(
          { error: 'Storage bucket "character-references" not found. Please create it in Supabase Dashboard > Storage. See supabase/STORAGE_SETUP.md for instructions.' },
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
      .from('character-references')
      .getPublicUrl(fileName)

    // Verify session is still valid before inserting
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      console.error('Session error:', sessionError)
      // Clean up uploaded file
      await supabase.storage
        .from('character-references')
        .remove([fileName])
        .catch(() => {})
      return NextResponse.json(
        { error: 'Session expired. Please refresh and try again.' },
        { status: 401 }
      )
    }

    console.log('Session valid, user ID:', session.user.id)
    console.log('Attempting to insert reference image for character:', characterId)

    // Save to database - use the same supabase client instance
    const { data: referenceImage, error: dbError } = await supabase
      .from('character_reference_images')
      .insert({
        character_id: characterId,
        image_url: publicUrl,
        is_default: false,
      })
      .select()
      .single()

    if (dbError) {
      // Try to clean up uploaded file
      await supabase.storage
        .from('character-references')
        .remove([fileName])
        .catch(() => {})

      console.error('Error saving reference image to database:', dbError)
      console.error('Error code:', dbError.code)
      console.error('Error message:', dbError.message)
      console.error('Error details:', JSON.stringify(dbError, null, 2))
      console.error('Current user ID:', user.id)
      console.error('Session user ID:', session.user.id)
      
      // Test if we can read from the table (to verify RLS SELECT policy works)
      const { data: testRead, error: testError } = await supabase
        .from('character_reference_images')
        .select('id')
        .limit(1)
      
      console.log('Test read result:', { testRead, testError })
      
      // Provide helpful error message for RLS policy violations
      if (dbError.message?.includes('row-level security policy') || dbError.code === '42501') {
        return NextResponse.json(
          { 
            error: 'Row-level security policy violation. The INSERT policy may not be correctly configured. Check server logs for details.',
            details: {
              errorCode: dbError.code,
              errorMessage: dbError.message,
              userId: user.id,
            }
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: `Failed to save reference image: ${dbError.message || dbError.toString()}` },
        { status: 500 }
      )
    }

    return NextResponse.json(referenceImage, { status: 201 })
  } catch (error: any) {
    console.error('Error in upload reference image route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

