import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPrediction } from '@/lib/replicate/client'

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
    const { prediction_id } = body

    if (!prediction_id) {
      return NextResponse.json(
        { error: 'Prediction ID is required' },
        { status: 400 }
      )
    }

    // Get the prediction from Replicate to get the original output URL
    const prediction = await getPrediction(prediction_id)

    if (!prediction.output) {
      return NextResponse.json(
        { error: 'No output found for this prediction' },
        { status: 404 }
      )
    }

    // Handle both single string and array outputs
    const outputUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output

    if (typeof outputUrl !== 'string') {
      return NextResponse.json(
        { error: 'Invalid output format' },
        { status: 500 }
      )
    }

    // Return the original Replicate URL for highest quality download
    return NextResponse.json({ 
      imageUrl: outputUrl,
      predictionId: prediction_id
    })
  } catch (error: any) {
    console.error('Error fetching original image:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

