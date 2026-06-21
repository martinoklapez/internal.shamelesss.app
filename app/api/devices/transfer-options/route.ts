import { NextResponse } from 'next/server'
import { requireDeviceManagerUser } from '@/lib/api/device-manager-auth'
import { getTransferDeviceOptions } from '@/lib/database/device-transfer-options'

export async function GET() {
  const auth = await requireDeviceManagerUser()
  if (!auth.ok) return auth.response

  try {
    const options = await getTransferDeviceOptions()
    return NextResponse.json({ options })
  } catch (error) {
    console.error('GET /api/devices/transfer-options:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load transfer options' },
      { status: 500 }
    )
  }
}
