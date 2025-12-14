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
    const { proxyId } = body

    if (!proxyId || typeof proxyId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid proxyId. Must be a non-empty string.' },
        { status: 400 }
      )
    }

    // Update the proxy status to archived
    const { data: proxy, error } = await supabase
      .from('proxies')
      .update({ status: 'archived' })
      .eq('id', proxyId)
      .select()
      .single()

    if (error) {
      console.error('Error archiving proxy:', error)
      return NextResponse.json(
        { error: `Failed to archive proxy: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(proxy, { status: 200 })
  } catch (error) {
    console.error('Error in archive proxy route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

