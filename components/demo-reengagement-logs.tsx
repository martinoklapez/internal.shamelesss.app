'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type LogsData = {
  absolute_runs: Record<string, unknown>[]
  completed: Record<string, unknown>[]
  last_run: Record<string, unknown>[]
  scheduled_requests: Record<string, unknown>[]
  campaigns: { id: string; name: string }[]
}

function formatTs(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function campaignName(id: string | null | undefined, campaigns: { id: string; name: string }[]): string {
  if (!id) return '—'
  const c = campaigns.find((x) => x.id === id)
  return c?.name ?? id.slice(0, 8) + '…'
}

export default function DemoReengagementLogs() {
  const [data, setData] = useState<LogsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/demo-reengagement-logs')
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">Loading logs…</CardContent>
      </Card>
    )
  }
  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-red-600">{error}</CardContent>
      </Card>
    )
  }
  if (!data) return null

  const { absolute_runs, completed, last_run, scheduled_requests, campaigns } = data

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Logs</h2>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Absolute runs</CardTitle>
          <p className="text-xs text-gray-500">Time-based campaign runs (run_date, campaign)</p>
        </CardHeader>
        <CardContent>
          {absolute_runs.length === 0 ? (
            <p className="text-sm text-gray-500">No rows</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 font-medium">run_date</th>
                    <th className="p-2 font-medium">created_at</th>
                    <th className="p-2 font-medium">campaign</th>
                  </tr>
                </thead>
                <tbody>
                  {absolute_runs.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="p-2">{String(row.run_date ?? '—')}</td>
                      <td className="p-2">{formatTs(row.created_at as string)}</td>
                      <td className="p-2">{campaignName(row.campaign_id as string, campaigns)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Completed</CardTitle>
          <p className="text-xs text-gray-500">Users who completed a campaign (run_once_per_user)</p>
        </CardHeader>
        <CardContent>
          {completed.length === 0 ? (
            <p className="text-sm text-gray-500">No rows</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 font-medium">user_id</th>
                    <th className="p-2 font-medium">campaign</th>
                    <th className="p-2 font-medium">created_at</th>
                  </tr>
                </thead>
                <tbody>
                  {completed.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="p-2 font-mono text-xs">{String(row.user_id ?? '—').slice(0, 8)}…</td>
                      <td className="p-2">{campaignName(row.campaign_id as string, campaigns)}</td>
                      <td className="p-2">{formatTs(row.created_at as string)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Last run</CardTitle>
          <p className="text-xs text-gray-500">Last run per user per campaign</p>
        </CardHeader>
        <CardContent>
          {last_run.length === 0 ? (
            <p className="text-sm text-gray-500">No rows</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 font-medium">user_id</th>
                    <th className="p-2 font-medium">campaign</th>
                    <th className="p-2 font-medium">last_run_at</th>
                  </tr>
                </thead>
                <tbody>
                  {last_run.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="p-2 font-mono text-xs">{String(row.user_id ?? '—').slice(0, 8)}…</td>
                      <td className="p-2">{campaignName(row.campaign_id as string, campaigns)}</td>
                      <td className="p-2">{formatTs(row.last_run_at as string)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Scheduled demo requests</CardTitle>
          <p className="text-xs text-gray-500">Scheduled then claimed by the edge function</p>
        </CardHeader>
        <CardContent>
          {scheduled_requests.length === 0 ? (
            <p className="text-sm text-gray-500">No rows</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 font-medium">user_id</th>
                    <th className="p-2 font-medium">trigger</th>
                    <th className="p-2 font-medium">campaign</th>
                    <th className="p-2 font-medium">scheduled_at</th>
                    <th className="p-2 font-medium">claimed_at</th>
                    <th className="p-2 font-medium">slot</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduled_requests.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="p-2 font-mono text-xs">{String(row.user_id ?? '—').slice(0, 8)}…</td>
                      <td className="p-2">{String(row.trigger ?? '—')}</td>
                      <td className="p-2">{campaignName(row.campaign_id as string, campaigns)}</td>
                      <td className="p-2">{formatTs(row.scheduled_at as string)}</td>
                      <td className="p-2">{formatTs(row.claimed_at as string)}</td>
                      <td className="p-2">{row.slot_index != null ? String(row.slot_index) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
