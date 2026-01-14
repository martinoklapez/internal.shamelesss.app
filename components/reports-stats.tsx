'use client'

import { Card } from '@/components/ui/card'

interface ReportStats {
  total: number
  open: number
  closed: number
  recentCount: number
}

interface ReportsStatsProps {
  stats: ReportStats | null
}

export function ReportsStats({ stats }: ReportsStatsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 sm:p-6">
            <div className="h-16 bg-gray-100 animate-pulse rounded" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card className="p-4 sm:p-6">
        <div className="text-sm font-medium text-gray-600">Total Reports</div>
        <div className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{stats.total}</div>
        <div className="mt-1 text-xs text-gray-500">{stats.recentCount} in last 7 days</div>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="text-sm font-medium text-gray-600">Open</div>
        <div className="mt-2 text-2xl sm:text-3xl font-bold text-blue-600">{stats.open}</div>
        <div className="mt-1 text-xs text-gray-500">
          {stats.total > 0 ? Math.round((stats.open / stats.total) * 100) : 0}% of total
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="text-sm font-medium text-gray-600">Closed</div>
        <div className="mt-2 text-2xl sm:text-3xl font-bold text-gray-600">{stats.closed}</div>
        <div className="mt-1 text-xs text-gray-500">
          {stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0}% of total
        </div>
      </Card>
    </div>
  )
}

