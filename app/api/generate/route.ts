import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateImage } from '@/lib/replicate/client'
import { getNextGenerationNumber } from '@/lib/database/characters'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      character_id, 
      prompt, 
      selected_reference_image_ids,
      aspect_ratio,
      resolution,
      output_format,
    } = body

    if (!character_id) {
      return NextResponse.json(
        { error: 'Character ID is required' },
        { status: 400 }
      )
    }

    if (!prompt || prompt.trim() === '') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Validate and extract prompt text
    let promptText: string
    if (typeof prompt === 'string') {
      // Try to parse as JSON if it looks like JSON
      if (prompt.trim().startsWith('{')) {
        try {
          const promptObj = JSON.parse(prompt)
          if (promptObj.generation_parameters?.prompts?.positive) {
            promptText = promptObj.generation_parameters.prompts.positive
            console.log('Extracted prompt from JSON structure')
          } else if (promptObj.prompt) {
            promptText = promptObj.prompt
          } else {
            // Use the original string if we can't extract
            promptText = prompt
          }
        } catch (e) {
          // Not valid JSON, use as-is
          promptText = prompt
        }
      } else {
        promptText = prompt
      }
    } else if (typeof prompt === 'object' && prompt !== null) {
      // Prompt is already an object
      if (prompt.generation_parameters?.prompts?.positive) {
        promptText = prompt.generation_parameters.prompts.positive
        console.log('Extracted prompt from JSON object')
      } else if (prompt.prompt) {
        promptText = prompt.prompt
      } else {
        return NextResponse.json(
          { error: 'Invalid prompt format. Please provide a text prompt or a JSON object with a prompt field.' },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid prompt format. Please provide a text prompt.' },
        { status: 400 }
      )
    }

    // Get reference images - use selected ones or default to is_default=true
    let referenceImageQuery = supabase
      .from('character_reference_images')
      .select('image_url')
      .eq('character_id', character_id)

    if (selected_reference_image_ids && selected_reference_image_ids.length > 0) {
      referenceImageQuery = referenceImageQuery.in('id', selected_reference_image_ids)
    } else {
      referenceImageQuery = referenceImageQuery.eq('is_default', true)
    }

    const { data: referenceImages, error: refError } = await referenceImageQuery

    if (refError) {
      console.error('Error fetching reference images:', refError)
      return NextResponse.json(
        { error: `Failed to fetch reference images: ${refError.message}` },
        { status: 500 }
      )
    }

    const referenceImageUrls = (referenceImages || []).map((img) => img.image_url)

    console.log('Reference images to send:', {
      count: referenceImageUrls.length,
      urls: referenceImageUrls.map(url => url.substring(0, 80) + '...'),
    })

    // Generate image via Replicate
    let generatedImageUrl: string
    let predictionId: string

    try {
      const result = await generateImage(
        promptText.trim(), 
        referenceImageUrls,
        {
          aspect_ratio: aspect_ratio || undefined,
          resolution: resolution || undefined,
          output_format: output_format || undefined,
        }
      )
      generatedImageUrl = result.imageUrl
      predictionId = result.predictionId
    } catch (replicateError: any) {
      console.error('Error generating image with Replicate:', replicateError)
      console.error('Replicate error details:', JSON.stringify(replicateError, null, 2))
      return NextResponse.json(
        { 
          error: `Failed to generate image: ${replicateError.message}`,
          details: process.env.NODE_ENV === 'development' ? replicateError.message : undefined
        },
        { status: 500 }
      )
    }

    // Download the generated image
    let imageBuffer: ArrayBuffer
    try {
      const imageResponse = await fetch(generatedImageUrl)
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.statusText}`)
      }
      imageBuffer = await imageResponse.arrayBuffer()
    } catch (downloadError: any) {
      console.error('Error downloading generated image:', downloadError)
      return NextResponse.json(
        { error: `Failed to download generated image: ${downloadError.message}` },
        { status: 500 }
      )
    }

    // Get next generation number
    const generationNumber = await getNextGenerationNumber(character_id)

    // Determine file extension from URL or default to png
    const urlParts = generatedImageUrl.split('.')
    const ext = urlParts[urlParts.length - 1].split('?')[0] || 'png'
    const fileName = `${character_id}/${generationNumber}.${ext}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('character-generated')
      .upload(fileName, imageBuffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: `image/${ext}`,
      })

    if (uploadError) {
      console.error('Error uploading generated image:', uploadError)
      
      // Provide helpful error message for missing bucket
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        return NextResponse.json(
          { error: 'Storage bucket "character-generated" not found. Please create it in Supabase Dashboard > Storage. See supabase/STORAGE_SETUP.md for instructions.' },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: `Failed to upload generated image: ${uploadError.message || uploadError.toString()}` },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('character-generated')
      .getPublicUrl(fileName)

    // Save to database
    const { data: generatedImage, error: dbError } = await supabase
      .from('character_generated_images')
      .insert({
        character_id,
        image_url: publicUrl,
        prompt: promptText.trim(),
        replicate_prediction_id: predictionId || null,
        generation_number: generationNumber,
        is_archived: false,
      })
      .select()
      .single()

    if (dbError) {
      // Try to clean up uploaded file
      await supabase.storage
        .from('character-generated')
        .remove([fileName])
        .catch(() => {})

      console.error('Error saving generated image:', dbError)
      return NextResponse.json(
        { error: `Failed to save generated image: ${dbError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(generatedImage, { status: 201 })
  } catch (error: any) {
    console.error('Error in generate route:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

