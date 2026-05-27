import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAdminUser } from '@/lib/api/admin-auth'

export const dynamic = 'force-dynamic'

const MAX_RANGE_DAYS = 120
const PAGE = 1500

type ProfileRow = { created_at: string | null; gender: string | null; age: number | null }

function utcDayBoundaryIso(dayYYYYMMDD: string, end: boolean): string {
  const parts = dayYYYYMMDD.trim().split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) throw new Error('invalid date')
  const [y, m, d] = parts as [number, number, number]
  return new Date(
    Date.UTC(y, m - 1, d, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0)
  ).toISOString()
}

function eachUtcDayInclusive(fromDay: string, toDay: string): string[] {
  const days: string[] = []
  const [fy, fm, fd] = fromDay.split('-').map(Number) as [number, number, number]
  let cursor = Date.UTC(fy, fm - 1, fd)
  const [ty, tm, td] = toDay.split('-').map(Number) as [number, number, number]
  const end = Date.UTC(ty, tm - 1, td)
  while (cursor <= end) {
    days.push(new Date(cursor).toISOString().slice(0, 10))
    cursor += 24 * 60 * 60 * 1000
  }
  return days
}

function dayKeyUtc(iso: string): string | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Date(t).toISOString().slice(0, 10)
}

function genderBucket(g: string | null): 'male' | 'female' | 'other' | 'unknown' {
  const s = (g ?? '').trim().toLowerCase()
  if (!s) return 'unknown'
  if (s === 'male' || s === 'man' || s === 'm') return 'male'
  if (s === 'female' || s === 'woman' || s === 'f') return 'female'
  return 'other'
}

function ageBucket(age: number | null): 'under_18' | '18_24' | '25_34' | '35_44' | '45_plus' | 'unknown' {
  if (age == null || !Number.isFinite(age)) return 'unknown'
  const n = Math.floor(age)
  if (n < 18) return 'under_18'
  if (n <= 24) return '18_24'
  if (n <= 34) return '25_34'
  if (n <= 44) return '35_44'
  return '45_plus'
}

const GENDER_KEYS = ['male', 'female', 'other', 'unknown'] as const
const AGE_KEYS = ['under_18', '18_24', '25_34', '35_44', '45_plus', 'unknown'] as const

type GenderAggRow = { day: string } & Record<(typeof GENDER_KEYS)[number], number>
type AgeAggRow = { day: string } & Record<(typeof AGE_KEYS)[number], number>

function emptyGenderRow(day: string): GenderAggRow {
  return { day, male: 0, female: 0, other: 0, unknown: 0 }
}

function emptyAgeRow(day: string): AgeAggRow {
  return { day, under_18: 0, '18_24': 0, '25_34': 0, '35_44': 0, '45_plus': 0, unknown: 0 }
}

export async function GET(request: Request) {
  const auth = await requireAdminUser()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const fromDay = searchParams.get('from')?.trim()
  const toDay = searchParams.get('to')?.trim()

  if (!fromDay || !toDay || !/^\d{4}-\d{2}-\d{2}$/.test(fromDay) || !/^\d{4}-\d{2}-\d{2}$/.test(toDay)) {
    return NextResponse.json({ error: 'from and to are required as YYYY-MM-DD' }, { status: 400 })
  }

  let startIso: string
  let endIso: string
  try {
    startIso = utcDayBoundaryIso(fromDay, false)
    endIso = utcDayBoundaryIso(toDay, true)
  } catch {
    return NextResponse.json({ error: 'Invalid from or to date' }, { status: 400 })
  }

  if (fromDay > toDay) {
    return NextResponse.json({ error: 'from must be on or before to' }, { status: 400 })
  }

  const dayList = eachUtcDayInclusive(fromDay, toDay)
  if (dayList.length > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { error: `Date range exceeds ${MAX_RANGE_DAYS} days; narrow the interval` },
      { status: 400 }
    )
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service role key is not configured on the server' }, { status: 500 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const profiles: ProfileRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await admin
      .from('profiles')
      .select('created_at,gender,age')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (error) {
      console.error('analytics profile-signups:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const chunk = data as ProfileRow[] | null
    if (!chunk?.length) break
    profiles.push(...chunk)
    if (chunk.length < PAGE) break
    offset += PAGE
  }

  const genderMap = new Map<string, GenderAggRow>()
  const ageMap = new Map<string, AgeAggRow>()

  let ageKnownSum = 0
  let ageKnownCount = 0

  /** Integer age → signup count (profiles with numeric age in range). */
  const exactAgeCounts = new Map<number, number>()

  for (const d of dayList) {
    genderMap.set(d, emptyGenderRow(d))
    ageMap.set(d, emptyAgeRow(d))
  }

  for (const p of profiles) {
    const dk = p.created_at ? dayKeyUtc(p.created_at) : null
    if (!dk || !genderMap.has(dk)) continue
    const gRow = genderMap.get(dk)!
    const g = genderBucket(p.gender)
    gRow[g] = (gRow[g] as number) + 1

    const aRow = ageMap.get(dk)!
    const ak = ageBucket(p.age)
    aRow[ak] = (aRow[ak] as number) + 1

    if (p.age != null && Number.isFinite(p.age)) {
      const rawAge = Number(p.age)
      ageKnownSum += rawAge
      ageKnownCount += 1
      const yrs = Math.round(rawAge)
      if (yrs >= 0 && yrs <= 120) {
        exactAgeCounts.set(yrs, (exactAgeCounts.get(yrs) ?? 0) + 1)
      }
    }
  }

  const byGenderDay = dayList.map((d) => genderMap.get(d)!)
  const byAgeDay = dayList.map((d) => ageMap.get(d)!)
  const average_age_known =
    ageKnownCount > 0 ? Math.round((ageKnownSum / ageKnownCount) * 10) / 10 : null

  const by_exact_age = [...exactAgeCounts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([age, signups]) => ({ age, signups }))

  return NextResponse.json({
    from_day: fromDay,
    to_day: toDay,
    total_profiles: profiles.length,
    average_age_known,
    profiles_with_known_age_for_avg: ageKnownCount,
    by_exact_age,
    byGenderDay,
    byAgeDay,
  })
}
