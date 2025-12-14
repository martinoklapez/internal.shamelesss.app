import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { categoryId, updates } = await request.json()

    if (!categoryId || !updates) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Add updated_at timestamp
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    }

    // Update the category
    const { error: updateError } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', categoryId)

    if (updateError) {
      console.error('Error updating category:', updateError)
      return NextResponse.json(
        { error: 'Failed to update category', details: updateError.message },
        { status: 500 }
      )
    }

    // Fetch the updated category
    const { data: updatedCategory, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', categoryId)
      .single()

    if (fetchError) {
      console.error('Error fetching updated category:', fetchError)
      return NextResponse.json(
        { error: 'Category updated but could not fetch updated data', details: fetchError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedCategory)
  } catch (error) {
    console.error('Error in update route:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

