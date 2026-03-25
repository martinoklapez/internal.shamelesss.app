import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/api/admin-auth'

function maskSecret(secret: string) {
  const s = secret.trim()
  if (s.length === 0) return null
  const first = s.slice(0, Math.min(4, s.length))
  return `${first}*****`
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  const primary = process.env.REENGAGEMENT_SECRET?.trim() || ''
  const demo = process.env.DEMO_REENGAGEMENT_SECRET?.trim() || ''

  const hasPrimary = primary.length > 0
  const hasDemo = demo.length > 0

  // Intentionally do not return the raw secret value.
  return NextResponse.json({
    hasPrimary,
    hasDemo,
    primaryMasked: hasPrimary ? maskSecret(primary) : null,
    demoMasked: hasDemo ? maskSecret(demo) : null,
  })
}

