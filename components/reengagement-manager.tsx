'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils/date'
import {
  REENGAGEMENT_ENTITLEMENT_OPTIONS,
  type ReengagementCampaign,
  type ReengagementCampaignExecution,
  type ReengagementCampaignOutput,
  type ReengagementIntensityType,
  type ReengagementOutputType,
  type ReengagementTriggerType,
} from '@/lib/reengagement-types'
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Search } from 'lucide-react'

const EXECUTIONS_PAGE_SIZE = 20

type CampaignPanelTab = 'setup' | 'executions'

const OUTPUT_TYPE_OPTIONS: ReengagementOutputType[] = [
  'push_notification',
  'friend_request',
  'profile_views',
]

type TestRunUser = {
  id: string
  name: string | null
  username: string | null
  profile_picture_url: string | null
  email: string | null
  role: string | null
}

function defaultOutputConfig(type: ReengagementOutputType): Record<string, unknown> {
  if (type === 'friend_request') return { sender_selector: 'any_male', message: null }
  if (type === 'profile_views') return { count: 1, viewer_selector: 'same_country', fallback_country_code: 'US' }
  return {
    title: 'Come back!',
    body: 'You have new activity waiting in Shamelesss.',
    superwall_trigger_id: 'special_offer',
  }
}

export default function ReengagementManager() {
  const [campaigns, setCampaigns] = useState<ReengagementCampaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<ReengagementCampaignOutput[]>([])
  const [executions, setExecutions] = useState<ReengagementCampaignExecution[]>([])
  const [campaignPanelTab, setCampaignPanelTab] = useState<CampaignPanelTab>('setup')
  const [executionsPage, setExecutionsPage] = useState(1)
  const [executionsTotal, setExecutionsTotal] = useState(0)
  const [executionsLoading, setExecutionsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testUserId, setTestUserId] = useState('')
  const [testSecret, setTestSecret] = useState('')

  const [testUsers, setTestUsers] = useState<TestRunUser[]>([])
  const [testUsersLoading, setTestUsersLoading] = useState(false)
  const testUsersFetchInFlight = useRef(false)
  const testUsersHydrated = useRef(false)
  const [testRecipientPickerOpen, setTestRecipientPickerOpen] = useState(false)

  const [secretMeta, setSecretMeta] = useState<{
    hasPrimary: boolean
    hasDemo: boolean
    primaryMasked: string | null
    demoMasked: string | null
  } | null>(null)

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  )

  const loadTestUsers = useCallback(async () => {
    if (testUsersFetchInFlight.current || testUsersHydrated.current) return
    testUsersFetchInFlight.current = true
    setTestUsersLoading(true)
    try {
      const res = await fetch('/api/users/list')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load users')
      const mapped = (data.users ?? []).map(
        (u: {
          id: string
          name: string | null
          username: string | null
          profile_picture_url: string | null
          email: string | null
          role?: string | null
        }) => ({
          ...u,
          role: typeof u.role === 'string' ? u.role : null,
        })
      )
      setTestUsers(mapped)
      testUsersHydrated.current = true
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      testUsersFetchInFlight.current = false
      setTestUsersLoading(false)
    }
  }, [])

  const loadSecretMeta = async () => {
    const res = await fetch('/api/reengagement/test-run/meta')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load secret config')
    setSecretMeta({
      hasPrimary: Boolean(data.hasPrimary),
      hasDemo: Boolean(data.hasDemo),
      primaryMasked: typeof data.primaryMasked === 'string' ? data.primaryMasked : null,
      demoMasked: typeof data.demoMasked === 'string' ? data.demoMasked : null,
    })
  }

  async function loadCampaigns() {
    setLoading(true)
    try {
      const res = await fetch('/api/reengagement/campaigns')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load campaigns')
      setCampaigns(data.campaigns ?? [])
      const first = (data.campaigns ?? [])[0]
      setSelectedCampaignId((prev) => prev ?? first?.id ?? null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  async function loadOutputs(campaignId: string) {
    try {
      const res = await fetch(`/api/reengagement/outputs?campaign_id=${encodeURIComponent(campaignId)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load outputs')
      setOutputs(data.outputs ?? [])
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to load outputs')
    }
  }

  const loadExecutionsPage = useCallback(async (campaignId: string, page: number) => {
    setExecutionsLoading(true)
    try {
      const res = await fetch(
        `/api/reengagement/executions?campaign_id=${encodeURIComponent(campaignId)}&page=${page}&page_size=${EXECUTIONS_PAGE_SIZE}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load executions')
      setExecutions(data.executions ?? [])
      setExecutionsTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to load executions')
      setExecutions([])
      setExecutionsTotal(0)
    } finally {
      setExecutionsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCampaigns()
  }, [])

  /** Preload recipients so the combobox list is ready when opened (avoids empty-state flash). */
  useEffect(() => {
    void loadTestUsers()
  }, [loadTestUsers])

  useEffect(() => {
    void (async () => {
      try {
        await loadSecretMeta()
      } catch (e) {
        // Non-critical: if meta can't load, fall back to showing manual input.
        setSecretMeta({
          hasPrimary: false,
          hasDemo: false,
          primaryMasked: null,
          demoMasked: null,
        })
      }
    })()
  }, [])

  useEffect(() => {
    if (!selectedCampaignId) {
      setOutputs([])
      setExecutions([])
      setExecutionsTotal(0)
      setCampaignPanelTab('setup')
      setExecutionsPage(1)
      return
    }
    setCampaignPanelTab('setup')
    setExecutionsPage(1)
    setExecutions([])
    setExecutionsTotal(0)
    void loadOutputs(selectedCampaignId)
  }, [selectedCampaignId])

  useEffect(() => {
    if (!selectedCampaignId || campaignPanelTab !== 'executions') return
    void loadExecutionsPage(selectedCampaignId, executionsPage)
  }, [selectedCampaignId, campaignPanelTab, executionsPage, loadExecutionsPage])

  async function createCampaign() {
    const name = prompt('Campaign name')
    if (!name?.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/reengagement/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), trigger_type: 'app_close' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign')
      setCampaigns((prev) => [data.campaign, ...prev])
      setSelectedCampaignId(data.campaign.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create campaign')
    } finally {
      setSaving(false)
    }
  }

  async function saveCampaign(campaign: ReengagementCampaign) {
    setSaving(true)
    try {
      const res = await fetch('/api/reengagement/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaign),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save campaign')
      setCampaigns((prev) => prev.map((c) => (c.id === data.campaign.id ? data.campaign : c)))
      alert('Campaign saved')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save campaign')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Delete campaign? Outputs and executions relation data may be affected.')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/reengagement/campaigns?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete campaign')
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      setSelectedCampaignId((prev) => (prev === id ? null : prev))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete campaign')
    } finally {
      setSaving(false)
    }
  }

  async function addOutput() {
    if (!selectedCampaignId) return
    setSaving(true)
    try {
      const outputType: ReengagementOutputType = 'push_notification'
      const res = await fetch('/api/reengagement/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: selectedCampaignId,
          output_type: outputType,
          delay_seconds: 0,
          config: defaultOutputConfig(outputType),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add output')
      setOutputs((prev) => [...prev, data.output].sort((a, b) => a.order_index - b.order_index))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add output')
    } finally {
      setSaving(false)
    }
  }

  async function saveOutput(output: ReengagementCampaignOutput) {
    setSaving(true)
    try {
      const res = await fetch('/api/reengagement/outputs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(output),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save output')
      setOutputs((prev) => prev.map((o) => (o.id === data.output.id ? data.output : o)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save output')
    } finally {
      setSaving(false)
    }
  }

  async function deleteOutput(id: string) {
    if (!confirm('Delete output step?')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/reengagement/outputs?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete output')
      setOutputs((prev) => prev.filter((o) => o.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete output')
    } finally {
      setSaving(false)
    }
  }

  async function moveOutput(id: string, direction: -1 | 1) {
    const ordered = [...outputs].sort((a, b) => a.order_index - b.order_index)
    const idx = ordered.findIndex((o) => o.id === id)
    if (idx < 0) return
    const target = idx + direction
    if (target < 0 || target >= ordered.length) return
    const swapped = [...ordered]
    ;[swapped[idx], swapped[target]] = [swapped[target], swapped[idx]]
    const reordered = swapped.map((o, i) => ({ ...o, order_index: i }))
    setOutputs(reordered)
    try {
      const res = await fetch('/api/reengagement/outputs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder: reordered.map((o) => ({ id: o.id, order_index: o.order_index })) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reorder outputs')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to reorder outputs')
      void loadOutputs(selectedCampaignId!)
    }
  }

  async function runTest() {
    if (!testUserId.trim()) return alert('Select a recipient user.')
    const envConfigured = Boolean(secretMeta?.hasPrimary || secretMeta?.hasDemo)
    if (!envConfigured && !testSecret.trim()) return alert('Enter the reengagement secret.')
    setSaving(true)
    try {
      const secretToSend = envConfigured ? undefined : testSecret.trim()
      const res = await fetch('/api/reengagement/test-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId.trim(),
          campaignId: selectedCampaignId ?? undefined,
          secret: secretToSend,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test run failed')
      alert(`Run complete: ${JSON.stringify(data.result)}`)
      if (selectedCampaignId && campaignPanelTab === 'executions') {
        void loadExecutionsPage(selectedCampaignId, executionsPage)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Test run failed')
    } finally {
      setSaving(false)
    }
  }

  const executionsTotalPages = Math.max(1, Math.ceil(executionsTotal / EXECUTIONS_PAGE_SIZE))
  const executionsRangeFrom =
    executionsTotal === 0 ? 0 : (executionsPage - 1) * EXECUTIONS_PAGE_SIZE + 1
  const executionsRangeTo = Math.min(executionsPage * EXECUTIONS_PAGE_SIZE, executionsTotal)
  const executionsCanPrev = executionsPage > 1
  const executionsCanNext = executionsPage < executionsTotalPages

  if (loading) {
    return <div className="text-sm text-gray-500">Loading campaigns...</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6">
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
          <h2 className="text-sm font-semibold">Campaigns</h2>
          <Button size="sm" className="h-7" onClick={createCampaign} disabled={saving}>
            New
          </Button>
        </div>
        <div className="divide-y">
          {campaigns.length === 0 ? (
            <p className="text-sm text-gray-500 px-3 py-4">No campaigns yet.</p>
          ) : (
            campaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => setSelectedCampaignId(campaign.id)}
                className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 ${
                  selectedCampaignId === campaign.id ? 'bg-red-50/60' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{campaign.name}</span>
                  <span
                    className={`text-[11px] rounded px-1.5 py-0.5 border ${
                      campaign.is_active
                        ? 'text-green-700 bg-green-50 border-green-200'
                        : 'text-gray-600 bg-gray-50 border-gray-200'
                    }`}
                  >
                    {campaign.is_active ? 'active' : 'inactive'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{campaign.trigger_type}</p>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="space-y-6 min-w-0">
        {!selectedCampaign ? (
          <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-6">
            Select or create a campaign.
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50/80 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                <h2 className="text-sm font-semibold shrink-0">Campaign settings</h2>
                <div
                  className="inline-flex h-8 shrink-0 items-center rounded-md border border-input bg-muted/40 p-0.5"
                  role="tablist"
                  aria-label="Campaign panel"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={campaignPanelTab === 'setup'}
                    className={cn(
                      'rounded px-3 py-1 text-xs font-medium transition-colors',
                      campaignPanelTab === 'setup'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => setCampaignPanelTab('setup')}
                  >
                    Setup
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={campaignPanelTab === 'executions'}
                    className={cn(
                      'rounded px-3 py-1 text-xs font-medium transition-colors',
                      campaignPanelTab === 'executions'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => {
                      if (campaignPanelTab !== 'executions') setExecutionsPage(1)
                      setCampaignPanelTab('executions')
                    }}
                  >
                    Executions
                  </button>
                </div>
              </div>
              {campaignPanelTab === 'setup' ? (
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => deleteCampaign(selectedCampaign.id)} disabled={saving}>
                    Delete
                  </Button>
                  <Button size="sm" onClick={() => saveCampaign(selectedCampaign)} disabled={saving}>
                    Save campaign
                  </Button>
                </div>
              ) : null}
            </div>

            {campaignPanelTab === 'setup' ? (
              <div className="p-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    value={selectedCampaign.name}
                    onChange={(e) =>
                      setCampaigns((prev) =>
                        prev.map((c) => (c.id === selectedCampaign.id ? { ...c, name: e.target.value } : c))
                      )
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Trigger type</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedCampaign.trigger_type}
                    onChange={(e) =>
                      setCampaigns((prev) =>
                        prev.map((c) =>
                          c.id === selectedCampaign.id
                            ? { ...c, trigger_type: e.target.value as ReengagementTriggerType }
                            : c
                        )
                      )
                    }
                  >
                    <option value="app_close">app_close</option>
                    <option value="scheduled">scheduled</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Intensity type</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedCampaign.intensity_type}
                    onChange={(e) =>
                      setCampaigns((prev) =>
                        prev.map((c) =>
                          c.id === selectedCampaign.id
                            ? { ...c, intensity_type: e.target.value as ReengagementIntensityType }
                            : c
                        )
                      )
                    }
                  >
                    <option value="once_per_user">once_per_user</option>
                    <option value="x_per_y_days">x_per_y_days</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Intensity X</Label>
                    <Input
                      type="number"
                      value={selectedCampaign.intensity_x ?? ''}
                      onChange={(e) =>
                        setCampaigns((prev) =>
                          prev.map((c) =>
                            c.id === selectedCampaign.id
                              ? { ...c, intensity_x: e.target.value ? Number(e.target.value) : null }
                              : c
                          )
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Intensity Y days</Label>
                    <Input
                      type="number"
                      value={selectedCampaign.intensity_y_days ?? ''}
                      onChange={(e) =>
                        setCampaigns((prev) =>
                          prev.map((c) =>
                            c.id === selectedCampaign.id
                              ? { ...c, intensity_y_days: e.target.value ? Number(e.target.value) : null }
                              : c
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <label className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">Active</span>
                  <Switch
                    checked={selectedCampaign.is_active}
                    onCheckedChange={(checked) =>
                      setCampaigns((prev) =>
                        prev.map((c) => (c.id === selectedCampaign.id ? { ...c, is_active: checked } : c))
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">Run once per user</span>
                  <Switch
                    checked={selectedCampaign.run_once_per_user}
                    onCheckedChange={(checked) =>
                      setCampaigns((prev) =>
                        prev.map((c) =>
                          c.id === selectedCampaign.id ? { ...c, run_once_per_user: checked } : c
                        )
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">Skip users without push token</span>
                  <Switch
                    checked={selectedCampaign.skip_users_without_push_tokens}
                    onCheckedChange={(checked) =>
                      setCampaigns((prev) =>
                        prev.map((c) =>
                          c.id === selectedCampaign.id
                            ? { ...c, skip_users_without_push_tokens: checked }
                            : c
                        )
                      )
                    }
                  />
                </label>
              </div>

              <div className="space-y-2">
                <Label>Skip if subscribed entitlements</Label>
                <div className="flex flex-wrap gap-2">
                  {REENGAGEMENT_ENTITLEMENT_OPTIONS.map((option) => {
                    const selected = selectedCampaign.skip_if_subscribed_entitlements.includes(option)
                    return (
                      <button
                        key={option}
                        type="button"
                        className={`text-xs rounded border px-2 py-1 ${
                          selected ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 text-gray-600'
                        }`}
                        onClick={() =>
                          setCampaigns((prev) =>
                            prev.map((c) => {
                              if (c.id !== selectedCampaign.id) return c
                              const next = selected
                                ? c.skip_if_subscribed_entitlements.filter((x) => x !== option)
                                : [...c.skip_if_subscribed_entitlements, option]
                              return { ...c, skip_if_subscribed_entitlements: next }
                            })
                          )
                        }
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Outputs</h3>
                  <Button size="sm" onClick={addOutput} disabled={saving}>
                    Add output
                  </Button>
                </div>
                {outputs.length === 0 ? (
                  <p className="text-sm text-gray-500">No outputs configured.</p>
                ) : (
                  outputs
                    .slice()
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((output, index) => (
                      <OutputEditor
                        key={output.id}
                        output={output}
                        index={index}
                        total={outputs.length}
                        disabled={saving}
                        onChange={(next) =>
                          setOutputs((prev) => prev.map((o) => (o.id === output.id ? next : o)))
                        }
                        onSave={(next) => saveOutput(next)}
                        onDelete={() => deleteOutput(output.id)}
                        onMoveUp={() => moveOutput(output.id, -1)}
                        onMoveDown={() => moveOutput(output.id, 1)}
                      />
                    ))
                )}
              </div>

              <div className="border-t border-gray-200 pt-6 space-y-3">
              <h3 className="text-sm font-semibold">Test run</h3>
              <p className="text-xs text-gray-500">
                Runs `run-reengagement` for the user and selected campaign (or all app_close campaigns if none selected).
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-end">
                <div className="space-y-1.5">
                  <Label>Recipient</Label>
                  <TestUserCombobox
                    label="Recipient"
                    labelHint="Pick who will receive the reengagement push(s)."
                    users={testUsers}
                    usersLoading={testUsersLoading}
                    value={testUserId}
                    onChange={setTestUserId}
                    open={testRecipientPickerOpen}
                    onOpenChange={(o) => {
                      setTestRecipientPickerOpen(o)
                      if (o && testUsers.length === 0) void loadTestUsers()
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Secret</Label>
                  {secretMeta == null ? (
                    <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
                      Checking env secrets…
                    </div>
                  ) : secretMeta.hasPrimary || secretMeta.hasDemo ? (
                    <div
                      className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm ring-offset-background"
                      title={
                        [
                          secretMeta.hasPrimary
                            ? `REENGAGEMENT_SECRET ${secretMeta.primaryMasked ?? '*****'}`
                            : null,
                          secretMeta.hasDemo
                            ? `DEMO_REENGAGEMENT_SECRET ${secretMeta.demoMasked ?? '*****'}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || undefined
                      }
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-green-500"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                        {[
                          secretMeta.hasPrimary
                            ? `REENGAGEMENT_SECRET ${secretMeta.primaryMasked ?? '*****'}`
                            : null,
                          secretMeta.hasDemo
                            ? `DEMO_REENGAGEMENT_SECRET ${secretMeta.demoMasked ?? '*****'}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  ) : (
                    <Input
                      value={testSecret}
                      onChange={(e) => setTestSecret(e.target.value)}
                      placeholder="REENGAGEMENT_SECRET"
                    />
                  )}
                </div>
              </div>
              <Button size="sm" onClick={runTest} disabled={saving}>
                Run test
              </Button>
              </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <p className="text-xs text-gray-500">Recent runs for this campaign.</p>
                {executionsLoading ? (
                  <p className="text-sm text-gray-500">Loading executions…</p>
                ) : executions.length === 0 ? (
                  <p className="text-sm text-gray-500">No executions yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-1.5 pr-3 font-medium">User</th>
                          <th className="py-1.5 pr-3 font-medium">Executed</th>
                          <th className="py-1.5 pr-3 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {executions.map((row) => (
                          <tr key={row.id} className="border-b last:border-0">
                            <td className="py-2 pr-3 font-mono text-xs text-gray-700">{row.user_id}</td>
                            <td className="py-2 pr-3 text-gray-700">{formatDate(row.executed_at)}</td>
                            <td className="py-2 pr-3 text-gray-500">{formatDate(row.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
                  <span>
                    {executionsTotal === 0
                      ? '0 executions'
                      : `Showing ${executionsRangeFrom}–${executionsRangeTo} of ${executionsTotal}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={!executionsCanPrev || executionsLoading}
                      aria-label="Previous page"
                      onClick={() => setExecutionsPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="tabular-nums px-1">
                      {executionsTotal === 0 ? '—' : `${executionsPage} / ${executionsTotalPages}`}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={!executionsCanNext || executionsLoading}
                      aria-label="Next page"
                      onClick={() => setExecutionsPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function TestUserCombobox({
  label,
  labelHint,
  users,
  usersLoading,
  value,
  onChange,
  open,
  onOpenChange,
}: {
  label: string
  labelHint?: string
  users: TestRunUser[]
  usersLoading: boolean
  value: string
  onChange: (id: string) => void
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const selected = users.find((x) => x.id === value)

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const hay = [u.name, u.username, u.email, u.role, u.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [users, query])

  const placeholderUser: TestRunUser = {
    id: value,
    name: null,
    username: null,
    profile_picture_url: null,
    email: null,
    role: null,
  }

  return (
    <div className="space-y-1">
      {labelHint ? <p className="text-[11px] text-gray-500">{labelHint}</p> : null}
      <Popover modal={false} open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-10 w-full justify-between gap-2 overflow-hidden px-3 py-0 font-normal"
          >
            <div className="flex min-w-0 flex-1 items-center overflow-hidden text-left">
              {value && selected ? (
                <RecipientTriggerLine u={selected} />
              ) : value && !selected ? (
                <RecipientTriggerLine u={placeholderUser} />
              ) : (
                <span className="truncate text-sm text-muted-foreground">Select a user…</span>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[200] w-[min(100vw-2rem,320px)] border border-gray-200 bg-white p-0 shadow-lg"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex flex-col overflow-hidden rounded-md bg-white text-gray-900">
            <div className="flex items-center border-b border-input px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                type="search"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
              {usersLoading && users.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading users…</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {users.length === 0 && !usersLoading
                    ? 'No users available for this list.'
                    : 'No matching users.'}
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-gray-100 focus-visible:bg-gray-100',
                      value === u.id && 'bg-gray-100'
                    )}
                    onClick={() => {
                      onChange(u.id)
                      onOpenChange(false)
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <UserRow u={u} size="sm" />
                    </div>
                    {value === u.id ? <Check className="h-4 w-4 shrink-0 text-black" /> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** Single-line, fixed-height trigger (matches h-10 secret readout). */
function RecipientTriggerLine({ u }: { u: TestRunUser }) {
  const initial = (u.name || u.username || u.email || u.id || 'U').charAt(0).toUpperCase()
  const primary = u.name?.trim() || u.username || u.email || u.id.slice(0, 8)

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
      <Avatar className="h-7 w-7 shrink-0">
        {u.profile_picture_url ? (
          <AvatarImage
            src={u.profile_picture_url}
            alt={u.name || u.username || 'User'}
            className="object-cover"
          />
        ) : null}
        <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
      </Avatar>
      <p className="min-w-0 flex-1 truncate text-sm leading-none">
        <span className="font-medium text-foreground">{primary}</span>
        {u.role ? <span className="text-muted-foreground"> · {u.role}</span> : null}
        {u.username && u.name?.trim() ? (
          <span className="text-muted-foreground"> · @{u.username}</span>
        ) : null}
      </p>
    </div>
  )
}

function UserRow({ u, size = 'sm' }: { u: TestRunUser; size?: 'sm' | 'md' }) {
  const avatarClass = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
  const initial = (u.name || u.username || u.email || 'U').charAt(0).toUpperCase()

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Avatar className={avatarClass}>
        {u.profile_picture_url ? (
          <AvatarImage src={u.profile_picture_url} alt={u.name || u.username || 'User'} />
        ) : null}
        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-medium text-gray-900">
          {u.name || '—'}
          {u.role ? (
            <Badge variant="outline" className="ml-2 px-1 py-0 text-[11px]">
              {u.role}
            </Badge>
          ) : null}
        </div>
        <div className="truncate text-xs text-gray-500">
          {u.username ? `@${u.username}` : u.email || u.id.slice(0, 8)}
        </div>
      </div>
    </div>
  )
}

function OutputEditor({
  output,
  index,
  total,
  disabled,
  onChange,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  output: ReengagementCampaignOutput
  index: number
  total: number
  disabled: boolean
  onChange: (next: ReengagementCampaignOutput) => void
  onSave: (next: ReengagementCampaignOutput) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const configText = useMemo(() => JSON.stringify(output.config ?? {}, null, 2), [output.config])
  const [draftConfig, setDraftConfig] = useState(configText)

  useEffect(() => {
    setDraftConfig(configText)
  }, [configText])

  return (
    <div className="border border-gray-200 rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">Step {index + 1}</p>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={onMoveUp} disabled={disabled || index === 0}>
            ↑
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2"
            onClick={onMoveDown}
            disabled={disabled || index === total - 1}
          >
            ↓
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-red-700" onClick={onDelete} disabled={disabled}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Output type</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={output.output_type}
            onChange={(e) => {
              const t = e.target.value as ReengagementOutputType
              onChange({ ...output, output_type: t, config: defaultOutputConfig(t) })
            }}
          >
            {OUTPUT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Delay seconds</Label>
          <Input
            type="number"
            value={output.delay_seconds}
            onChange={(e) => onChange({ ...output, delay_seconds: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Order index</Label>
          <Input
            type="number"
            value={output.order_index}
            onChange={(e) => onChange({ ...output, order_index: Number(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Config JSON</Label>
        <Textarea
          className="min-h-[120px] font-mono text-xs"
          value={draftConfig}
          onChange={(e) => setDraftConfig(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        onClick={() => {
          try {
            const parsed = JSON.parse(draftConfig) as Record<string, unknown>
            const next = { ...output, config: parsed }
            // Update editor state immediately, but also pass the parsed payload to save
            // so the PATCH request cannot use a stale `output` prop.
            onChange(next)
            onSave(next)
          } catch {
            alert('Config must be valid JSON')
          }
        }}
        disabled={disabled}
      >
        Save output
      </Button>
    </div>
  )
}
