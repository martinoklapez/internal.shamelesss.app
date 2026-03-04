'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { DemoReengagementConfig } from '@/lib/database/demo-reengagement-config'

interface DemoReengagementManagerProps {
  initialConfig: DemoReengagementConfig
  canEdit: boolean
}

export default function DemoReengagementManager({
  initialConfig,
  canEdit,
}: DemoReengagementManagerProps) {
  const [config, setConfig] = useState<DemoReengagementConfig>(initialConfig)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setConfig(initialConfig)
  }, [initialConfig])

  const handleSave = async () => {
    if (!canEdit) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/demo-reengagement-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save')
      }
      const updated = await res.json()
      setConfig(updated)
      setMessage({ type: 'success', text: 'Config saved.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl border border-gray-200 p-4 sm:p-6">
        <div className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="rate_limit_hours">Rate limit (hours)</Label>
            <Input
              id="rate_limit_hours"
              type="number"
              min={1}
              value={config.rate_limit_hours}
              onChange={(e) =>
                setConfig((c) => ({ ...c, rate_limit_hours: parseInt(e.target.value, 10) || 24 }))
              }
              disabled={!canEdit}
            />
            <p className="text-xs text-gray-500">Time window for rate limiting (e.g. 24)</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="max_requests">Max requests per user per window</Label>
            <Input
              id="max_requests"
              type="number"
              min={0}
              value={config.max_requests_per_user_per_day}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  max_requests_per_user_per_day: parseInt(e.target.value, 10) || 0,
                }))
              }
              disabled={!canEdit}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="min_days_since_signup">Min days since signup</Label>
            <Input
              id="min_days_since_signup"
              type="number"
              min={0}
              value={config.min_days_since_signup}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  min_days_since_signup: parseInt(e.target.value, 10) || 0,
                }))
              }
              disabled={!canEdit}
            />
            <p className="text-xs text-gray-500">Only users registered for at least this many days</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="include_message">Include message</Label>
              <p className="text-xs text-gray-500">Friend request with message</p>
            </div>
            <Switch
              id="include_message"
              checked={config.include_message}
              onCheckedChange={(checked) => setConfig((c) => ({ ...c, include_message: checked }))}
              disabled={!canEdit}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="message_template">Message template</Label>
            <Textarea
              id="message_template"
              rows={3}
              placeholder="e.g. Hey!"
              value={config.message_template ?? ''}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  message_template: e.target.value.trim() || null,
                }))
              }
              disabled={!canEdit}
              className="resize-y"
            />
            <p className="text-xs text-gray-500">Message text for the friend request</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="exclude_promoter">Exclude promoter</Label>
              <p className="text-xs text-gray-500">Exclude promoters from re-engagement</p>
            </div>
            <Switch
              id="exclude_promoter"
              checked={config.exclude_promoter}
              onCheckedChange={(checked) => setConfig((c) => ({ ...c, exclude_promoter: checked }))}
              disabled={!canEdit}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="match_opposite_gender">Match opposite gender</Label>
              <p className="text-xs text-gray-500">
                Male users only get demo requests from female demo users, and female users only from
                male. Uses profiles.gender (male / female). Unknown or other: no filter.
              </p>
            </div>
            <Switch
              id="match_opposite_gender"
              checked={config.match_opposite_gender}
              onCheckedChange={(checked) =>
                setConfig((c) => ({ ...c, match_opposite_gender: checked }))
              }
              disabled={!canEdit}
            />
          </div>

          {message && (
            <p
              className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
            >
              {message.text}
            </p>
          )}

          {canEdit && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
