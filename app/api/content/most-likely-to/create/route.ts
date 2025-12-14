import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
    const { question, category_id, difficulty_level } = body

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      )
    }

    const { data: questionData, error } = await supabase
      .from('most_likely_to_questions')
      .insert({
        question,
        category_id: category_id || null,
        difficulty_level: difficulty_level || 'medium',
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating most likely to question:', error)
      return NextResponse.json(
        { error: `Failed to create question: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(questionData, { status: 201 })
  } catch (error) {
    console.error('Error in create most likely to question route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

