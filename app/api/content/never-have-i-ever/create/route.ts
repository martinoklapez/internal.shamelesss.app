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
    const { statement, category_id, difficulty_level } = body

    if (!statement) {
      return NextResponse.json(
        { error: 'Statement is required' },
        { status: 400 }
      )
    }

    const { data: statementData, error } = await supabase
      .from('never_have_i_ever_statements')
      .insert({
        statement,
        category_id: category_id || null,
        difficulty_level: difficulty_level || 'medium',
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating never have I ever statement:', error)
      return NextResponse.json(
        { error: `Failed to create statement: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(statementData, { status: 201 })
  } catch (error) {
    console.error('Error in create never have I ever statement route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

