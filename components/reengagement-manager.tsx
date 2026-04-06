'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  REENGAGEMENT_FRIEND_POOL_SELECTOR_OPTIONS,
  REENGAGEMENT_FRIEND_SENDER_OPTIONS,
  isReengagementFriendPoolSelector,
  isReengagementFriendSenderSelector,
  REENGAGEMENT_GENDER_OPTIONS,
  normalizeAudienceFilter,
  normalizeReengagementCampaign,
  type ReengagementAudienceFilter,
  type ReengagementCampaign,
  type ReengagementCampaignExecution,
  type ReengagementCampaignOutput,
  type ReengagementFriendPoolSelector,
  type ReengagementFriendSenderSelector,
  type ReengagementIntensityType,
  type ReengagementOutputType,
  type ReengagementScheduleKind,
  type ReengagementTriggerType,
  REENGAGEMENT_TRIGGER_TYPES,
} from '@/lib/reengagement-types'
import { COUNTRIES, getFlagEmoji } from '@/lib/countries'
import {
  ArrowDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Play,
  Search,
  Trash2,
} from 'lucide-react'
import { useAppDialogs } from '@/components/app-dialogs-provider'
import { notifyError, notifySuccess } from '@/lib/notify'

const EXECUTIONS_PAGE_SIZE = 20

/** Deterministic JSON for dirty checks (sorted object keys recursively). */
function stableStringify(v: unknown): string {
  const walk = (x: unknown): unknown => {
    if (x === null || typeof x !== 'object') return x
    if (Array.isArray(x)) return x.map(walk)
    const o = x as Record<string, unknown>
    const keys = Object.keys(o).sort()
    const out: Record<string, unknown> = {}
    for (const k of keys) out[k] = walk(o[k])
    return out
  }
  return JSON.stringify(walk(v))
}

function campaignDirtyPayload(c: ReengagementCampaign): unknown {
  return {
    name: c.name,
    is_active: c.is_active,
    run_once_per_user: c.run_once_per_user,
    skip_if_subscribed_entitlements: c.skip_if_subscribed_entitlements,
    skip_users_without_push_tokens: c.skip_users_without_push_tokens,
    intensity_type: c.intensity_type,
    intensity_x: c.intensity_x,
    intensity_y_days: c.intensity_y_days,
    trigger_type: c.trigger_type,
    schedule_paused: c.schedule_paused,
    schedule_timezone: c.schedule_timezone,
    schedule_kind: c.schedule_kind,
    scheduled_at: c.scheduled_at,
    schedule_cron: c.schedule_cron,
    next_run_at: c.next_run_at,
    audience_filter: c.audience_filter,
  }
}

function outputDirtyPayload(o: ReengagementCampaignOutput): unknown {
  return {
    id: o.id,
    order_index: o.order_index,
    delay_seconds: o.delay_seconds,
    output_type: o.output_type,
    config: o.config ?? {},
  }
}

function outputWithDraft(
  o: ReengagementCampaignOutput,
  draft: string | undefined
): ReengagementCampaignOutput {
  if (draft === undefined) return o
  try {
    return { ...o, config: JSON.parse(draft) as Record<string, unknown> }
  } catch {
    return o
  }
}

type SavedReengagementSnapshot = {
  campaignId: string
  campaign: ReengagementCampaign
  outputs: ReengagementCampaignOutput[]
}

type CampaignPanelTab = 'config' | 'audience' | 'outputs' | 'executions'
type AudienceFilterKind = 'genders' | 'country_codes' | 'age'
const AUDIENCE_FILTER_OPTIONS: Array<{ value: AudienceFilterKind; label: string }> = [
  { value: 'genders', label: 'Gender' },
  { value: 'country_codes', label: 'Country' },
  { value: 'age', label: 'Age' },
]

/** Parse stored UTC ISO into parts for native date/time inputs (local calendar & clock). */
function isoUtcStringToLocalParts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso?.trim()) return { date: '', time: '' }
  const d = new Date(iso.trim())
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return { date: `${y}-${m}-${day}`, time: `${hh}:${mm}` }
}

/** Combine local date + time into a UTC ISO string for the API. */
function localPartsToIsoUtcString(date: string, time: string): string | null {
  const dStr = date.trim()
  if (!dStr) return null
  const tStr = time.trim() || '00:00'
  const [y, mo, da] = dStr.split('-').map((x) => Number(x))
  const [hh, mm] = tStr.split(':').map((x) => Number(x))
  if (![y, mo, da].every((n) => Number.isFinite(n))) return null
  const h = Number.isFinite(hh) ? hh : 0
  const min = Number.isFinite(mm) ? mm : 0
  const d = new Date(y, mo - 1, da, h, min, 0, 0)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function IsoUtcDateTimePickers({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string
  value: string | null | undefined
  onChange: (iso: string | null) => void
  disabled?: boolean
}) {
  const { date, time } = useMemo(() => isoUtcStringToLocalParts(value), [value])

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[10.5rem] flex-1 space-y-1">
        <Label className="text-xs text-muted-foreground" htmlFor={`${idPrefix}-date`}>
          Date
        </Label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          className="h-9"
          disabled={disabled}
          value={date}
          onChange={(e) => {
            const nextDate = e.target.value
            if (!nextDate) {
              onChange(null)
              return
            }
            onChange(localPartsToIsoUtcString(nextDate, time || '00:00'))
          }}
        />
      </div>
      <div className="w-[9rem] space-y-1">
        <Label className="text-xs text-muted-foreground" htmlFor={`${idPrefix}-time`}>
          Time
        </Label>
        <Input
          id={`${idPrefix}-time`}
          type="time"
          step={60}
          className="h-9"
          disabled={disabled || !date}
          value={time}
          onChange={(e) => {
            if (!date) return
            onChange(localPartsToIsoUtcString(date, e.target.value || '00:00'))
          }}
        />
      </div>
    </div>
  )
}

const OUTPUT_TYPE_OPTIONS: ReengagementOutputType[] = [
  'push_notification',
  'friend_request',
  'profile_views',
]

const REENGAGEMENT_TRIGGER_LABELS: Record<ReengagementTriggerType, string> = {
  app_close: 'app_close — client invokes run-reengagement on app close',
  scheduled: 'scheduled — run-scheduled-reengagement (cron, UTC)',
  subscription_cancelled: 'subscription_cancelled — Superwall cancellation / expiration webhook',
}

type TestRunUser = {
  id: string
  name: string | null
  username: string | null
  profile_picture_url: string | null
  email: string | null
  role: string | null
}

function defaultOutputConfig(type: ReengagementOutputType): Record<string, unknown> {
  if (type === 'friend_request') {
    return {
      sender_selector: 'any_male',
      preferred_user_id: null,
      specific_user_id: null,
      fallback_sender_selector: null,
      message: null,
    }
  }
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
  const [campaignPanelTab, setCampaignPanelTab] = useState<CampaignPanelTab>('config')
  const [executionsPage, setExecutionsPage] = useState(1)
  const [executionsTotal, setExecutionsTotal] = useState(0)
  const [executionsLoading, setExecutionsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [outputsLoading, setOutputsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<SavedReengagementSnapshot | null>(null)
  const [outputJsonDrafts, setOutputJsonDrafts] = useState<Record<string, string>>({})
  const latestForBaseline = useRef({
    campaigns: [] as ReengagementCampaign[],
    selectedCampaignId: null as string | null,
  })
  const [testUserId, setTestUserId] = useState('')
  const [testSecret, setTestSecret] = useState('')

  const [testUsers, setTestUsers] = useState<TestRunUser[]>([])
  const [testUsersLoading, setTestUsersLoading] = useState(false)
  const testUsersFetchInFlight = useRef(false)
  const testUsersHydrated = useRef(false)
  const [testRecipientPickerOpen, setTestRecipientPickerOpen] = useState(false)
  const [testRunModalOpen, setTestRunModalOpen] = useState(false)
  const [entitlementsUiVisible, setEntitlementsUiVisible] = useState(false)
  const [audienceFilterRows, setAudienceFilterRows] = useState<AudienceFilterKind[]>([])
  const [audienceAddFilterPickerOpen, setAudienceAddFilterPickerOpen] = useState(false)

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

  const superwallReengagementWebhookUrl = useMemo(() => {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
    return base ? `${base}/functions/v1/superwall-reengagement-webhook` : ''
  }, [])

  latestForBaseline.current = { campaigns, selectedCampaignId }

  const { confirm, prompt } = useAppDialogs()

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
      notifyError(e instanceof Error ? e.message : 'Failed to load users')
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
      const list: ReengagementCampaign[] = (data.campaigns ?? []).map((row: ReengagementCampaign) =>
        normalizeReengagementCampaign(row)
      )
      setCampaigns(list)
      setSelectedCampaignId((prev) => {
        if (!prev) return null
        return list.some((c) => c.id === prev) ? prev : null
      })
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  async function loadOutputs(campaignId: string) {
    setOutputsLoading(true)
    try {
      const res = await fetch(`/api/reengagement/outputs?campaign_id=${encodeURIComponent(campaignId)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load outputs')
      const list = (data.outputs ?? []) as ReengagementCampaignOutput[]
      setOutputs(list)
      const drafts = Object.fromEntries(
        list.map((o) => [o.id, JSON.stringify(o.config ?? {}, null, 2)])
      )
      setOutputJsonDrafts(drafts)

      const { campaigns: cs, selectedCampaignId: sid } = latestForBaseline.current
      if (sid === campaignId) {
        const c = cs.find((x) => x.id === campaignId)
        if (c) {
          setSavedSnapshot({
            campaignId,
            campaign: structuredClone(c),
            outputs: structuredClone(list),
          })
        }
      }
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load outputs')
      setOutputs([])
      setOutputJsonDrafts({})
      setSavedSnapshot(null)
    } finally {
      setOutputsLoading(false)
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
      notifyError(e instanceof Error ? e.message : 'Failed to load executions')
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
      setCampaignPanelTab('config')
      setExecutionsPage(1)
      setEntitlementsUiVisible(false)
      setAudienceFilterRows([])
      setSavedSnapshot(null)
      setOutputJsonDrafts({})
      return
    }
    setCampaignPanelTab('config')
    setExecutionsPage(1)
    setExecutions([])
    setExecutionsTotal(0)
    setSavedSnapshot(null)
    void loadOutputs(selectedCampaignId)
  }, [selectedCampaignId])

  useEffect(() => {
    if (!selectedCampaign) return
    setEntitlementsUiVisible((selectedCampaign.skip_if_subscribed_entitlements ?? []).length > 0)
    const rows: AudienceFilterKind[] = []
    if ((selectedCampaign.audience_filter.genders ?? []).length > 0) rows.push('genders')
    if ((selectedCampaign.audience_filter.country_codes ?? []).length > 0) rows.push('country_codes')
    if (
      selectedCampaign.audience_filter.age_min !== undefined ||
      selectedCampaign.audience_filter.age_max !== undefined
    ) {
      rows.push('age')
    }
    setAudienceFilterRows(rows)
  }, [selectedCampaign?.id])

  useEffect(() => {
    if (!selectedCampaignId || campaignPanelTab !== 'executions') return
    void loadExecutionsPage(selectedCampaignId, executionsPage)
  }, [selectedCampaignId, campaignPanelTab, executionsPage, loadExecutionsPage])

  const isDirty = useMemo(() => {
    if (!selectedCampaign || !savedSnapshot || savedSnapshot.campaignId !== selectedCampaign.id) return false
    if (
      stableStringify(campaignDirtyPayload(selectedCampaign)) !==
      stableStringify(campaignDirtyPayload(savedSnapshot.campaign))
    ) {
      return true
    }
    const baseById = new Map(savedSnapshot.outputs.map((o) => [o.id, o]))
    if (outputs.length !== savedSnapshot.outputs.length) return true
    for (const o of outputs) {
      const draft = outputJsonDrafts[o.id]
      if (draft !== undefined) {
        try {
          JSON.parse(draft)
        } catch {
          return true
        }
      }
      const eff = outputWithDraft(o, draft)
      const b = baseById.get(o.id)
      if (!b) return true
      if (stableStringify(outputDirtyPayload(eff)) !== stableStringify(outputDirtyPayload(b))) return true
    }
    for (const b of savedSnapshot.outputs) {
      if (!outputs.some((o) => o.id === b.id)) return true
    }
    return false
  }, [selectedCampaign, savedSnapshot, outputs, outputJsonDrafts])

  const canSave = Boolean(
    selectedCampaign && savedSnapshot && savedSnapshot.campaignId === selectedCampaign.id && !outputsLoading
  )

  async function createCampaign() {
    const name = await prompt({
      title: 'New campaign',
      label: 'Campaign name',
      placeholder: 'My campaign',
      confirmLabel: 'Create',
    })
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
      setCampaigns((prev) => [normalizeReengagementCampaign(data.campaign), ...prev])
      setSelectedCampaignId(data.campaign.id)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to create campaign')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCampaign(id: string) {
    const ok = await confirm({
      title: 'Delete campaign?',
      description: 'Outputs and executions relation data may be affected.',
      variant: 'destructive',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    setSaving(true)
    try {
      const res = await fetch(`/api/reengagement/campaigns?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete campaign')
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      setSelectedCampaignId((prev) => (prev === id ? null : prev))
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to delete campaign')
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
      const added = data.output as ReengagementCampaignOutput
      setOutputs((prev) => [...prev, added].sort((a, b) => a.order_index - b.order_index))
      setOutputJsonDrafts((prev) => ({
        ...prev,
        [added.id]: JSON.stringify(added.config ?? {}, null, 2),
      }))
      setSavedSnapshot((prev) => {
        if (!prev || prev.campaignId !== selectedCampaignId) return prev
        return {
          ...prev,
          outputs: structuredClone([...prev.outputs, added]).sort((a, b) => a.order_index - b.order_index),
        }
      })
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to add output')
    } finally {
      setSaving(false)
    }
  }

  async function saveAll() {
    if (!selectedCampaign || !savedSnapshot) return

    const merged: ReengagementCampaignOutput[] = []
    for (const o of outputs) {
      const draft = outputJsonDrafts[o.id]
      if (draft === undefined) {
        merged.push(o)
        continue
      }
      try {
        merged.push({
          ...o,
          config: JSON.parse(draft) as Record<string, unknown>,
        })
      } catch {
        notifyError(`Output step ${o.order_index + 1}: Config JSON is invalid.`)
        return
      }
    }
    const sortedMerged = [...merged].sort((a, b) => a.order_index - b.order_index)
    setOutputs(sortedMerged)

    setSaving(true)
    try {
      const campRes = await fetch('/api/reengagement/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedCampaign),
      })
      const campData = await campRes.json()
      if (!campRes.ok) throw new Error(campData.error || 'Failed to save campaign')
      const updatedCampaign = normalizeReengagementCampaign(campData.campaign as ReengagementCampaign)

      const patchedOutputs: ReengagementCampaignOutput[] = []
      for (const o of sortedMerged) {
        const outRes = await fetch('/api/reengagement/outputs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(o),
        })
        const outData = await outRes.json()
        if (!outRes.ok) throw new Error(outData.error || 'Failed to save output')
        patchedOutputs.push(outData.output as ReengagementCampaignOutput)
      }

      const sortedOut = patchedOutputs.sort((a, b) => a.order_index - b.order_index)
      setCampaigns((prev) => prev.map((c) => (c.id === updatedCampaign.id ? updatedCampaign : c)))
      setOutputs(sortedOut)
      setOutputJsonDrafts(
        Object.fromEntries(sortedOut.map((o) => [o.id, JSON.stringify(o.config ?? {}, null, 2)]))
      )
      setSavedSnapshot({
        campaignId: updatedCampaign.id,
        campaign: structuredClone(updatedCampaign),
        outputs: structuredClone(sortedOut),
      })
      notifySuccess('Saved')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Save failed')
      void loadCampaigns()
      if (selectedCampaignId) void loadOutputs(selectedCampaignId)
    } finally {
      setSaving(false)
    }
  }

  async function deleteOutput(id: string) {
    const ok = await confirm({
      title: 'Delete output step?',
      variant: 'destructive',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    setSaving(true)
    try {
      const res = await fetch(`/api/reengagement/outputs?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete output')
      setOutputs((prev) => prev.filter((o) => o.id !== id))
      setOutputJsonDrafts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setSavedSnapshot((prev) => {
        if (!prev || prev.campaignId !== selectedCampaignId) return prev
        return {
          ...prev,
          outputs: structuredClone(prev.outputs.filter((o) => o.id !== id)),
        }
      })
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to delete output')
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
      setSavedSnapshot((prev) => {
        if (!prev || prev.campaignId !== selectedCampaignId) return prev
        return {
          ...prev,
          outputs: structuredClone(reordered),
        }
      })
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to reorder outputs')
      void loadOutputs(selectedCampaignId!)
    }
  }

  async function runTest() {
    if (!testUserId.trim()) {
      notifyError('Select a recipient user.')
      return
    }
    const envConfigured = Boolean(secretMeta?.hasPrimary || secretMeta?.hasDemo)
    if (!envConfigured && !testSecret.trim()) {
      notifyError('Enter the reengagement secret.')
      return
    }
    setSaving(true)
    try {
      const secretToSend = envConfigured ? undefined : testSecret.trim()
      const testBody: {
        userId: string
        campaignId?: string
        secret?: string
        triggerType?: string
      } = {
        userId: testUserId.trim(),
        campaignId: selectedCampaignId ?? undefined,
        secret: secretToSend,
      }
      if (selectedCampaign?.trigger_type === 'subscription_cancelled') {
        testBody.triggerType = 'subscription_cancelled'
      }
      const res = await fetch('/api/reengagement/test-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testBody),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test run failed')
      notifySuccess(JSON.stringify(data.result), 'Test run complete')
      if (selectedCampaignId && campaignPanelTab === 'executions') {
        void loadExecutionsPage(selectedCampaignId, executionsPage)
      }
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Test run failed')
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6">
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-gray-50">
          <h2 className="text-sm font-semibold">Campaigns</h2>
          <Button size="sm" className="h-7 shrink-0" onClick={() => createCampaign()} disabled={saving || loading}>
            New
          </Button>
        </div>
        <div className="divide-y">
          {loading ? (
            <p className="text-sm text-gray-500 px-3 py-4">Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
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
          <>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-background">
            <div className="flex h-14 shrink-0 items-end justify-between gap-3 border-b border-gray-200 bg-background px-3 sm:px-4">
              <div className="flex min-h-0 min-w-0 flex-1 items-end gap-2 sm:gap-3">
                <h2 className="shrink-0 pb-2.5 text-sm font-semibold text-foreground">Campaign settings</h2>
                <div className="flex items-end gap-px" role="tablist" aria-label="Campaign panel">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={campaignPanelTab === 'config'}
                    className={cn(
                      'min-w-[6.5rem] rounded-t-md border border-transparent border-b-0 px-4 py-2 text-center text-xs font-medium transition-colors sm:min-w-[7.5rem] sm:px-6',
                      campaignPanelTab === 'config'
                        ? 'relative z-[1] -mb-px border-gray-200 border-b-background bg-background text-foreground shadow-[0_-1px_2px_rgba(0,0,0,0.03)] dark:border-zinc-700 dark:border-b-background dark:shadow-none'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                    onClick={() => setCampaignPanelTab('config')}
                  >
                    Config
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={campaignPanelTab === 'audience'}
                    className={cn(
                      'min-w-[6.5rem] rounded-t-md border border-transparent border-b-0 px-4 py-2 text-center text-xs font-medium transition-colors sm:min-w-[7.5rem] sm:px-6',
                      campaignPanelTab === 'audience'
                        ? 'relative z-[1] -mb-px border-gray-200 border-b-background bg-background text-foreground shadow-[0_-1px_2px_rgba(0,0,0,0.03)] dark:border-zinc-700 dark:border-b-background dark:shadow-none'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                    onClick={() => setCampaignPanelTab('audience')}
                  >
                    Audience
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={campaignPanelTab === 'outputs'}
                    className={cn(
                      'min-w-[6.5rem] rounded-t-md border border-transparent border-b-0 px-4 py-2 text-center text-xs font-medium transition-colors sm:min-w-[7.5rem] sm:px-6',
                      campaignPanelTab === 'outputs'
                        ? 'relative z-[1] -mb-px border-gray-200 border-b-background bg-background text-foreground shadow-[0_-1px_2px_rgba(0,0,0,0.03)] dark:border-zinc-700 dark:border-b-background dark:shadow-none'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                    onClick={() => setCampaignPanelTab('outputs')}
                  >
                    Outputs
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={campaignPanelTab === 'executions'}
                    className={cn(
                      'min-w-[6.5rem] rounded-t-md border border-transparent border-b-0 px-6 py-2 text-center text-xs font-medium transition-colors sm:min-w-[7.5rem] sm:px-8',
                      campaignPanelTab === 'executions'
                        ? 'relative z-[1] -mb-px border-gray-200 border-b-background bg-background text-foreground shadow-[0_-1px_2px_rgba(0,0,0,0.03)] dark:border-zinc-700 dark:border-b-background dark:shadow-none'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
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
              <div className="flex min-h-[2.25rem] min-w-[200px] shrink-0 items-end justify-end gap-1 pb-2.5 sm:min-w-[240px]">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                  title="Test run (run-reengagement)"
                  onClick={() => {
                    setTestRunModalOpen(true)
                    void loadTestUsers()
                  }}
                >
                  <Play className="h-4 w-4" />
                </Button>
                {campaignPanelTab !== 'executions' ? (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => deleteCampaign(selectedCampaign.id)} disabled={saving}>
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void saveAll()}
                      disabled={saving || !canSave || !isDirty}
                      title={
                        !canSave || outputsLoading
                          ? 'Loading…'
                          : !isDirty
                            ? 'No unsaved changes'
                            : 'Save campaign and all outputs'
                      }
                    >
                      Save changes
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            {campaignPanelTab === 'config' ? (
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
                    {REENGAGEMENT_TRIGGER_TYPES.map((tt) => (
                      <option key={tt} value={tt}>
                        {REENGAGEMENT_TRIGGER_LABELS[tt]}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              {selectedCampaign.trigger_type === 'subscription_cancelled' ? (
                <div className="rounded-md border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
                  <p className="font-medium text-amber-900 dark:text-amber-50">Superwall churn trigger</p>
                  <p className="mt-2 text-amber-950/90 dark:text-amber-100/90">
                    Production runs when Superwall sends cancellation or expiration events to your Edge Function. Configure
                    the webhook URL in Superwall to point at{' '}
                    {superwallReengagementWebhookUrl ? (
                      <code className="break-all rounded bg-amber-100/80 px-1 py-0.5 text-[11px] dark:bg-amber-900/50">
                        {superwallReengagementWebhookUrl}
                      </code>
                    ) : (
                      <code className="text-[11px]">
                        {'{SUPABASE_URL}'}/functions/v1/superwall-reengagement-webhook
                      </code>
                    )}
                    . Optional header: <code className="text-[11px]">x-superwall-webhook-secret</code> if you set{' '}
                    <code className="text-[11px]">SUPERWALL_WEBHOOK_SECRET</code>.
                  </p>
                  <p className="mt-2 text-amber-950/90 dark:text-amber-100/90">
                    Only campaigns with this trigger type are selected. For win-back flows, consider{' '}
                    <strong>Skip if subscribed</strong> tokens such as <code className="text-[11px]">has_active_subscription</code>{' '}
                    so users who resubscribe are not spammed.
                  </p>
                  <p className="mt-2 text-amber-950/90 dark:text-amber-100/90">
                    Push steps need active push tokens and user notification preference for reengagement; friend requests and
                    profile views need demo-role users in the sender/viewer pools.
                  </p>
                </div>
              ) : null}

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

              {selectedCampaign.trigger_type === 'scheduled' ? (
                <div className="-mx-4 border-t border-gray-200 px-4 pt-6 space-y-4 dark:border-zinc-700">
                  <div>
                    <h3 className="text-sm font-semibold">Schedule</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Audience is evaluated at send time (profile sweep). Cron and <code className="text-[11px]">next_run_at</code>{' '}
                      use UTC; timezone is for display. Set <code className="text-[11px]">next_run_at</code> for the orchestrator
                      to pick up this campaign.
                    </p>
                  </div>

                  <label className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm">Pause schedule</span>
                    <Switch
                      checked={selectedCampaign.schedule_paused}
                      onCheckedChange={(checked) =>
                        setCampaigns((prev) =>
                          prev.map((c) =>
                            c.id === selectedCampaign.id ? { ...c, schedule_paused: checked } : c
                          )
                        )
                      }
                    />
                  </label>
                  <p className="text-[11px] text-gray-500 -mt-2">
                    When paused, run-scheduled-reengagement ignores this row; <code className="text-[11px]">next_run_at</code> is
                    kept.
                  </p>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Schedule timezone (display)</Label>
                      <Input
                        value={selectedCampaign.schedule_timezone}
                        onChange={(e) =>
                          setCampaigns((prev) =>
                            prev.map((c) =>
                              c.id === selectedCampaign.id
                                ? { ...c, schedule_timezone: e.target.value || 'UTC' }
                                : c
                            )
                          )
                        }
                        placeholder="UTC"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Schedule kind</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={selectedCampaign.schedule_kind ?? ''}
                        onChange={(e) => {
                          const v = e.target.value as '' | ReengagementScheduleKind
                          setCampaigns((prev) =>
                            prev.map((c) => {
                              if (c.id !== selectedCampaign.id) return c
                              const kind = v === '' ? null : v
                              return {
                                ...c,
                                schedule_kind: kind,
                                schedule_cron: kind === 'recurring' ? c.schedule_cron : null,
                              }
                            })
                          )
                        }}
                      >
                        <option value="">(unset)</option>
                        <option value="one_off">one_off</option>
                        <option value="recurring">recurring</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>scheduled_at</Label>
                      <IsoUtcDateTimePickers
                        idPrefix={`camp-${selectedCampaign.id}-scheduled`}
                        value={selectedCampaign.scheduled_at}
                        onChange={(iso) =>
                          setCampaigns((prev) =>
                            prev.map((c) =>
                              c.id === selectedCampaign.id ? { ...c, scheduled_at: iso } : c
                            )
                          )
                        }
                      />
                      <p className="text-[11px] text-gray-500">
                        Semantic first run for one-off. Date and time use your device timezone; saved as UTC for the API.
                      </p>
                    </div>
                    {selectedCampaign.schedule_kind === 'recurring' ? (
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>schedule_cron (5 fields, UTC)</Label>
                        <Input
                          value={selectedCampaign.schedule_cron ?? ''}
                          placeholder="0 9 * * 1"
                          onChange={(e) =>
                            setCampaigns((prev) =>
                              prev.map((c) =>
                                c.id === selectedCampaign.id
                                  ? { ...c, schedule_cron: e.target.value.trim() || null }
                                  : c
                              )
                            )
                          }
                        />
                        <p className="text-[11px] text-gray-500">Example: Monday 09:00 UTC → 0 9 * * 1</p>
                      </div>
                    ) : null}
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>next_run_at</Label>
                      <IsoUtcDateTimePickers
                        idPrefix={`camp-${selectedCampaign.id}-nextrun`}
                        value={selectedCampaign.next_run_at}
                        onChange={(iso) =>
                          setCampaigns((prev) =>
                            prev.map((c) =>
                              c.id === selectedCampaign.id ? { ...c, next_run_at: iso } : c
                            )
                          )
                        }
                      />
                      <p className="text-[11px] text-gray-500">
                        When the orchestrator should treat this campaign as due. Same local date/time → UTC storage as above.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border border-dashed border-gray-200 bg-gray-50/80 p-3 text-xs text-gray-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                    <p className="font-medium text-gray-700 dark:text-zinc-300">Orchestrator status (read-only)</p>
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      <li>
                        last_run_at:{' '}
                        {selectedCampaign.last_run_at ? formatDate(selectedCampaign.last_run_at) : '—'}
                      </li>
                      <li>
                        schedule_run_in_progress: {selectedCampaign.schedule_run_in_progress ? 'true' : 'false'}
                      </li>
                      <li className="font-mono text-[11px] break-all">
                        schedule_resume_after_user_id: {selectedCampaign.schedule_resume_after_user_id ?? '—'}
                      </li>
                    </ul>
                  </div>
                </div>
              ) : null}

              </div>
            ) : campaignPanelTab === 'audience' ? (
              <div className="p-4 space-y-6">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Audience filter</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Optional limits on <code className="text-[11px]">profiles</code> (gender, ISO country, age). Leave empty to
                      target all users. Scheduled sweeps apply this in SQL; single/batch runs re-check the same rules.
                    </p>
                    <p className="mt-2 text-xs text-amber-900/90 dark:text-amber-200/90">
                      If a rule is set and the profile field is missing (NULL), the user does not match — e.g. gender filter
                      excludes users with no gender.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Popover
                      modal={false}
                      open={audienceAddFilterPickerOpen}
                      onOpenChange={setAudienceAddFilterPickerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button type="button" size="sm" variant="outline" disabled={audienceFilterRows.length >= 3}>
                          + Add filter
                          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[220px] p-1" align="start">
                        <div className="space-y-1">
                          {AUDIENCE_FILTER_OPTIONS.map((opt) => {
                            const alreadyAdded = audienceFilterRows.includes(opt.value)
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                disabled={alreadyAdded}
                                className={cn(
                                  'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm',
                                  alreadyAdded
                                    ? 'cursor-not-allowed text-muted-foreground opacity-60'
                                    : 'hover:bg-muted'
                                )}
                                onClick={() => {
                                  if (alreadyAdded) return
                                  setAudienceFilterRows((prev) => [...prev, opt.value])
                                  setAudienceAddFilterPickerOpen(false)
                                }}
                              >
                                <span>{opt.label}</span>
                                {alreadyAdded ? <Check className="h-4 w-4" /> : null}
                              </button>
                            )
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {audienceFilterRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No filters, everyone matches.</p>
                  ) : null}

                  {audienceFilterRows.map((kind, idx) => (
                    <div key={`${kind}-${idx}`} className="space-y-2 rounded-md border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={kind}
                        onChange={(e) => {
                          const nextKind = e.target.value as AudienceFilterKind
                          if (nextKind === kind) return
                          if (audienceFilterRows.includes(nextKind)) return
                          setCampaigns((prev) =>
                            prev.map((c) => {
                              if (c.id !== selectedCampaign.id) return c
                              const nextAf: ReengagementAudienceFilter = { ...c.audience_filter }
                              if (kind === 'genders') delete nextAf.genders
                              if (kind === 'country_codes') delete nextAf.country_codes
                              if (kind === 'age') {
                                delete nextAf.age_min
                                delete nextAf.age_max
                              }
                              return { ...c, audience_filter: normalizeAudienceFilter(nextAf) }
                            })
                          )
                          setAudienceFilterRows((prev) => prev.map((r, i) => (i === idx ? nextKind : r)))
                        }}
                      >
                        <option value="genders">Gender</option>
                        <option value="country_codes">Country</option>
                        <option value="age">Age</option>
                      </select>
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setCampaigns((prev) =>
                              prev.map((c) => {
                                if (c.id !== selectedCampaign.id) return c
                                const nextAf: ReengagementAudienceFilter = { ...c.audience_filter }
                                if (kind === 'genders') delete nextAf.genders
                                if (kind === 'country_codes') delete nextAf.country_codes
                                if (kind === 'age') {
                                  delete nextAf.age_min
                                  delete nextAf.age_max
                                }
                                return { ...c, audience_filter: normalizeAudienceFilter(nextAf) }
                              })
                            )
                            setAudienceFilterRows((prev) => prev.filter((_, i) => i !== idx))
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {kind === 'genders' ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {REENGAGEMENT_GENDER_OPTIONS.map((option) => {
                            const selected = (selectedCampaign.audience_filter.genders ?? []).includes(option)
                            const genderEmoji: Record<string, string> = { male: '👨', female: '👩', other: '⚧️' }
                            return (
                              <button
                                key={option}
                                type="button"
                                className={`text-xs rounded border px-2 py-1 capitalize ${
                                  selected ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-gray-300 text-gray-600'
                                }`}
                                onClick={() =>
                                  setCampaigns((prev) =>
                                    prev.map((c) => {
                                      if (c.id !== selectedCampaign.id) return c
                                      const nextAf: ReengagementAudienceFilter = { ...c.audience_filter }
                                      const cur = new Set(nextAf.genders ?? [])
                                      if (cur.has(option)) cur.delete(option)
                                      else cur.add(option)
                                      if (cur.size) nextAf.genders = [...cur].sort()
                                      else delete nextAf.genders
                                      return { ...c, audience_filter: normalizeAudienceFilter(nextAf) }
                                    })
                                  )
                                }
                              >
                                {genderEmoji[option] ? `${genderEmoji[option]} ${option}` : option}
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Compared case-insensitively to profiles.gender (stored normalized).
                        </p>
                      </>
                    ) : null}

                    {kind === 'country_codes' ? (
                      <CountryCodeMultiSelect
                        selected={selectedCampaign.audience_filter.country_codes ?? []}
                        disabled={saving}
                        onChange={(codes) =>
                          setCampaigns((prev) =>
                            prev.map((c) => {
                              if (c.id !== selectedCampaign.id) return c
                              const nextAf: ReengagementAudienceFilter = { ...c.audience_filter }
                              if (codes.length) nextAf.country_codes = codes
                              else delete nextAf.country_codes
                              return { ...c, audience_filter: normalizeAudienceFilter(nextAf) }
                            })
                          )
                        }
                      />
                    ) : null}

                    {kind === 'age' ? (
                      <>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Age min (inclusive)</Label>
                            <Input
                              type="number"
                              min={0}
                              max={150}
                              placeholder="Any"
                              value={selectedCampaign.audience_filter.age_min ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value
                                setCampaigns((prev) =>
                                  prev.map((c) => {
                                    if (c.id !== selectedCampaign.id) return c
                                    const nextAf: ReengagementAudienceFilter = { ...c.audience_filter }
                                    if (raw === '') delete nextAf.age_min
                                    else {
                                      const n = Math.floor(Number(raw))
                                      if (!Number.isFinite(n) || n < 0 || n > 150) return c
                                      nextAf.age_min = n
                                    }
                                    return { ...c, audience_filter: normalizeAudienceFilter(nextAf) }
                                  })
                                )
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Age max (inclusive)</Label>
                            <Input
                              type="number"
                              min={0}
                              max={150}
                              placeholder="Any"
                              value={selectedCampaign.audience_filter.age_max ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value
                                setCampaigns((prev) =>
                                  prev.map((c) => {
                                    if (c.id !== selectedCampaign.id) return c
                                    const nextAf: ReengagementAudienceFilter = { ...c.audience_filter }
                                    if (raw === '') delete nextAf.age_max
                                    else {
                                      const n = Math.floor(Number(raw))
                                      if (!Number.isFinite(n) || n < 0 || n > 150) return c
                                      nextAf.age_max = n
                                    }
                                    return { ...c, audience_filter: normalizeAudienceFilter(nextAf) }
                                  })
                                )
                              }}
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Compared to profiles.age. If min or max is set and age is NULL, the user does not match.
                        </p>
                      </>
                    ) : null}
                    </div>
                  ))}
                </div>

                <div className="-mx-4 border-t border-gray-200 dark:border-zinc-700" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Entitlements</h3>
                    {!entitlementsUiVisible ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => setEntitlementsUiVisible(true)}>
                        + Add entitlement filter
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEntitlementsUiVisible(false)
                          setCampaigns((prev) =>
                            prev.map((c) =>
                              c.id === selectedCampaign.id ? { ...c, skip_if_subscribed_entitlements: [] } : c
                            )
                          )
                        }}
                      >
                        Remove filter
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Filter users by subscription-related entitlement flags.
                  </p>
                  {!entitlementsUiVisible ? (
                    <p className="text-xs text-muted-foreground">No entitlement filter. Users are not filtered by subscription.</p>
                  ) : (
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
                  )}
                </div>

                <div className="-mx-4 border-t border-gray-200 dark:border-zinc-700" />

                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold">Frequency &amp; limits</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Run once per user caps the campaign to at most one successful run per user (lifetime). Intensity sets how
                      often a user can be matched again inside a rolling window (days). Those ideas are different; when Run once
                      per user is on, intensity does not apply and is hidden.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Limit</h4>
                    <p className="text-xs text-gray-500">
                      When enabled, this campaign runs at most once per user for this campaign (lifetime).
                    </p>
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
                  </div>

                  {!selectedCampaign.run_once_per_user ? (
                    <div className="-mx-4 space-y-3 border-t border-gray-200 px-4 pt-5 dark:border-zinc-700">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <h4 className="text-sm font-semibold">Intensity</h4>
                      </div>
                      <p className="text-xs text-gray-500">
                        Cap how often this campaign can run per user. The window length is always measured in days.
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-md border border-input bg-background px-3 py-2">
                        <span className="text-sm text-muted-foreground">up to</span>
                        <select
                          className="h-9 min-w-[7.5rem] rounded-md border border-input bg-background px-2 text-sm"
                          value={
                            selectedCampaign.intensity_type === 'once_per_user'
                              ? '1'
                              : String(Math.max(2, selectedCampaign.intensity_x ?? 2))
                          }
                          onChange={(e) => {
                            const v = e.target.value
                            setCampaigns((prev) =>
                              prev.map((c) => {
                                if (c.id !== selectedCampaign.id) return c
                                if (v === '1') {
                                  return {
                                    ...c,
                                    intensity_type: 'once_per_user' as ReengagementIntensityType,
                                    intensity_x: null,
                                    intensity_y_days: null,
                                  }
                                }
                                const x = Number(v)
                                return {
                                  ...c,
                                  intensity_type: 'x_per_y_days' as ReengagementIntensityType,
                                  intensity_x: Number.isFinite(x) ? x : 2,
                                  intensity_y_days:
                                    c.intensity_y_days != null && c.intensity_y_days > 0 ? c.intensity_y_days : 7,
                                }
                              })
                            )
                          }}
                        >
                          <option value="1">1 time</option>
                          {Array.from({ length: 29 }, (_, i) => i + 2).map((n) => (
                            <option key={n} value={String(n)}>
                              {n} times
                            </option>
                          ))}
                        </select>
                        {selectedCampaign.intensity_type === 'x_per_y_days' ? (
                          <>
                            <span className="text-sm text-muted-foreground">every</span>
                            <Input
                              type="number"
                              min={1}
                              max={3650}
                              className="h-9 w-20 text-center"
                              value={selectedCampaign.intensity_y_days ?? ''}
                              onChange={(e) =>
                                setCampaigns((prev) =>
                                  prev.map((c) => {
                                    if (c.id !== selectedCampaign.id) return c
                                    const raw = e.target.value
                                    if (raw === '') {
                                      return { ...c, intensity_y_days: null }
                                    }
                                    const n = Math.floor(Number(raw))
                                    if (!Number.isFinite(n) || n < 1) return c
                                    return { ...c, intensity_y_days: n }
                                  })
                                )
                              }
                            />
                            <span className="inline-flex h-9 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                              days
                            </span>
                          </>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                          title="Reset intensity"
                          onClick={() =>
                            setCampaigns((prev) =>
                              prev.map((c) =>
                                c.id === selectedCampaign.id
                                  ? {
                                      ...c,
                                      intensity_type: 'once_per_user',
                                      intensity_x: null,
                                      intensity_y_days: null,
                                    }
                                  : c
                              )
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : campaignPanelTab === 'outputs' ? (
              <div className="p-4 space-y-3">
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
                    .map((output, index, ordered) => (
                      <div key={output.id} className="flex flex-col items-center">
                        <div className="w-full max-w-2xl">
                          <OutputEditor
                            output={output}
                            index={index}
                            total={outputs.length}
                            disabled={saving}
                            configDraft={outputJsonDrafts[output.id] ?? JSON.stringify(output.config ?? {}, null, 2)}
                            onConfigDraftChange={(text) =>
                              setOutputJsonDrafts((prev) => ({ ...prev, [output.id]: text }))
                            }
                            onChange={(next) => {
                              setOutputs((prev) => prev.map((o) => (o.id === output.id ? next : o)))
                              setOutputJsonDrafts((prev) => ({
                                ...prev,
                                [output.id]: JSON.stringify(next.config ?? {}, null, 2),
                              }))
                            }}
                            onSaveAll={() => void saveAll()}
                            saveDisabled={saving || !canSave || !isDirty}
                            onDelete={() => deleteOutput(output.id)}
                            onMoveUp={() => moveOutput(output.id, -1)}
                            onMoveDown={() => moveOutput(output.id, 1)}
                          />
                        </div>
                        {index < ordered.length - 1 ? (
                          <div className="flex flex-col items-center py-2">
                            <div className="h-4 w-px bg-gray-300" />
                            <ArrowDown className="h-4 w-4 text-gray-400" />
                            {Number(ordered[index + 1].delay_seconds ?? 0) > 0 ? (
                              <div className="mt-1 inline-flex items-center gap-2 rounded-md border border-dashed border-gray-200 bg-gray-50/80 px-3 py-1.5">
                                <span className="text-xs text-gray-600">Delay</span>
                                <Input
                                  type="number"
                                  className="h-8 w-24 text-center"
                                  value={ordered[index + 1].delay_seconds}
                                  onChange={(e) =>
                                    setOutputs((prev) =>
                                      prev.map((o) =>
                                        o.id === ordered[index + 1].id
                                          ? { ...o, delay_seconds: Number(e.target.value) || 0 }
                                          : o
                                      )
                                    )
                                  }
                                  disabled={saving}
                                />
                                <span className="text-xs text-gray-500">sec</span>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mt-1 h-8 px-3 text-xs"
                                disabled={saving}
                                onClick={() =>
                                  setOutputs((prev) =>
                                    prev.map((o) =>
                                      o.id === ordered[index + 1].id ? { ...o, delay_seconds: 5 } : o
                                    )
                                  )
                                }
                              >
                                + Add delay
                              </Button>
                            )}
                            <div className="mt-1 h-4 w-px bg-gray-300" />
                          </div>
                        ) : null}
                      </div>
                    ))
                )}
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
                <div className="-mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 pt-3 text-xs text-gray-500 dark:border-zinc-800">
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

          <Dialog
            open={testRunModalOpen}
            onOpenChange={(open) => {
              setTestRunModalOpen(open)
              if (!open) setTestRecipientPickerOpen(false)
            }}
          >
            <DialogContent
              className="max-w-md gap-4 p-4"
              onPointerDownOutside={(e) => {
                const t = e.target as HTMLElement
                if (
                  t.closest('[data-radix-popper-content-wrapper]') ||
                  t.closest('[data-radix-popover-content]') ||
                  t.closest('[cmdk-root]') ||
                  t.closest('[role="listbox"]')
                ) {
                  e.preventDefault()
                }
              }}
              onInteractOutside={(e) => {
                const t = e.target as HTMLElement
                if (
                  t.closest('[data-radix-popper-content-wrapper]') ||
                  t.closest('[data-radix-popover-content]') ||
                  t.closest('[cmdk-root]') ||
                  t.closest('[role="listbox"]')
                ) {
                  e.preventDefault()
                }
              }}
            >
              <div className="flex flex-col gap-4">
                <DialogHeader className="space-y-0">
                  <DialogTitle className="text-sm font-semibold">Test run — {selectedCampaign.name}</DialogTitle>
                </DialogHeader>
                <p className="text-xs text-muted-foreground">
                  {selectedCampaign.trigger_type === 'subscription_cancelled' ? (
                    <>
                      Calls{' '}
                      <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">run-reengagement</code> with{' '}
                      <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">triggerType: subscription_cancelled</code>{' '}
                      (same shape as <code className="text-[11px]">superwall-reengagement-webhook</code>) plus{' '}
                      <code className="text-[11px]">userId</code>, <code className="text-[11px]">secret</code>, and this
                      campaign&apos;s id so only matching active campaigns run.
                    </>
                  ) : selectedCampaign.trigger_type === 'scheduled' ? (
                    <>
                      Calls{' '}
                      <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">run-reengagement</code> for this
                      user with this campaign id (mirrors scheduled batches). Cron and <code className="text-[11px]">next_run_at</code>{' '}
                      do not fire from this button.
                    </>
                  ) : (
                    <>
                      Calls{' '}
                      <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">run-reengagement</code> for this
                      user. With this campaign selected, that row is targeted; production app_close calls often omit{' '}
                      <code className="text-[11px]">campaignId</code> to evaluate all active <code className="text-[11px]">app_close</code>{' '}
                      campaigns.
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  If the user fails an <code className="text-[11px]">audience_filter</code> rule only, the edge function may return{' '}
                  <code className="text-[11px]">audience_mismatch</code> for that campaign in the result payload.
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-end">
                  <div className="space-y-1.5">
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
                        <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
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
                <DialogFooter className="gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTestRunModalOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={runTest} disabled={saving}>
                    Run test
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
          </>
        )}
      </section>
    </div>
  )
}

function CountryCodeMultiSelect({
  selected,
  onChange,
  disabled,
}: {
  selected: string[]
  onChange: (codes: string[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const sortedSelected = useMemo(() => [...selected].sort(), [selected])
  const countriesByCode = useMemo(() => new Map(COUNTRIES.map((c) => [c.code, c.name])), [])
  const filteredCountries = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter((c) => {
      const hay = `${c.name} ${c.code}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => searchInputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const toggle = useCallback(
    (code: string) => {
      const next = new Set(selected)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      onChange([...next].sort())
    },
    [selected, onChange]
  )

  return (
    <div className="space-y-2">
      {sortedSelected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {sortedSelected.map((code) => (
            <Badge key={code} variant="secondary" className="gap-1 pl-2 pr-1 text-xs">
              <span className="text-sm leading-none">{getFlagEmoji(code)}</span>
              <span className="max-w-[10rem] truncate">{countriesByCode.get(code) ?? code}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{code}</span>
              <button
                type="button"
                disabled={disabled}
                className="rounded p-0.5 hover:bg-muted disabled:pointer-events-none"
                aria-label={`Remove ${code}`}
                onClick={() => toggle(code)}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No countries selected — any country matches.</p>
      )}
      <Popover modal={false} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full justify-between font-normal"
            disabled={disabled}
          >
            <span className="text-muted-foreground">Add or remove countries…</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
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
                ref={searchInputRef}
                type="search"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or code…"
                className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-[260px] overflow-y-auto overflow-x-hidden p-1">
              {filteredCountries.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No country found.</div>
              ) : (
                filteredCountries.map((c) => {
                  const isSel = selectedSet.has(c.code)
                  return (
                    <button
                      key={c.code}
                      type="button"
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-gray-100 focus-visible:bg-gray-100',
                        isSel && 'bg-gray-100'
                      )}
                      onClick={() => toggle(c.code)}
                    >
                      <span className="text-base leading-none">{getFlagEmoji(c.code)}</span>
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">{c.code}</span>
                      {isSel ? <Check className="h-4 w-4 shrink-0 text-black" /> : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
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
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
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
                ref={searchInputRef}
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

/** Loose UUID v4-ish check for admin hints (runtime still validates). */
const PRIMARY_SENDER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const FRIEND_SENDER_LABELS: Record<ReengagementFriendSenderSelector, string> = {
  preferred_user: 'Preferred user → demo pool if primary unusable',
  specific_user: 'Specific user (optional demo pool fallback)',
  any_male: 'Any demo user (male)',
  any_female: 'Any demo user (female)',
  opposite_gender: 'Opposite gender vs target (unknown → no gender filter)',
  same_gender: 'Same gender as target (unknown → no gender filter)',
}

const FRIEND_POOL_LABELS: Record<ReengagementFriendPoolSelector, string> = {
  any_male: 'Any demo male',
  any_female: 'Any demo female',
  opposite_gender: 'Opposite gender vs target',
  same_gender: 'Same gender as target',
}

function FriendRequestConfigFields({
  output,
  disabled,
  onChange,
}: {
  output: ReengagementCampaignOutput
  disabled: boolean
  onChange: (next: ReengagementCampaignOutput) => void
}) {
  const fc = (output.config ?? {}) as Record<string, unknown>
  const rawSenderStr = typeof fc.sender_selector === 'string' ? fc.sender_selector : ''
  const sender: ReengagementFriendSenderSelector = isReengagementFriendSenderSelector(rawSenderStr)
    ? rawSenderStr
    : 'any_male'
  const senderUnknown = rawSenderStr.length > 0 && !isReengagementFriendSenderSelector(rawSenderStr)

  const prefId = typeof fc.preferred_user_id === 'string' ? fc.preferred_user_id.trim() : ''
  const specId = typeof fc.specific_user_id === 'string' ? fc.specific_user_id.trim() : ''
  const message = typeof fc.message === 'string' ? fc.message : ''

  const rawFallback = fc.fallback_sender_selector
  const hasSpecificFallback =
    sender === 'specific_user' &&
    rawFallback != null &&
    String(rawFallback).trim() !== ''

  const fallbackPool: ReengagementFriendPoolSelector = isReengagementFriendPoolSelector(rawFallback)
    ? rawFallback
    : 'any_male'

  const primaryUuidOk = PRIMARY_SENDER_UUID_RE.test(prefId) || PRIMARY_SENDER_UUID_RE.test(specId)
  const showPrimaryFields = sender === 'preferred_user' || sender === 'specific_user'

  const [demoUsers, setDemoUsers] = useState<TestRunUser[]>([])
  const [demoLoading, setDemoLoading] = useState(false)
  const [prefPickerOpen, setPrefPickerOpen] = useState(false)
  const [specPickerOpen, setSpecPickerOpen] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    setDemoLoading(true)
    void fetch('/api/users/list?demo_only=1', { signal: ac.signal })
      .then(async (r) => {
        const data = (await r.json()) as { users?: TestRunUser[]; error?: string }
        if (ac.signal.aborted) return
        if (!r.ok) {
          console.warn('Demo users list failed:', data.error ?? r.status)
          setDemoUsers([])
          return
        }
        const users = Array.isArray(data.users) ? data.users : []
        setDemoUsers(
          users.map((u) => ({
            ...u,
            role: typeof u.role === 'string' ? u.role : 'demo',
          }))
        )
      })
      .catch((err) => {
        if (ac.signal.aborted) return
        console.warn('Demo users list fetch error:', err)
        setDemoUsers([])
      })
      .finally(() => {
        if (!ac.signal.aborted) setDemoLoading(false)
      })
    return () => ac.abort()
  }, [])

  return (
    <div className="grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 md:grid-cols-2">
      <div className="space-y-1 md:col-span-2">
        <Label className="text-xs">Sender selector</Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
          disabled={disabled}
          value={sender}
          onChange={(e) => {
            const v = e.target.value as ReengagementFriendSenderSelector
            const next: Record<string, unknown> = { ...fc, sender_selector: v }
            if (v === 'preferred_user') {
              if (!isReengagementFriendPoolSelector(next.fallback_sender_selector)) {
                next.fallback_sender_selector = 'any_male'
              }
            } else if (v === 'specific_user') {
              // keep fallback if set; otherwise omit pool step
            } else {
              next.preferred_user_id = null
              next.specific_user_id = null
              next.fallback_sender_selector = null
            }
            onChange({ ...output, config: next })
          }}
        >
          {REENGAGEMENT_FRIEND_SENDER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {FRIEND_SENDER_LABELS[opt]}
            </option>
          ))}
        </select>
        {senderUnknown ? (
          <p className="text-[11px] text-amber-800 dark:text-amber-200">
            Stored <code className="font-mono">{rawSenderStr}</code> is not a known selector. Choose a value above to normalize
            JSON on save.
          </p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          Runtime resolves <code className="text-[11px]">primarySenderId</code> as{' '}
          <code className="text-[11px]">preferred_user_id</code> then <code className="text-[11px]">specific_user_id</code>. Demo
          pool is capped (~100 profiles), shuffled; only <code className="text-[11px]">user_roles.role = demo</code> may send.
        </p>
      </div>

      {showPrimaryFields ? (
        <>
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">preferred_user_id (tried first)</Label>
              {prefId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  disabled={disabled}
                  onClick={() => onChange({ ...output, config: { ...fc, preferred_user_id: null } })}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <TestUserCombobox
              label="Preferred sender"
              users={demoUsers}
              usersLoading={demoLoading}
              value={prefId}
              onChange={(id) =>
                onChange({
                  ...output,
                  config: { ...fc, preferred_user_id: id.trim() || null },
                })
              }
              open={prefPickerOpen}
              onOpenChange={setPrefPickerOpen}
            />
            <Input
              className="font-mono text-xs"
              disabled={disabled}
              value={prefId}
              placeholder="Or paste UUID (must be demo at runtime)"
              onChange={(e) =>
                onChange({
                  ...output,
                  config: { ...fc, preferred_user_id: e.target.value.trim() || null },
                })
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">specific_user_id (if preferred empty)</Label>
              {specId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  disabled={disabled}
                  onClick={() => onChange({ ...output, config: { ...fc, specific_user_id: null } })}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <TestUserCombobox
              label="Alternate sender"
              users={demoUsers}
              usersLoading={demoLoading}
              value={specId}
              onChange={(id) =>
                onChange({
                  ...output,
                  config: { ...fc, specific_user_id: id.trim() || null },
                })
              }
              open={specPickerOpen}
              onOpenChange={setSpecPickerOpen}
            />
            <Input
              className="font-mono text-xs"
              disabled={disabled}
              value={specId}
              placeholder="Or paste UUID (must be demo at runtime)"
              onChange={(e) =>
                onChange({
                  ...output,
                  config: { ...fc, specific_user_id: e.target.value.trim() || null },
                })
              }
            />
          </div>
          {sender === 'preferred_user' ? (
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">fallback_sender_selector (demo pool)</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                disabled={disabled}
                value={fallbackPool}
                onChange={(e) => {
                  const v = e.target.value as ReengagementFriendPoolSelector
                  onChange({
                    ...output,
                    config: { ...fc, fallback_sender_selector: v },
                  })
                }}
              >
                {REENGAGEMENT_FRIEND_POOL_SELECTOR_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {FRIEND_POOL_LABELS[opt]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {sender === 'specific_user' ? (
            <>
              <div className="flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2 md:col-span-2">
                <span className="text-sm">Fallback to demo pool if primary is unusable</span>
                <Switch
                  checked={hasSpecificFallback}
                  disabled={disabled}
                  onCheckedChange={(on) => {
                    onChange({
                      ...output,
                      config: {
                        ...fc,
                        fallback_sender_selector: on ? 'any_male' : null,
                      },
                    })
                  }}
                />
              </div>
              {hasSpecificFallback ? (
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">fallback_sender_selector</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                    disabled={disabled}
                    value={fallbackPool}
                    onChange={(e) => {
                      const v = e.target.value as ReengagementFriendPoolSelector
                      onChange({
                        ...output,
                        config: { ...fc, fallback_sender_selector: v },
                      })
                    }}
                  >
                    {REENGAGEMENT_FRIEND_POOL_SELECTOR_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {FRIEND_POOL_LABELS[opt]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </>
          ) : null}
          {sender === 'specific_user' && !hasSpecificFallback && !primaryUuidOk ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-200 md:col-span-2">
              With fallback off, set at least one valid demo UUID (preferred or specific) or this step will no-op at runtime.
            </p>
          ) : null}
          {showPrimaryFields && primaryUuidOk ? (
            <p className="text-[11px] text-muted-foreground md:col-span-2">
              Confirm in <code className="text-[11px]">user_roles</code> that the chosen user has <code className="text-[11px]">role
              = demo</code>; otherwise the engine skips the primary path.
            </p>
          ) : null}
        </>
      ) : null}

      <div className="space-y-1 md:col-span-2">
        <Label className="text-xs">Message (optional)</Label>
        <Input
          disabled={disabled}
          value={message}
          placeholder="Friend request message"
          onChange={(e) =>
            onChange({
              ...output,
              config: { ...fc, message: e.target.value || null },
            })
          }
        />
      </div>
    </div>
  )
}

function OutputEditor({
  output,
  index,
  total,
  disabled,
  configDraft,
  onConfigDraftChange,
  onChange,
  onSaveAll,
  saveDisabled,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  output: ReengagementCampaignOutput
  index: number
  total: number
  disabled: boolean
  configDraft: string
  onConfigDraftChange: (text: string) => void
  onChange: (next: ReengagementCampaignOutput) => void
  onSaveAll: () => void
  saveDisabled: boolean
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [outputTypePickerOpen, setOutputTypePickerOpen] = useState(false)

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

      <div className="grid grid-cols-1 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Output type</Label>
          <Popover modal={false} open={outputTypePickerOpen} onOpenChange={setOutputTypePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 w-full justify-between px-3 font-normal">
                <span className="truncate">{output.output_type}</span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-1" align="start">
              <div className="space-y-1">
                {OUTPUT_TYPE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted',
                      output.output_type === t && 'bg-muted'
                    )}
                    onClick={() => {
                      onChange({ ...output, output_type: t, config: defaultOutputConfig(t) })
                      setOutputTypePickerOpen(false)
                    }}
                  >
                    <span>{t}</span>
                    {output.output_type === t ? <Check className="h-4 w-4" /> : null}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {output.output_type === 'friend_request' ? (
        <FriendRequestConfigFields output={output} disabled={disabled} onChange={onChange} />
      ) : null}

      <div className="space-y-1">
        <Label className="text-xs">Config JSON</Label>
        <Textarea
          className="min-h-[120px] font-mono text-xs"
          value={configDraft}
          onChange={(e) => onConfigDraftChange(e.target.value)}
        />
      </div>
      <Button size="sm" onClick={onSaveAll} disabled={disabled || saveDisabled} title="Saves the whole campaign and every output step">
        Save changes
      </Button>
    </div>
  )
}
