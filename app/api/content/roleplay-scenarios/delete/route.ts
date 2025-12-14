import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Scenario ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('roleplay_scenarios')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting roleplay scenario:', error)
      return NextResponse.json(
        { error: `Failed to delete scenario: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error in delete roleplay scenario route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

