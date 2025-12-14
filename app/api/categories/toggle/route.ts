import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { categoryId, isActive } = await request.json()

    if (!categoryId || typeof isActive !== 'boolean') {
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

    // Update the category
    const { error: updateError } = await supabase
      .from('categories')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
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
      // Even if fetch fails, the update might have succeeded
      // Return a success response with the expected structure
      return NextResponse.json({
        id: categoryId,
        is_active: isActive,
        message: 'Category updated successfully, but could not fetch updated data'
      })
    }

    if (!updatedCategory) {
      return NextResponse.json(
        { error: 'Category update succeeded but could not retrieve updated data' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedCategory)
  } catch (error) {
    console.error('Error in toggle route:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

