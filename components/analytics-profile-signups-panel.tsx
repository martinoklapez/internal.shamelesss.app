'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { ChartConfig } from '@/components/ui/chart'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type GenderRow = {
  day: string
  male: number
  female: number
  other: number
  unknown: number
}

type Payload = {
  from_day: string
  to_day: string
  total_profiles: number
  average_age_known: number | null
  profiles_with_known_age_for_avg: number
  by_exact_age: Array<{ age: number; signups: number }>
  byGenderDay: GenderRow[]
}

function utcTodayYYYYMMDD(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10)
}

function utcAddDays(dayYYYYMMDD: string, deltaDays: number): string {
  const [y, m, d] = dayYYYYMMDD.split('-').map(Number) as [number, number, number]
  const t = Date.UTC(y, m - 1, d) + deltaDays * 24 * 60 * 60 * 1000
  return new Date(t).toISOString().slice(0, 10)
}

const COLORS_GENDER = {
  male: 'hsl(221 83% 53%)',
  female: 'hsl(292 61% 48%)',
  other: 'hsl(262 83% 58%)',
  unknown: 'hsl(215 14% 70%)',
} as const

const LABELS_GENDER = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  unknown: 'Unknown',
} as const

const GENDER_KEYS = ['male', 'female', 'other', 'unknown'] as const

type SliceDatum = { key: string; label: string; value: number; fill: string }

const chartConfigGender = GENDER_KEYS.reduce(
  (acc, k) => {
    acc[k] = {
      label: LABELS_GENDER[k],
      color: COLORS_GENDER[k],
    }
    return acc
  },
  {} as ChartConfig
)

const chartConfigAgeSignups: ChartConfig = {
  signups: {
    label: 'New profiles',
    color: 'hsl(258 73% 55%)',
  },
}

const chartConfigAgeAvg: ChartConfig = {
  avgYears: {
    label: 'Average age (years)',
    color: 'hsl(173 58% 39%)',
  },
}

function aggregateGenderSlices(rows: GenderRow[]): SliceDatum[] {
  const totals: Record<(typeof GENDER_KEYS)[number], number> = {
    male: 0,
    female: 0,
    other: 0,
    unknown: 0,
  }
  for (const row of rows) {
    for (const k of GENDER_KEYS) totals[k] += row[k]
  }
  return GENDER_KEYS.map((k) => ({
    key: k,
    label: LABELS_GENDER[k],
    value: totals[k],
    fill: COLORS_GENDER[k],
  }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
}

/** Hide labels on very thin slices to reduce clutter. */
function signupPieLabel(props: {
  cx?: number
  cy?: number
  midAngle?: number
  innerRadius?: number
  outerRadius?: number
  name?: string
  percent?: number
}) {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, name, percent = 0 } = props
  if (percent < 0.06 || !name) return null
  const RAD = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * RAD)
  const y = cy + r * Math.sin(-midAngle * RAD)
  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-[11px] font-medium"
    >
      {`${name} ${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

function GenderPieTooltip(props: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; payload?: SliceDatum }>
}) {
  if (!props.active || !props.payload?.length) return null
  const row = props.payload[0].payload ?? props.payload[0]
  const name = typeof row === 'object' && row !== null && 'label' in row ? row.label : 'Signups'
  const rawValue =
    typeof row === 'object' && row !== null && 'value' in row ? row.value : props.payload[0].value
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-md">
      <p className="mb-1 font-medium text-gray-900">{String(name)}</p>
      <div className="flex items-center justify-between gap-6">
        <span className="text-gray-600">Signups</span>
        <span className="font-mono font-medium tabular-nums text-gray-900">
          {typeof rawValue === 'number' ? rawValue.toLocaleString() : String(rawValue)}
        </span>
      </div>
    </div>
  )
}

export default function AnalyticsProfileSignupsPanel() {
  const [from, setFrom] = useState(() => utcAddDays(utcTodayYYYYMMDD(), -13))
  const [to, setTo] = useState(() => utcTodayYYYYMMDD())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<Payload | null>(null)

  const applyPreset = useCallback((daysInclusive: number) => {
    const end = utcTodayYYYYMMDD()
    setTo(end)
    setFrom(utcAddDays(end, -(daysInclusive - 1)))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/analytics/profile-signups?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load analytics')
      setPayload({
        from_day: json.from_day,
        to_day: json.to_day,
        total_profiles: json.total_profiles ?? 0,
        average_age_known: typeof json.average_age_known === 'number' ? json.average_age_known : null,
        profiles_with_known_age_for_avg:
          typeof json.profiles_with_known_age_for_avg === 'number'
            ? json.profiles_with_known_age_for_avg
            : 0,
        by_exact_age: Array.isArray(json.by_exact_age) ? json.by_exact_age : [],
        byGenderDay: json.byGenderDay ?? [],
      })
    } catch (e) {
      setPayload(null)
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  const subtitle = useMemo(() => {
    if (!payload) return ''
    return `${payload.total_profiles.toLocaleString()} new profiles (${payload.from_day} → ${payload.to_day}), UTC calendar days`
  }, [payload])

  const genderPieData = useMemo(
    () => (payload?.byGenderDay?.length ? aggregateGenderSlices(payload.byGenderDay) : []),
    [payload]
  )

  const exactAgeChartRows = useMemo(() => {
    if (!payload?.by_exact_age?.length) return []
    return payload.by_exact_age.map(({ age, signups }) => ({
      age,
      ageLabel: String(age),
      signups,
    }))
  }, [payload])

  const exactAgeTickInterval = exactAgeChartRows.length > 40 ? 2 : exactAgeChartRows.length > 22 ? 1 : 0

  const avgAgeBarData = useMemo(() => {
    if (
      payload == null ||
      payload.average_age_known == null ||
      !Number.isFinite(payload.average_age_known)
    ) {
      return []
    }
    return [
      {
        caption: 'Average age',
        avgYears: payload.average_age_known,
      },
    ]
  }, [payload])

  const avgYearsDomainMax = useMemo(() => {
    if (!payload?.average_age_known) return 80
    return Math.min(95, Math.max(40, Math.ceil(payload.average_age_known + 14)))
  }, [payload])

  return (
    <div className="space-y-6">
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold tracking-tight">Date range</CardTitle>
          <CardDescription>
            Count profiles whose <code className="text-xs">created_at</code> falls on a UTC day in the interval.
            Gender uses a donut chart below; age uses bar charts built with the shared chart shell.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => applyPreset(7)}>
              Last 7 days
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => applyPreset(14)}>
              Last 14 days
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => applyPreset(30)}>
              Last 30 days
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <Label htmlFor="analytics-from" className="text-xs text-gray-600">
                From (UTC day)
              </Label>
              <input
                id="analytics-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="analytics-to" className="text-xs text-gray-600">
                To (UTC day)
              </Label>
              <input
                id="analytics-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
              />
            </div>
            <Button type="button" size="sm" className="h-9 shrink-0" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {subtitle && !loading ? <p className="text-sm text-gray-600">{subtitle}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Gender</CardTitle>
            <CardDescription>Share of signups in range · shadcn chart shell + donut</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[320px] w-full">
              {!loading && payload && genderPieData.length > 0 ? (
                <ChartContainer config={chartConfigGender} className="aspect-square mx-auto max-h-[300px] w-full">
                  <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <Pie
                      data={genderPieData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="47%"
                      innerRadius={58}
                      outerRadius={108}
                      paddingAngle={1}
                      labelLine={false}
                      label={signupPieLabel}
                    >
                      {genderPieData.map((d) => (
                        <Cell key={d.key} fill={d.fill} stroke="#fff" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip cursor={false} content={<GenderPieTooltip />} />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                    />
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  {loading ? 'Loading chart…' : 'No signups in range.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Signups by age (years)</CardTitle>
              <CardDescription>
                One bar per integer age present in the range (rounded from <code className="text-xs">profiles.age</code>
                ). Unknown / missing ages are excluded.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div
                className={cn(
                  'w-full',
                  exactAgeChartRows.length > 35 ? 'min-h-[300px] h-[360px]' : 'h-[280px]'
                )}
              >
                {!loading && payload && exactAgeChartRows.length > 0 ? (
                  <ChartContainer config={chartConfigAgeSignups} className="h-full w-full">
                    <BarChart
                      data={exactAgeChartRows}
                      margin={{ top: 12, right: 8, left: -4, bottom: exactAgeChartRows.length > 14 ? 48 : 12 }}
                    >
                      <CartesianGrid strokeDasharray="4 6" stroke="#e8e8e8" vertical={false} />
                      <XAxis
                        dataKey="ageLabel"
                        type="category"
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                        interval={exactAgeTickInterval}
                        angle={exactAgeChartRows.length > 14 ? -42 : 0}
                        textAnchor={exactAgeChartRows.length > 14 ? 'end' : 'middle'}
                        height={exactAgeChartRows.length > 14 ? 48 : 28}
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <Tooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="signups"
                        name="signups"
                        fill={chartConfigAgeSignups.signups?.color}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={
                          exactAgeChartRows.length > 50
                            ? 12
                            : exactAgeChartRows.length > 30
                              ? 18
                              : 32
                        }
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">
                    {loading ? 'Loading chart…' : 'No numeric ages in this range.'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Average age</CardTitle>
              <CardDescription>
                Mean numeric age across profiles where <code className="text-xs">age</code> is set ({' '}
                {payload?.profiles_with_known_age_for_avg ?? 0} profiles in this range){' '}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[160px] w-full">
                {!loading && avgAgeBarData.length > 0 && payload?.average_age_known != null ? (
                  <ChartContainer config={chartConfigAgeAvg} className="h-full w-full">
                    <BarChart
                      data={avgAgeBarData}
                      margin={{ top: 28, right: 12, left: -4, bottom: 52 }}
                      barCategoryGap={40}
                    >
                      <CartesianGrid strokeDasharray="4 6" stroke="#e8e8e8" vertical={false} />
                      <XAxis
                        type="category"
                        dataKey="caption"
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        interval={0}
                      />
                      <YAxis
                        allowDecimals={true}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                        domain={[0, avgYearsDomainMax]}
                        tickFormatter={(v) => `${v}`}
                      />
                      <Tooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="avgYears"
                        name="avgYears"
                        fill={chartConfigAgeAvg.avgYears?.color}
                        radius={[8, 8, 4, 4]}
                        maxBarSize={120}
                      >
                        <LabelList
                          dataKey="avgYears"
                          position="top"
                          formatter={(v: number) => `${v} yrs`}
                          fontSize={12}
                          fill="#374151"
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">
                    {loading
                      ? 'Loading chart…'
                      : 'No profiles with a numeric age in this range.'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
