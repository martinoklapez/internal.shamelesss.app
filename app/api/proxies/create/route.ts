import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrCreateBatchId } from '@/lib/database/batch-id'

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
    const { device_id, type, host, port, username, password, api_address, country, city, fraud_score, asn } = body

    if (!device_id || !type || !host || !port) {
      return NextResponse.json(
        { error: 'Device ID, type, host, and port are required' },
        { status: 400 }
      )
    }

    if (!['HTTP', 'SOCKS5', 'SOCKS4'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid proxy type. Must be HTTP, SOCKS5, or SOCKS4' },
        { status: 400 }
      )
    }

    // Check if device already has an ACTIVE proxy
    const { data: existingProxy } = await supabase
      .from('proxies')
      .select('id')
      .eq('device_id', device_id)
      .eq('status', 'active')
      .single()

    if (existingProxy) {
      return NextResponse.json(
        { error: 'Device already has an active proxy. Please archive the existing one first.' },
        { status: 400 }
      )
    }

    // Get or create batch_id for this device (use active iCloud profile's batch_id if exists)
    const batchId = await getOrCreateBatchId(parseInt(device_id, 10))

    // Insert proxy into database
    const { data: proxy, error } = await supabase
      .from('proxies')
      .insert({
        device_id: parseInt(device_id, 10),
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
        batch_id: batchId,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating proxy:', error)
      return NextResponse.json(
        { error: `Failed to create proxy: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(proxy, { status: 201 })
  } catch (error) {
    console.error('Error in create proxy route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

