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
    const { proxyId, type, host, port, username, password, api_address, country, city, fraud_score, asn } = body

    if (!proxyId || !type || !host || !port) {
      return NextResponse.json(
        { error: 'Proxy ID, type, host, and port are required' },
        { status: 400 }
      )
    }

    if (!['HTTP', 'SOCKS5', 'SOCKS4'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid proxy type. Must be HTTP, SOCKS5, or SOCKS4' },
        { status: 400 }
      )
    }

    // Update proxy in database
    const { data: proxy, error } = await supabase
      .from('proxies')
      .update({
        type,
        host,
        port: parseInt(port, 10),
        username: username || null,
        password: password || null,
        api_address: api_address || null,
        country: country || null,
        city: city || null,
        fraud_score: fraud_score ? parseInt(fraud_score, 10) : null,
        asn: asn || null,
      })
      .eq('id', proxyId)
      .select()
      .single()

    if (error) {
      console.error('Error updating proxy:', error)
      return NextResponse.json(
        { error: `Failed to update proxy: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(proxy, { status: 200 })
  } catch (error) {
    console.error('Error in update proxy route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

