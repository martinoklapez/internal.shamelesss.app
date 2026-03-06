'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type {
  CampaignsConfig,
  Campaign,
  FallbackGender,
  FlowSlot,
  GenderMode,
  Trigger,
  TargetSelection,
} from '@/lib/demo-reengagement-types'
import { createDefaultCampaign } from '@/lib/demo-reengagement-types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, X, Trash2, Plus } from 'lucide-react'

interface DemoUser {
  user_id: string
  name: string | null
  username: string | null
  profile_picture_url: string | null
  gender: string | null
}

interface DemoReengagementManagerProps {
  initialConfig: CampaignsConfig
  canEdit: boolean
}

const GENDER_MODE_OPTIONS: { value: GenderMode; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'all_opposite', label: 'Opposite' },
  { value: 'all_same', label: 'Same' },
  { value: 'random', label: 'Random' },
  { value: 'percentage', label: '%' },
]

const TRIGGER_OPTIONS: { value: Trigger; label: string }[] = [
  { value: 'app_close', label: 'App close' },
  { value: 'conversion_complete', label: 'Conversion complete' },
  { value: 'purchase_pro', label: 'Purchase Pro' },
]

const FALLBACK_OPTIONS: { value: FallbackGender; label: string }[] = [
  { value: 'any', label: 'None' },
  { value: 'opposite', label: 'Opposite' },
  { value: 'same', label: 'Same' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

function updateCampaign(
  campaigns: Campaign[],
  id: string,
  updater: (c: Campaign) => Campaign
): Campaign[] {
  return campaigns.map((c) => (c.id === id ? updater(c) : c))
}

export default function DemoReengagementManager({
  initialConfig,
  canEdit,
}: DemoReengagementManagerProps) {
  const [config, setConfig] = useState<CampaignsConfig>(initialConfig)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(
    initialConfig.campaigns[0]?.id ?? null
  )

  useEffect(() => {
    setConfig(initialConfig)
    if (!expandedId && initialConfig.campaigns[0]) {
      setExpandedId(initialConfig.campaigns[0].id)
    }
  }, [initialConfig])

  useEffect(() => {
    if (expandedId && !config.campaigns.some((c) => c.id === expandedId)) {
      setExpandedId(config.campaigns[0]?.id ?? null)
    }
  }, [config.campaigns, expandedId])

  useEffect(() => {
    if (!canEdit) return
    fetch('/api/demo-users')
      .then((r) => (r.ok ? r.json() : []))
      .then(setDemoUsers)
      .catch(() => setDemoUsers([]))
  }, [canEdit])

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
      setMessage({ type: 'success', text: 'Campaigns saved.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  const addCampaign = () => {
    const newCampaign = createDefaultCampaign()
    setConfig((prev) => ({ campaigns: [...prev.campaigns, newCampaign] }))
    setExpandedId(newCampaign.id)
  }

  const removeCampaign = (id: string) => {
    setConfig((prev) => ({ campaigns: prev.campaigns.filter((c) => c.id !== id) }))
    if (expandedId === id) setExpandedId(config.campaigns[0]?.id ?? null)
  }

  const setCampaign = (id: string, updater: (c: Campaign) => Campaign) => {
    setConfig((prev) => ({ campaigns: updateCampaign(prev.campaigns, id, updater) }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Campaigns</h2>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addCampaign}>
              <Plus className="mr-1 h-4 w-4" />
              Add campaign
            </Button>
            {config.campaigns.length > 0 && (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        )}
      </div>

      {config.campaigns.length === 0 ? (
        <Card className="border border-gray-200 p-6 text-center text-gray-500">
          No campaigns. Add one to get started.
        </Card>
      ) : (
        <div className="space-y-4">
          {config.campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              isExpanded={expandedId === campaign.id}
              onToggleExpand={() => setExpandedId((id) => (id === campaign.id ? null : campaign.id))}
              onUpdate={(updater) => setCampaign(campaign.id, updater)}
              onRemove={() => removeCampaign(campaign.id)}
              canEdit={canEdit}
              demoUsers={demoUsers}
            />
          ))}
        </div>
      )}

      {message && (
        <p className={cn('text-sm', message.type === 'success' ? 'text-green-600' : 'text-red-600')}>
          {message.text}
        </p>
      )}
    </div>
  )
}

interface FlowSlotRowProps {
  slot: FlowSlot
  index: number
  campaign: Campaign
  demoUsers: DemoUser[]
  demoUserMap: Map<string, DemoUser>
  canEdit: boolean
  flowSlots: FlowSlot[]
  updateSlot: (index: number, patch: Partial<FlowSlot>) => void
  moveFlow: (index: number, dir: 'up' | 'down') => void
  removeFlow: (index: number) => void
  FALLBACK_OPTIONS: { value: FallbackGender; label: string }[]
}

function FlowSlotRow({
  slot,
  index,
  campaign,
  demoUsers,
  demoUserMap,
  canEdit,
  flowSlots,
  updateSlot,
  moveFlow,
  removeFlow,
  FALLBACK_OPTIONS,
}: FlowSlotRowProps) {
  const [maleOpen, setMaleOpen] = useState(false)
  const [femaleOpen, setFemaleOpen] = useState(false)
  const [pickerGenderFilter, setPickerGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const maleId = slot.demo_user_id_male ?? slot.demo_user_id
  const femaleId = slot.demo_user_id_female ?? slot.demo_user_id

  const usersByGender =
    pickerGenderFilter === 'all'
      ? demoUsers
      : demoUsers.filter(
          (u) => (u.gender || '').toLowerCase() === pickerGenderFilter
        )

  const renderUserPicker = (
    label: string,
    userId: string | undefined,
    open: boolean,
    setOpen: (v: boolean) => void,
    field: 'demo_user_id_male' | 'demo_user_id_female'
  ) => {
    const u = userId ? demoUserMap.get(userId) : null
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 min-w-[140px] justify-between gap-1 text-xs font-normal"
            disabled={!canEdit}
          >
            {u ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <Avatar className="h-4 w-4 shrink-0">
                  {u.profile_picture_url ? (
                    <AvatarImage src={u.profile_picture_url} alt={u.name ?? u.user_id} />
                  ) : null}
                  <AvatarFallback className="text-[8px]">
                    {(u.name ?? u.username ?? u.user_id).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 truncate text-gray-900">{u.name || '—'}</span>
                {u.username ? (
                  <span className="shrink-0 text-gray-600">@{u.username}</span>
                ) : null}
              </div>
            ) : (
              <span className="text-gray-500">{label}: Select…</span>
            )}
            <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command
            filter={(value, search) => {
              const user = usersByGender.find((x) => x.user_id === value)
              if (!user) return 0
              const s = search.toLowerCase()
              const name = (user.name ?? '').toLowerCase()
              const username = (user.username ?? '').toLowerCase()
              const id = user.user_id.toLowerCase()
              return name.includes(s) || username.includes(s) || id.includes(s) ? 1 : 0
            }}
          >
            <CommandInput placeholder="Search by name or username…" className="h-9" />
            <div className="flex border-b border-gray-100 px-2 py-1.5 gap-1">
              {(['all', 'male', 'female'] as const).map((g) => (
                <Button
                  key={g}
                  type="button"
                  variant={pickerGenderFilter === g ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-[10px] capitalize"
                  onClick={() => setPickerGenderFilter(g)}
                >
                  {g === 'all' ? 'All' : g}
                </Button>
              ))}
            </div>
            <CommandList>
              <CommandEmpty>No user found.</CommandEmpty>
              <CommandGroup>
                {usersByGender.map((u) => (
                  <CommandItem
                    key={u.user_id}
                    value={u.user_id}
                    onSelect={() => {
                      updateSlot(index, { [field]: u.user_id })
                      setOpen(false)
                    }}
                    className="aria-selected:bg-gray-100 text-gray-900"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 shrink-0">
                        {u.profile_picture_url ? (
                          <AvatarImage src={u.profile_picture_url} alt={u.name ?? u.user_id} />
                        ) : null}
                        <AvatarFallback className="text-[10px] text-gray-700">
                          {(u.name ?? u.username ?? u.user_id).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 truncate font-medium text-gray-900">
                        {u.name || '—'}
                      </span>
                      {u.username ? (
                        <span className="shrink-0 text-gray-700">@{u.username}</span>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <li className="rounded border border-gray-100 bg-white px-2 py-1.5 text-xs">
      <div className="flex items-center gap-3">
        <span className="w-6 shrink-0 font-medium text-gray-500">{index + 1}.</span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-[10px] font-medium text-gray-500">If</span>
            <span className="shrink-0" aria-hidden>👨</span>
            <Label className="w-12 shrink-0 text-[10px] text-gray-600">Male</Label>
            <span className="shrink-0 text-[10px] text-gray-500">then</span>
            {renderUserPicker('Male', maleId, maleOpen, setMaleOpen, 'demo_user_id_male')}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-[10px] font-medium text-gray-500">If</span>
            <span className="shrink-0" aria-hidden>👩</span>
            <Label className="w-12 shrink-0 text-[10px] text-gray-600">Female</Label>
            <span className="shrink-0 text-[10px] text-gray-500">then</span>
            {renderUserPicker('Female', femaleId, femaleOpen, setFemaleOpen, 'demo_user_id_female')}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-l border-gray-100 pl-3">
          <Input
            placeholder="Message (optional)"
            value={slot.message ?? ''}
            onChange={(e) => updateSlot(index, { message: e.target.value.trim() || null })}
            disabled={!canEdit}
            className="h-6 w-24 text-xs"
          />
          <div className="flex items-center gap-1">
            <Label className="text-[10px] text-gray-500">Delay after</Label>
            <Input
              type="number"
              min={0}
              placeholder={String(campaign.delay_between_slots_seconds ?? 0)}
              value={slot.delay_after_seconds ?? ''}
              onChange={(e) => {
                const v = e.target.value
                updateSlot(index, {
                  delay_after_seconds:
                    v === '' ? undefined : Math.max(0, parseInt(v, 10) || 0),
                })
              }}
              disabled={!canEdit}
              className="h-6 w-12 text-xs"
            />
          </div>
          <Select
            value={slot.fallback?.gender ?? 'any'}
            onValueChange={(v) =>
              updateSlot(index, {
                fallback: v === 'any' ? undefined : { gender: v as FallbackGender },
              })
            }
            disabled={!canEdit}
          >
            <SelectTrigger className="h-6 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FALLBACK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit && (
            <div className="flex gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveFlow(index, 'up')}
                disabled={index === 0}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveFlow(index, 'down')}
                disabled={index === flowSlots.length - 1}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-600"
                onClick={() => removeFlow(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

interface CampaignCardProps {
  campaign: Campaign
  isExpanded: boolean
  onToggleExpand: () => void
  onUpdate: (updater: (c: Campaign) => Campaign) => void
  onRemove: () => void
  canEdit: boolean
  demoUsers: DemoUser[]
}

function CampaignCard({
  campaign,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  canEdit,
  demoUsers,
}: CampaignCardProps) {
  const demoUserMap = new Map(demoUsers.map((u) => [u.user_id, u]))
  const ts = campaign.target_selection
  const flowSlots = ts.mode === 'direct' ? ts.flow_slots : []
  const moveFlow = (index: number, dir: 'up' | 'down') => {
    const next = [...flowSlots]
    const j = dir === 'up' ? index - 1 : index + 1
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    onUpdate((c) => ({
      ...c,
      target_selection: { mode: 'direct', flow_slots: next },
    }))
  }

  const removeFlow = (index: number) => {
    onUpdate((c) => ({
      ...c,
      target_selection: {
        mode: 'direct',
        flow_slots: flowSlots.filter((_, i) => i !== index),
      },
    }))
  }

  const addEmptySlot = () => {
    const newSlot: FlowSlot = {
      demo_user_id: '',
      message: null,
    }
    onUpdate((c) => ({
      ...c,
      target_selection: { mode: 'direct', flow_slots: [...flowSlots, newSlot] },
    }))
  }

  const updateSlot = (index: number, patch: Partial<FlowSlot>) => {
    const next = flowSlots.map((s, i) => {
      if (i !== index) return s
      const updated = { ...s, ...patch }
      const fallbackId = updated.demo_user_id || updated.demo_user_id_male || updated.demo_user_id_female
      if (!updated.demo_user_id && fallbackId) {
        updated.demo_user_id = fallbackId
      }
      return updated
    })
    onUpdate((c) => ({
      ...c,
      target_selection: { mode: 'direct', flow_slots: next },
    }))
  }

  const setTargetSelection = (sel: TargetSelection) => {
    onUpdate((c) => ({ ...c, target_selection: sel }))
  }

  const percentageDisplay =
    ts.mode === 'demographics'
      ? Math.round(ts.gender_opposite_percentage * 100)
      : 50

  return (
    <Card className="border border-gray-200 overflow-hidden">
      <div className="flex w-full items-center justify-between gap-2 bg-gray-50/80 px-4 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80"
          onClick={onToggleExpand}
        >
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', isExpanded && 'rotate-180')}
          />
          <span className="truncate font-medium text-gray-900">{campaign.name || 'Unnamed'}</span>
          <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
            {campaign.trigger}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Label htmlFor={`enabled-${campaign.id}`} className="text-xs text-gray-600">
            On
          </Label>
          <Switch
            id={`enabled-${campaign.id}`}
            checked={campaign.enabled}
            onCheckedChange={(checked) => onUpdate((c) => ({ ...c, enabled: checked }))}
            disabled={!canEdit}
          />
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 border-t border-gray-200 p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="grid gap-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={campaign.name}
                onChange={(e) => onUpdate((c) => ({ ...c, name: e.target.value }))}
                disabled={!canEdit}
                placeholder="Campaign name"
                className="h-8 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Trigger</Label>
              <Select
                value={campaign.trigger}
                onValueChange={(v) => onUpdate((c) => ({ ...c, trigger: v as Trigger }))}
                disabled={!canEdit}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Delay (sec)</Label>
              <Input
                type="number"
                min={0}
                value={campaign.delay_seconds ?? 0}
                onChange={(e) =>
                  onUpdate((c) => ({
                    ...c,
                    delay_seconds: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
                disabled={!canEdit}
                placeholder="0, 30, 120…"
                className="h-8 text-sm"
              />
            </div>
            {ts.mode === 'direct' && flowSlots.length > 0 && (
              <div className="grid gap-1">
                <Label className="text-xs">Default delay between slots (sec)</Label>
                <Input
                  type="number"
                  min={0}
                  value={campaign.delay_between_slots_seconds ?? 0}
                  onChange={(e) =>
                    onUpdate((c) => ({
                      ...c,
                      delay_between_slots_seconds: Math.max(
                        0,
                        parseInt(e.target.value, 10) || 0
                      ),
                    }))
                  }
                  disabled={!canEdit}
                  placeholder="0"
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-gray-500">
                  Default delay between slots. Used when a slot has no per-slot delay.
                </p>
              </div>
            )}
            <div className="grid gap-1">
              <Label className="text-xs">Rate limit (h)</Label>
              <Input
                type="number"
                min={1}
                value={campaign.rate_limit_hours}
                onChange={(e) =>
                  onUpdate((c) => ({ ...c, rate_limit_hours: parseInt(e.target.value, 10) || 24 }))
                }
                disabled={!canEdit}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="grid gap-1">
              <Label className="text-xs">Max req/user</Label>
              <Input
                type="number"
                min={0}
                value={campaign.max_requests_per_user_per_day}
                onChange={(e) =>
                  onUpdate((c) => ({
                    ...c,
                    max_requests_per_user_per_day: parseInt(e.target.value, 10) || 0,
                  }))
                }
                disabled={!canEdit}
                className="h-8 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Req/trigger</Label>
              <Input
                type="number"
                min={1}
                value={campaign.requests_per_trigger}
                onChange={(e) =>
                  onUpdate((c) => ({
                    ...c,
                    requests_per_trigger: Math.max(1, parseInt(e.target.value, 10) || 1),
                  }))
                }
                disabled={!canEdit}
                className="h-8 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Min days signup</Label>
              <Input
                type="number"
                min={0}
                value={campaign.min_days_since_signup}
                onChange={(e) =>
                  onUpdate((c) => ({
                    ...c,
                    min_days_since_signup: parseInt(e.target.value, 10) || 0,
                  }))
                }
                disabled={!canEdit}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Skip if subscribed</Label>
              <Switch
                checked={campaign.skip_if_subscribed}
                onCheckedChange={(checked) =>
                  onUpdate((c) => ({ ...c, skip_if_subscribed: checked }))
                }
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Run once per user</Label>
              <Switch
                checked={campaign.run_once_per_user}
                onCheckedChange={(checked) =>
                  onUpdate((c) => ({ ...c, run_once_per_user: checked }))
                }
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Exclude promoter</Label>
              <Switch
                checked={campaign.exclude_promoter}
                onCheckedChange={(checked) => onUpdate((c) => ({ ...c, exclude_promoter: checked }))}
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Include message</Label>
              <Switch
                checked={campaign.include_message}
                onCheckedChange={(checked) => onUpdate((c) => ({ ...c, include_message: checked }))}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="grid gap-1 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Target</Label>
              <div className="mt-1 flex gap-1">
                <Button
                  type="button"
                  variant={ts.mode === 'direct' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setTargetSelection({ mode: 'direct', flow_slots: ts.mode === 'direct' ? ts.flow_slots : [] })
                  }
                  disabled={!canEdit}
                >
                  Direct
                </Button>
                <Button
                  type="button"
                  variant={ts.mode === 'demographics' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setTargetSelection(
                      ts.mode === 'demographics'
                        ? ts
                        : {
                            mode: 'demographics',
                            gender_mode: 'all_opposite',
                            gender_opposite_percentage: 0.5,
                            country_match: false,
                          }
                    )
                  }
                  disabled={!canEdit}
                >
                  Demographics
                </Button>
              </div>
            </div>
            {ts.mode === 'demographics' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1">
                  {GENDER_MODE_OPTIONS.map(({ value, label }) => (
                    <Button
                      key={value}
                      type="button"
                      variant={ts.gender_mode === value ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        onUpdate((c) => ({
                          ...c,
                          target_selection: { ...ts, gender_mode: value },
                        }))
                      }
                      disabled={!canEdit}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {ts.gender_mode === 'percentage' && (
                  <div className="flex items-center gap-1">
                    <Label className="text-xs">% opp.</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={percentageDisplay}
                      className="h-7 w-14 text-sm"
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0))
                        onUpdate((c) => ({
                          ...c,
                          target_selection: { ...ts, gender_opposite_percentage: v / 100 },
                        }))
                      }}
                      disabled={!canEdit}
                    />
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Label className="text-xs">Country match</Label>
                  <Switch
                    checked={ts.country_match}
                    onCheckedChange={(checked) =>
                      onUpdate((c) => ({
                        ...c,
                        target_selection: { ...ts, country_match: checked },
                      }))
                    }
                    disabled={!canEdit}
                  />
                </div>
              </div>
            )}
          </div>

          {ts.mode === 'direct' && (
            <div className="rounded border border-gray-200 bg-gray-50/50 p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Label className="text-xs">Flow slots</Label>
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={addEmptySlot}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add slot
                  </Button>
                )}
              </div>
              <ul className="space-y-1">
                {flowSlots.length === 0 ? (
                  <li className="text-xs text-gray-500">No slots in flow.</li>
                ) : (
                  flowSlots.map((slot, index) => (
                    <FlowSlotRow
                      key={`slot-${index}`}
                      slot={slot}
                      index={index}
                      campaign={campaign}
                      demoUsers={demoUsers}
                      demoUserMap={demoUserMap}
                      canEdit={canEdit}
                      flowSlots={flowSlots}
                      updateSlot={updateSlot}
                      moveFlow={moveFlow}
                      removeFlow={removeFlow}
                      FALLBACK_OPTIONS={FALLBACK_OPTIONS}
                    />
                  ))
                )}
              </ul>
            </div>
          )}

          <div className="grid gap-1">
            <Label className="text-xs">Message template</Label>
            <Textarea
              rows={1}
              placeholder="e.g. Hey!"
              value={campaign.message_template ?? ''}
              onChange={(e) =>
                onUpdate((c) => ({
                  ...c,
                  message_template: e.target.value.trim() || null,
                }))
              }
              disabled={!canEdit}
              className="min-h-[2rem] resize-y text-sm"
            />
          </div>
        </div>
      )}
    </Card>
  )
}
