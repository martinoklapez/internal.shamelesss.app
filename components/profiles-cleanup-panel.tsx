'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Trash2,
  RefreshCw,
  Download,
  Upload,
  ArchiveRestore,
  ListFilter,
  ChevronDown,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  isoAlpha2ToFlagEmoji,
  ProfileCountryDisplay,
  getRegionDisplayName,
} from '@/lib/country-display'
import { PROFILES_BACKUP_PASSCODE_HEADER } from '@/lib/profiles-backup-passcode-constants'
import { Input } from '@/components/ui/input'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const FILTER_NO_ROLE = '__profiles_filter_no_role__'
const FILTER_NO_COUNTRY = '__profiles_filter_no_country__'
const FILTER_NO_GENDER = '__profiles_filter_no_gender__'

function normalizeGenderFacet(g: string | null | undefined): string {
  return (g ?? '').trim().toLowerCase()
}

function facetLabelForGenderKey(key: string): string {
  if (key === FILTER_NO_GENDER) return '(Not set)'
  return key.replace(/-/g, ' ')
}

/** Empty field = no bound. */
function parseOptionalInt(raw: string): number | undefined {
  const t = raw.trim()
  if (t === '') return undefined
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : undefined
}

/** Empty string = ignore; otherwise require column filled or explicitly empty (AND-combined). */
type ProfilePresenceChoice = '' | 'present' | 'absent'

type ProfilePresenceFieldKey =
  | 'profile_photo'
  | 'display_name'
  | 'username'
  | 'instagram'
  | 'snapchat'
  | 'country'
  | 'gender'
  | 'age'
  | 'role'

export type CleanupProfileRow = {
  user_id: string
  role: string | null
  name: string | null
  username: string | null
  profile_picture_url: string | null
  age: number | null
  country_code: string | null
  gender: string | null
  instagram_handle: string | null
  snapchat_handle: string | null
  connection_count: number | null
  created_at: string | null
  updated_at: string | null
}

const INITIAL_PROFILE_PRESENCE_FILTERS: Record<
  ProfilePresenceFieldKey,
  ProfilePresenceChoice
> = {
  profile_photo: '',
  display_name: '',
  username: '',
  instagram: '',
  snapchat: '',
  country: '',
  gender: '',
  age: '',
  role: '',
}

const PROFILE_PRESENCE_ROWS: readonly {
  field: ProfilePresenceFieldKey
  label: string
}[] = [
  { field: 'profile_photo', label: 'Profile photo' },
  { field: 'display_name', label: 'Display name' },
  { field: 'username', label: 'Username' },
  { field: 'instagram', label: 'Instagram' },
  { field: 'snapchat', label: 'Snapchat' },
  { field: 'country', label: 'Country' },
  { field: 'gender', label: 'Gender' },
  { field: 'age', label: 'Age' },
  { field: 'role', label: 'Assigned role' },
]

function profileHasColumnPresent(
  field: ProfilePresenceFieldKey,
  p: CleanupProfileRow
): boolean {
  switch (field) {
    case 'profile_photo':
      return Boolean((p.profile_picture_url ?? '').trim())
    case 'display_name':
      return Boolean((p.name ?? '').trim())
    case 'username':
      return Boolean((p.username ?? '').trim())
    case 'instagram':
      return Boolean((p.instagram_handle ?? '').trim())
    case 'snapchat':
      return Boolean((p.snapchat_handle ?? '').trim())
    case 'country':
      return Boolean((p.country_code ?? '').trim())
    case 'gender':
      return Boolean(normalizeGenderFacet(p.gender))
    case 'age':
      return p.age != null
    case 'role':
      return Boolean((p.role ?? '').trim())
    default:
      return false
  }
}

function matchesPresence(filter: ProfilePresenceChoice, has: boolean): boolean {
  if (filter === '') return true
  if (filter === 'present') return has
  return !has
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  developer: 'Developer',
  promoter: 'Promoter',
  tester: 'Tester',
  demo: 'Demo',
  user: 'User',
}

function roleBadgeClassName(role: string) {
  if (role === 'admin') {
    return 'border-amber-400/80 bg-gradient-to-b from-amber-100 to-amber-200/90 text-amber-950 shadow-sm'
  }
  if (role === 'promoter') {
    return 'border-blue-400/70 bg-blue-100 text-blue-900'
  }
  return ''
}

/** Extra protection on export / delete / restore when `PROFILES_BACKUP_PASSCODE` is server-set. */
function buildBackupProtectedInit(body: unknown, secret: string | null | undefined): RequestInit {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  const s = typeof secret === 'string' ? secret.trim() : ''
  if (s.length > 0) {
    headers.set(PROFILES_BACKUP_PASSCODE_HEADER, s)
  }
  return {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }
}

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ProfilesCleanupPanel() {
  const { toast } = useToast()
  const [profiles, setProfiles] = useState<CleanupProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [demoOnlyList, setDemoOnlyList] = useState(false)
  const [search, setSearch] = useState('')
  const [filterRoles, setFilterRoles] = useState<Set<string>>(() => new Set())
  const [filterCountries, setFilterCountries] = useState<Set<string>>(() => new Set())
  const [filterGenders, setFilterGenders] = useState<Set<string>>(() => new Set())
  const [ageMinInput, setAgeMinInput] = useState('')
  const [ageMaxInput, setAgeMaxInput] = useState('')
  const [connMinInput, setConnMinInput] = useState('')
  const [connMaxInput, setConnMaxInput] = useState('')
  const [presenceFilters, setPresenceFilters] = useState<
    Record<ProfilePresenceFieldKey, ProfilePresenceChoice>
  >(() => ({ ...INITIAL_PROFILE_PRESENCE_FILTERS }))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [exportDeleteOpen, setExportDeleteOpen] = useState(false)
  const [allowDeleteStaff, setAllowDeleteStaff] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [backupPanelOpen, setBackupPanelOpen] = useState(false)
  const backupSecretRef = useRef<string | null>(null)
  const otpInputRef = useRef<React.ElementRef<typeof InputOTP>>(null)
  const passcodeFallbackInputRef = useRef<HTMLInputElement>(null)
  const [backupPasscodeRequired, setBackupPasscodeRequired] = useState(false)
  const [backupPasscodeSlotCount, setBackupPasscodeSlotCount] = useState<number | null>(null)
  const [passcodeDialogOpen, setPasscodeDialogOpen] = useState(false)
  const [passcodeDraft, setPasscodeDraft] = useState('')
  const [passcodeSubmitting, setPasscodeSubmitting] = useState(false)
  const [passcodeInvalid, setPasscodeInvalid] = useState(false)
  const [filtersPanelExpanded, setFiltersPanelExpanded] = useState(false)

  const invalidateBackupSession = useCallback(() => {
    backupSecretRef.current = null
    setBackupPanelOpen(false)
    setSelected(new Set())
    setDemoOnlyList(false)
    setConfirmOpen(false)
    setExportDeleteOpen(false)
    setAllowDeleteStaff(false)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = demoOnlyList ? '?demo_only=true' : ''
      const res = await fetch(`/api/profiles-cleanup/list${q}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load profiles')
      }
      setProfiles(data.profiles || [])
      setBackupPasscodeRequired(Boolean(data.backup_passcode_configured))
      const plen =
        typeof data.backup_passcode_length === 'number' &&
        Number.isFinite(data.backup_passcode_length)
          ? data.backup_passcode_length
          : null
      setBackupPasscodeSlotCount(plen !== null && plen > 0 ? plen : null)
      setSelected(new Set())
    } catch (e) {
      toast({
        title: 'Could not load profiles',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast, demoOnlyList])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (passcodeDialogOpen) {
      setPasscodeDraft('')
      setPasscodeInvalid(false)
      const id = window.setTimeout(() => {
        if (backupPasscodeSlotCount !== null && backupPasscodeSlotCount > 0) {
          otpInputRef.current?.focus()
        } else {
          passcodeFallbackInputRef.current?.focus()
        }
      }, 50)
      return () => window.clearTimeout(id)
    }
  }, [passcodeDialogOpen, backupPasscodeSlotCount])

  const otpIndexGroups = useMemo(() => {
    if (!backupPasscodeSlotCount || backupPasscodeSlotCount <= 0) return []
    const groups: number[][] = []
    for (let i = 0; i < backupPasscodeSlotCount; i += 2) {
      groups.push(
        i + 1 < backupPasscodeSlotCount ? [i, i + 1] : [i]
      )
    }
    return groups
  }, [backupPasscodeSlotCount])

  const roleFacetKeys = useMemo(() => {
    const s = new Set<string>()
    for (const p of profiles) {
      s.add(p.role ? p.role : FILTER_NO_ROLE)
    }
    const order = (a: string, b: string) => {
      const la =
        (a !== FILTER_NO_ROLE ? ROLE_LABELS[a] ?? a : '(No role)').toLowerCase()
      const lb =
        (b !== FILTER_NO_ROLE ? ROLE_LABELS[b] ?? b : '(No role)').toLowerCase()
      return la.localeCompare(lb)
    }
    return [...s].sort(order)
  }, [profiles])

  const countryFacetKeys = useMemo(() => {
    const s = new Set<string>()
    for (const p of profiles) {
      const r = (p.country_code ?? '').trim()
      s.add(r ? r.toUpperCase() : FILTER_NO_COUNTRY)
    }
    const order = (a: string, b: string) => {
      if (a === FILTER_NO_COUNTRY) return -1
      if (b === FILTER_NO_COUNTRY) return 1
      return getRegionDisplayName(a).localeCompare(getRegionDisplayName(b))
    }
    return [...s].sort(order)
  }, [profiles])

  const genderFacetKeys = useMemo(() => {
    const s = new Set<string>()
    for (const p of profiles) {
      const norm = normalizeGenderFacet(p.gender)
      s.add(norm ? norm : FILTER_NO_GENDER)
    }
    const order = (a: string, b: string) => {
      const la =
        a === FILTER_NO_GENDER ? '' : facetLabelForGenderKey(a).toLowerCase()
      const lb =
        b === FILTER_NO_GENDER ? '' : facetLabelForGenderKey(b).toLowerCase()
      return la.localeCompare(lb)
    }
    return [...s].sort(order)
  }, [profiles])

  const presenceFilterActiveCount = useMemo(() => {
    let n = 0
    for (const row of PROFILE_PRESENCE_ROWS) {
      if (presenceFilters[row.field]) n += 1
    }
    return n
  }, [presenceFilters])

  const hasStructuredFilters =
    filterRoles.size > 0 ||
    filterCountries.size > 0 ||
    filterGenders.size > 0 ||
    ageMinInput.trim() !== '' ||
    ageMaxInput.trim() !== '' ||
    connMinInput.trim() !== '' ||
    connMaxInput.trim() !== '' ||
    presenceFilterActiveCount > 0

  const structuredFilterActiveLabel = [
    filterRoles.size > 0 && `${filterRoles.size} role${filterRoles.size === 1 ? '' : 's'}`,
    filterCountries.size > 0 &&
      `${filterCountries.size} countr${filterCountries.size === 1 ? 'y' : 'ies'}`,
    filterGenders.size > 0 && `${filterGenders.size} gender${filterGenders.size === 1 ? '' : 's'}`,
    (ageMinInput.trim() !== '' || ageMaxInput.trim() !== '') && 'age range',
    (connMinInput.trim() !== '' || connMaxInput.trim() !== '') && 'connections',
    presenceFilterActiveCount > 0 &&
      `${presenceFilterActiveCount} data field rule${presenceFilterActiveCount === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const filtered = useMemo(() => {
    let amin = parseOptionalInt(ageMinInput)
    let amax = parseOptionalInt(ageMaxInput)
    let cmin = parseOptionalInt(connMinInput)
    let cmax = parseOptionalInt(connMaxInput)

    if (amin !== undefined && amax !== undefined && amin > amax) {
      const t = amin
      amin = amax
      amax = t
    }
    if (cmin !== undefined && cmax !== undefined && cmin > cmax) {
      const t = cmin
      cmin = cmax
      cmax = t
    }

    const q = search.trim().toLowerCase()

    return profiles.filter((p) => {
      if (filterRoles.size > 0) {
        const rk = p.role ? p.role : FILTER_NO_ROLE
        if (!filterRoles.has(rk)) return false
      }

      if (filterCountries.size > 0) {
        const r = (p.country_code ?? '').trim()
        const key = r ? r.toUpperCase() : FILTER_NO_COUNTRY
        if (!filterCountries.has(key)) return false
      }

      if (filterGenders.size > 0) {
        const ng = normalizeGenderFacet(p.gender)
        const gk = ng ? ng : FILTER_NO_GENDER
        if (!filterGenders.has(gk)) return false
      }

      if (amin !== undefined || amax !== undefined) {
        if (p.age == null) return false
        if (amin !== undefined && p.age < amin) return false
        if (amax !== undefined && p.age > amax) return false
      }

      if (cmin !== undefined || cmax !== undefined) {
        if (p.connection_count == null) return false
        if (cmin !== undefined && p.connection_count < cmin) return false
        if (cmax !== undefined && p.connection_count > cmax) return false
      }

      for (const { field } of PROFILE_PRESENCE_ROWS) {
        const mode = presenceFilters[field]
        if (!matchesPresence(mode, profileHasColumnPresent(field, p))) return false
      }

      if (!q) return true

      const cc = p.country_code?.trim()
      const countrySearch =
        cc && /^[A-Za-z]{2}$/.test(cc)
          ? getRegionDisplayName(cc.toUpperCase()).toLowerCase()
          : ''

      const hay = [
        p.user_id,
        p.name ?? '',
        p.username ?? '',
        p.role ?? '',
        p.country_code ?? '',
        countrySearch,
        p.gender ?? '',
        p.age != null ? String(p.age) : '',
        p.connection_count != null ? String(p.connection_count) : '',
        p.instagram_handle ?? '',
        p.snapchat_handle ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return hay.includes(q)
    })
  }, [
    profiles,
    search,
    filterRoles,
    filterCountries,
    filterGenders,
    ageMinInput,
    ageMaxInput,
    connMinInput,
    connMaxInput,
    presenceFilters,
  ])

  const clearStructuredFilters = useCallback(() => {
    setFilterRoles(new Set())
    setFilterCountries(new Set())
    setFilterGenders(new Set())
    setAgeMinInput('')
    setAgeMaxInput('')
    setConnMinInput('')
    setConnMaxInput('')
    setPresenceFilters({ ...INITIAL_PROFILE_PRESENCE_FILTERS })
  }, [])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.user_id))

  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const p of filtered) next.delete(p.user_id)
      } else {
        for (const p of filtered) next.add(p.user_id)
      }
      return next
    })
  }

  const revealBackupChrome = () => setBackupPanelOpen(true)

  const submitBackupPasscode = async (e?: React.FormEvent, valueOverride?: string) => {
    e?.preventDefault()
    const raw = valueOverride ?? passcodeDraft
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    if (!trimmed) {
      setPasscodeInvalid(true)
      toast({ title: 'Enter passcode', variant: 'destructive' })
      return
    }
    setPasscodeSubmitting(true)
    setPasscodeInvalid(false)
    try {
      const res = await fetch('/api/profiles-cleanup/backup-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed')
      }
      backupSecretRef.current = trimmed
      setPasscodeDialogOpen(false)
      setPasscodeInvalid(false)
      revealBackupChrome()
      toast({
        title: 'Backup tools unlocked',
        description: data.required ? 'Secret applied for this browser session.' : undefined,
      })
    } catch (err) {
      setPasscodeInvalid(true)
      toast({
        title: 'Could not unlock',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setPasscodeSubmitting(false)
    }
  }

  const handleArchiveToolbarClick = () => {
    if (backupPanelOpen) {
      setBackupPanelOpen(false)
      setSelected(new Set())
      setDemoOnlyList(false)
      setConfirmOpen(false)
      setExportDeleteOpen(false)
      setAllowDeleteStaff(false)
      return
    }

    if (!backupPasscodeRequired) {
      revealBackupChrome()
      return
    }

    if (backupSecretRef.current?.trim()) {
      revealBackupChrome()
      return
    }

    setPasscodeDialogOpen(true)
  }

  const runDelete = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setDeleting(true)
    try {
      const res = await fetch(
        '/api/profiles-cleanup/delete',
        buildBackupProtectedInit({ user_ids: ids, allow_staff: allowDeleteStaff }, backupSecretRef.current)
      )
      const data = await res.json()
      if (res.status === 401 && backupPasscodeRequired) {
        invalidateBackupSession()
        throw new Error(data.error || 'Backup passcode required or expired. Unlock again.')
      }
      if (!res.ok) {
        throw new Error(data.error || 'Delete failed')
      }
      const deleted: string[] = data.deleted || []
      const failed: { user_id: string; error: string }[] = data.failed || []
      const skipped: { user_id: string; reason: string }[] = data.skipped || []

      setSelected(new Set())
      await load()

      const parts = [
        deleted.length ? `Removed ${deleted.length}` : null,
        failed.length ? `${failed.length} failed` : null,
        skipped.length ? `${skipped.length} skipped` : null,
      ].filter(Boolean)

      toast({
        title: 'Delete finished',
        description: parts.join(' · ') || 'Nothing changed',
        variant: failed.length ? 'destructive' : 'default',
      })
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
      setAllowDeleteStaff(false)
    }
  }

  const runExportSelected = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setExporting(true)
    try {
      const res = await fetch(
        '/api/profiles-cleanup/demo-export',
        buildBackupProtectedInit({ user_ids: ids }, backupSecretRef.current)
      )
      const data = await res.json()
      if (res.status === 401 && backupPasscodeRequired) {
        invalidateBackupSession()
        throw new Error(data.error || 'Backup passcode required or expired. Unlock again.')
      }
      if (!res.ok) {
        throw new Error(data.error || 'Export failed')
      }
      const stamp = new Date().toISOString().slice(0, 10)
      downloadJson(`demo-users-backup-${stamp}.json`, data.backup)
      toast({
        title: 'Backup downloaded',
        description: `${data.backup?.users?.length ?? 0} user(s) in file`,
      })
    } catch (e) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  const runExportAllDemo = async () => {
    setExporting(true)
    try {
      const res = await fetch(
        '/api/profiles-cleanup/demo-export',
        buildBackupProtectedInit({ all_demo: true }, backupSecretRef.current)
      )
      const data = await res.json()
      if (res.status === 401 && backupPasscodeRequired) {
        invalidateBackupSession()
        throw new Error(data.error || 'Backup passcode required or expired. Unlock again.')
      }
      if (!res.ok) {
        throw new Error(data.error || 'Export failed')
      }
      const stamp = new Date().toISOString().slice(0, 10)
      downloadJson(`demo-users-backup-all-${stamp}.json`, data.backup)
      toast({
        title: 'Backup downloaded',
        description: `${data.backup?.users?.length ?? 0} demo user(s) in file`,
      })
    } catch (e) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  const runExportAndDelete = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setDeleting(true)
    try {
      const ex = await fetch(
        '/api/profiles-cleanup/demo-export',
        buildBackupProtectedInit({ user_ids: ids }, backupSecretRef.current)
      )
      const exData = await ex.json()
      if (ex.status === 401 && backupPasscodeRequired) {
        invalidateBackupSession()
        throw new Error(exData.error || 'Backup passcode required or expired.')
      }
      if (!ex.ok) {
        throw new Error(exData.error || 'Export failed — nothing deleted')
      }
      const stamp = new Date().toISOString().slice(0, 10)
      downloadJson(`demo-users-backup-${stamp}.json`, exData.backup)

      const del = await fetch(
        '/api/profiles-cleanup/delete',
        buildBackupProtectedInit({ user_ids: ids, allow_staff: allowDeleteStaff }, backupSecretRef.current)
      )
      const delData = await del.json()
      if (del.status === 401 && backupPasscodeRequired) {
        invalidateBackupSession()
        throw new Error(delData.error || 'Backup passcode required or expired.')
      }
      if (!del.ok) {
        throw new Error(delData.error || 'Delete failed (backup file was still downloaded)')
      }
      const deleted: string[] = delData.deleted || []
      const failed: { user_id: string; error: string }[] = delData.failed || []
      const skipped: { user_id: string; reason: string }[] = delData.skipped || []

      setSelected(new Set())
      await load()

      toast({
        title: 'Exported and deleted',
        description: [
          `Saved ${exData.backup?.users?.length ?? 0} user(s) to file`,
          deleted.length ? `Removed ${deleted.length}` : null,
          failed.length ? `${failed.length} failed` : null,
          skipped.length ? `${skipped.length} skipped` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        variant: failed.length ? 'destructive' : 'default',
      })
    } catch (e) {
      toast({
        title: 'Export & delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setExportDeleteOpen(false)
      setAllowDeleteStaff(false)
    }
  }

  const onRestoreFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setRestoring(true)
    try {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('Invalid JSON file')
      }
      const res = await fetch(
        '/api/profiles-cleanup/demo-restore',
        buildBackupProtectedInit({ backup: parsed }, backupSecretRef.current)
      )
      const data = await res.json()
      if (res.status === 401 && backupPasscodeRequired) {
        invalidateBackupSession()
        throw new Error(data.error || 'Backup passcode required or expired. Unlock again.')
      }
      if (!res.ok) {
        throw new Error(data.error || 'Restore failed')
      }
      const restored = data.restored || []
      const failed = data.failed || []
      await load()
      toast({
        title: 'Restore finished',
        description: [
          restored.length ? `Recreated ${restored.length} user(s)` : null,
          failed.length ? `${failed.length} failed (see console)` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        variant: failed.length ? 'destructive' : 'default',
      })
      if (failed.length) {
        console.warn('Demo restore failures:', failed)
      }
    } catch (e) {
      toast({
        title: 'Restore failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setRestoring(false)
    }
  }

  return (
    <>
      <Dialog
        open={passcodeDialogOpen}
        onOpenChange={(open) => {
          if (!open && passcodeSubmitting) return
          setPasscodeDialogOpen(open)
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(evt) =>
            passcodeSubmitting ? evt.preventDefault() : undefined
          }
          onEscapeKeyDown={(evt) =>
            passcodeSubmitting ? evt.preventDefault() : undefined
          }
        >
          <form onSubmit={submitBackupPasscode}>
            <DialogHeader className="sm:text-center">
              <DialogTitle>Unlock backup & restore</DialogTitle>
              <DialogDescription className="text-center text-gray-600">
                Enter the backup passcode from the{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">PROFILES_BACKUP_PASSCODE</code>{' '}
                server variable.
              </DialogDescription>
            </DialogHeader>
            <div className="grid justify-items-center gap-4 py-8">
              <Label
                htmlFor="profiles-backup-passcode"
                className="block w-full text-center"
              >
                Passcode
              </Label>
              {backupPasscodeSlotCount !== null && backupPasscodeSlotCount > 0 ? (
                <InputOTP
                  key={`otp-${backupPasscodeSlotCount}`}
                  ref={otpInputRef}
                  id="profiles-backup-passcode"
                  maxLength={backupPasscodeSlotCount}
                  inputMode="text"
                  autoComplete="off"
                  value={passcodeDraft}
                  onChange={(v) => {
                    setPasscodeInvalid(false)
                    setPasscodeDraft(v)
                  }}
                  onComplete={(full) => void submitBackupPasscode(undefined, full)}
                  disabled={passcodeSubmitting}
                  containerClassName={cn(
                    'flex flex-wrap justify-center gap-2',
                    backupPasscodeSlotCount > 16 && 'gap-1.5'
                  )}
                >
                  {otpIndexGroups.map((group, gi) => (
                    <Fragment key={gi}>
                      {gi > 0 ? <InputOTPSeparator /> : null}
                      <InputOTPGroup>
                        {group.map((slotIndex) => (
                          <InputOTPSlot
                            key={slotIndex}
                            index={slotIndex}
                            aria-invalid={passcodeInvalid || undefined}
                            className={cn(
                              backupPasscodeSlotCount > 16 && 'h-8 w-7 text-xs shadow-sm'
                            )}
                          />
                        ))}
                      </InputOTPGroup>
                    </Fragment>
                  ))}
                </InputOTP>
              ) : (
                <Input
                  id="profiles-backup-passcode"
                  ref={passcodeFallbackInputRef}
                  type="password"
                  autoComplete="off"
                  value={passcodeDraft}
                  onChange={(evt) => setPasscodeDraft(evt.target.value)}
                  disabled={passcodeSubmitting}
                  className="h-10 w-full max-w-xs"
                />
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={passcodeSubmitting}
                onClick={() => setPasscodeDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={passcodeSubmitting}>
                {passcodeSubmitting ? 'Checking…' : 'Unlock'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {backupPanelOpen && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-3 sm:px-5 sm:py-4 mb-6 space-y-3">
        <div className="font-medium text-gray-900">Demo users — backup & restore</div>
        <p className="text-sm text-gray-600">
          Export includes email, the current <code className="text-xs bg-white px-1 rounded border">user_roles</code>{' '}
          value (any role when you export selected rows; &quot;all demo&quot; is always{' '}
          <code className="text-xs bg-white px-1 rounded border">demo</code>), and the full{' '}
          <code className="text-xs bg-white px-1 rounded border">profiles</code> row (storage bucket files
          are not touched). Restore creates new auth accounts (new user ids) with the same emails, roles,
          and profile fields. Passwords are randomized on restore — use password reset if needed.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 bg-white"
            disabled={exporting || selected.size === 0}
            onClick={() => runExportSelected()}
          >
            <Download className="h-4 w-4 mr-1.5" />
            {exporting ? 'Working…' : 'Download backup (selected)'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 bg-white"
            disabled={exporting}
            onClick={() => runExportAllDemo()}
          >
            <Download className="h-4 w-4 mr-1.5" />
            {exporting ? 'Working…' : 'Download all demo users'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-red-200 text-red-800 hover:bg-red-50 bg-white"
            disabled={selected.size === 0 || deleting || loading}
            onClick={() => setExportDeleteOpen(true)}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download backup & delete selected…
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 bg-white"
            disabled={restoring}
            onClick={() => restoreInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            {restoring ? 'Restoring…' : 'Restore from JSON…'}
          </Button>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onRestoreFile}
          />
        </div>
        <p className="text-xs text-gray-500">
          &quot;Download all demo users&quot; uses role <strong>demo</strong> in{' '}
          <code className="bg-white px-0.5 rounded border">user_roles</code> (includes accounts with no
          profile row). The table below only lists rows in{' '}
          <code className="bg-white px-0.5 rounded border">profiles</code>; use &quot;Download all demo
          users&quot; if you need demo accounts that have no profile row yet.
        </p>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
              <Input
                placeholder="Search id, names, handles, country, gender, age…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md min-w-[10rem] h-9 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 px-2.5 shrink-0 bg-white border-gray-200"
                aria-expanded={filtersPanelExpanded}
                aria-controls="profiles-structured-filters"
                title="Structured filters are combined as AND."
                onClick={() => setFiltersPanelExpanded((o) => !o)}
              >
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-gray-500 transition-transform shrink-0',
                    filtersPanelExpanded && 'rotate-180'
                  )}
                  aria-hidden
                />
                <ListFilter className="h-3.5 w-3.5" aria-hidden />
                <span>Filters</span>
                {!filtersPanelExpanded && hasStructuredFilters ? (
                  <Badge
                    variant="secondary"
                    className="h-5 px-1.5 ml-0.5 tabular-nums font-normal"
                  >
                    On
                  </Badge>
                ) : null}
              </Button>
              <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap shrink-0">
                {profiles.length === 0 ? (
                  '0 profiles'
                ) : filtered.length === profiles.length ? (
                  `${profiles.length} shown`
                ) : (
                  <>
                    <span className="font-medium text-gray-700">{filtered.length}</span> of{' '}
                    {profiles.length}
                  </>
                )}
              </span>
              {hasStructuredFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-gray-600 hover:text-gray-900 shrink-0"
                  onClick={clearStructuredFilters}
                  title={`Active: ${structuredFilterActiveLabel}`}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
            {backupPanelOpen && (
              <>
                <label className="flex items-center gap-2 text-xs text-gray-600 shrink-0 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={demoOnlyList}
                    onChange={(e) => setDemoOnlyList(e.target.checked)}
                  />
                  Demo role only
                </label>
                <span className="text-xs text-gray-500 shrink-0">
                  {filtered.length === profiles.length
                    ? `${profiles.length} profiles`
                    : `${filtered.length} of ${profiles.length}`}
                  {selected.size > 0 ? ` · ${selected.size} selected` : ''}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant={backupPanelOpen ? 'secondary' : 'ghost'}
              size="icon"
              className={`h-9 w-9 shrink-0 ${backupPanelOpen ? '' : 'text-gray-600'}`}
              onClick={handleArchiveToolbarClick}
              title={backupPanelOpen ? 'Hide backup & restore' : 'Show backup & restore'}
              aria-expanded={backupPanelOpen}
              aria-label={
                backupPanelOpen
                  ? 'Hide backup and restore panel'
                  : 'Show backup and restore panel'
              }
            >
              <ArchiveRestore className="h-4 w-4" />
            </Button>
            {backupPanelOpen && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9"
                disabled={loading || filtered.length === 0}
                onClick={() => toggleAllFiltered()}
                title="Select or clear all visible rows"
              >
                {allFilteredSelected ? 'Clear visible' : 'Select all visible'}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => load()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {backupPanelOpen && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-9"
                disabled={selected.size === 0 || deleting || loading}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete selected
              </Button>
            )}
          </div>
        </div>

        {filtersPanelExpanded ? (
          <div
            id="profiles-structured-filters"
            className="border-b border-gray-200 px-4 sm:px-6 py-3 bg-gray-50/70"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex items-center gap-1 text-xs font-medium text-gray-600 uppercase tracking-wide shrink-0 w-full mb-1 sm:w-auto sm:mb-0">
              <span className="hidden sm:inline normal-case font-normal text-gray-500 mr-1">
                Combine as AND —
              </span>
              Criteria
            </span>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 gap-1.5 px-2.5 bg-white border-gray-200',
                    filterRoles.size > 0 && 'border-indigo-300 bg-indigo-50/50'
                  )}
                >
                  Roles
                  {filterRoles.size > 0 ? (
                    <Badge variant="secondary" className="h-5 px-1 tabular-nums">
                      {filterRoles.size}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-normal ml-0.5">
                      Any
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="max-h-[min(320px,70vh)] w-72 overflow-y-auto overscroll-contain py-3"
              >
                <p className="text-xs font-medium text-gray-500 px-3 pb-2">Show users whose role is one of:</p>
                <div className="space-y-0.5">
                  {roleFacetKeys.map((rk) => (
                    <label
                      key={rk}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-gray-300"
                        checked={filterRoles.has(rk)}
                        onChange={() => {
                          setFilterRoles((prev) => {
                            const n = new Set(prev)
                            if (n.has(rk)) n.delete(rk)
                            else n.add(rk)
                            return n
                          })
                        }}
                      />
                      <span className="text-gray-900">
                        {rk === FILTER_NO_ROLE
                          ? '(No role)'
                          : ROLE_LABELS[rk] ?? rk}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 border-t border-gray-100 px-3 pt-2 flex justify-between">
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setFilterRoles(new Set(roleFacetKeys))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setFilterRoles(new Set())}
                  >
                    Clear
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 gap-1.5 px-2.5 bg-white border-gray-200',
                    filterCountries.size > 0 && 'border-indigo-300 bg-indigo-50/50'
                  )}
                >
                  Countries
                  {filterCountries.size > 0 ? (
                    <Badge variant="secondary" className="h-5 px-1 tabular-nums">
                      {filterCountries.size}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-normal ml-0.5">
                      Any
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="max-h-[min(320px,70vh)] w-72 overflow-y-auto overscroll-contain py-3"
              >
                <p className="text-xs font-medium text-gray-500 px-3 pb-2">
                  Match any of these regions:
                </p>
                <div className="space-y-0.5">
                  {countryFacetKeys.map((ck) => {
                    const isoRow = ck !== FILTER_NO_COUNTRY && /^[A-Z]{2}$/.test(ck)
                    const flag = isoRow ? isoAlpha2ToFlagEmoji(ck) : null
                    return (
                    <label
                      key={ck}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0 rounded border-gray-300"
                        checked={filterCountries.has(ck)}
                        onChange={() => {
                          setFilterCountries((prev) => {
                            const n = new Set(prev)
                            if (n.has(ck)) n.delete(ck)
                            else n.add(ck)
                            return n
                          })
                        }}
                      />
                      <span className="min-w-0 text-gray-900">
                        {ck === FILTER_NO_COUNTRY ? (
                          '(No country)'
                        ) : isoRow ? (
                          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            {flag !== null ? (
                              <span className="leading-none">{flag}</span>
                            ) : null}
                            <span className="truncate">
                              {getRegionDisplayName(ck)}
                              <span className="text-xs text-gray-500 tabular-nums">
                                {' '}
                                ({ck})
                              </span>
                            </span>
                          </span>
                        ) : (
                          ck
                        )}
                      </span>
                    </label>
                    )
                  })}
                </div>
                <div className="mt-2 border-t border-gray-100 px-3 pt-2 flex justify-between">
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setFilterCountries(new Set(countryFacetKeys))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setFilterCountries(new Set())}
                  >
                    Clear
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 gap-1.5 px-2.5 bg-white border-gray-200',
                    filterGenders.size > 0 && 'border-indigo-300 bg-indigo-50/50'
                  )}
                >
                  Gender
                  {filterGenders.size > 0 ? (
                    <Badge variant="secondary" className="h-5 px-1 tabular-nums">
                      {filterGenders.size}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-normal ml-0.5">
                      Any
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="max-h-[min(320px,70vh)] w-72 overflow-y-auto overscroll-contain py-3"
              >
                <p className="text-xs font-medium text-gray-500 px-3 pb-2">
                  Match any of these values:
                </p>
                <div className="space-y-0.5">
                  {genderFacetKeys.map((gk) => (
                    <label
                      key={gk}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-gray-300"
                        checked={filterGenders.has(gk)}
                        onChange={() => {
                          setFilterGenders((prev) => {
                            const n = new Set(prev)
                            if (n.has(gk)) n.delete(gk)
                            else n.add(gk)
                            return n
                          })
                        }}
                      />
                      <span className="text-gray-900 capitalize">
                        {facetLabelForGenderKey(gk)}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 border-t border-gray-100 px-3 pt-2 flex justify-between">
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setFilterGenders(new Set(genderFacetKeys))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setFilterGenders(new Set())}
                  >
                    Clear
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 gap-1.5 px-2.5 bg-white border-gray-200',
                    presenceFilterActiveCount > 0 && 'border-indigo-300 bg-indigo-50/50'
                  )}
                >
                  Data fields
                  {presenceFilterActiveCount > 0 ? (
                    <Badge variant="secondary" className="h-5 px-1 tabular-nums">
                      {presenceFilterActiveCount}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-normal ml-0.5">
                      Any
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="max-h-[min(360px,75vh)] w-[min(calc(100vw-2rem),20rem)] overflow-y-auto overscroll-contain p-3"
              >
                <p className="text-xs font-medium text-gray-500 px-0.5 pb-2">
                  Require rows to have a value (or explicitly be empty). Combined as AND with role,
                  country, gender, ranges, and search.
                </p>
                <div className="space-y-2">
                  {PROFILE_PRESENCE_ROWS.map(({ field, label }) => (
                    <div
                      key={field}
                      className="flex items-center gap-2 min-w-0"
                    >
                      <Label
                        htmlFor={`presence-${field}`}
                        className="text-xs text-gray-700 w-[7.75rem] shrink-0 truncate"
                        title={label}
                      >
                        {label}
                      </Label>
                      <select
                        id={`presence-${field}`}
                        value={presenceFilters[field]}
                        onChange={(ev) =>
                          setPresenceFilters((prev) => ({
                            ...prev,
                            [field]: ev.target.value as ProfilePresenceChoice,
                          }))
                        }
                        className={cn(
                          'h-8 flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2'
                        )}
                      >
                        <option value="">Any</option>
                        <option value="present">Has value</option>
                        <option value="absent">Empty</option>
                      </select>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() =>
                      setPresenceFilters({ ...INITIAL_PROFILE_PRESENCE_FILTERS })
                    }
                  >
                    Reset data-field rules
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex flex-wrap items-center gap-1.5 text-xs shrink-0">
              <span className="text-gray-500 whitespace-nowrap">Age</span>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Min"
                value={ageMinInput}
                onChange={(e) => setAgeMinInput(e.target.value)}
                className="h-8 w-16 px-2 text-xs bg-white"
                min={0}
              />
              <span className="text-gray-400">–</span>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Max"
                value={ageMaxInput}
                onChange={(e) => setAgeMaxInput(e.target.value)}
                className="h-8 w-16 px-2 text-xs bg-white"
                min={0}
              />
              <span className="mx-2 h-6 w-px bg-gray-200 hidden sm:inline" aria-hidden />
              <span className="text-gray-500 whitespace-nowrap">Connections</span>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Min"
                value={connMinInput}
                onChange={(e) => setConnMinInput(e.target.value)}
                className="h-8 w-16 px-2 text-xs bg-white"
                min={0}
              />
              <span className="text-gray-400">–</span>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Max"
                value={connMaxInput}
                onChange={(e) => setConnMaxInput(e.target.value)}
                className="h-8 w-16 px-2 text-xs bg-white"
                min={0}
              />
            </div>

              </div>
            </div>
        ) : null}

        <div className="max-h-[70vh] overflow-auto">
          {loading && profiles.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500 text-center">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-sm text-gray-500 text-center space-y-1">
              <p>No profiles match your filters{search.trim() ? ' or search terms' : ''}.</p>
              {profiles.length > 0 && (
                <p className="text-xs">
                  {[hasStructuredFilters && 'Structured filters narrow the loaded list.', search.trim()]
                    .filter(Boolean)
                    .join(' ')}{' '}
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      setSearch('')
                      clearStructuredFilters()
                    }}
                  >
                    Clear filters & search
                  </button>
                  .
                </p>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr>
                  {backupPanelOpen && (
                    <th className="w-10 px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={allFilteredSelected}
                        onChange={toggleAllFiltered}
                        aria-label="Select all visible"
                      />
                    </th>
                  )}
                  <th className="px-3 py-2 text-left font-medium text-gray-700">User</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 hidden lg:table-cell">
                    Username
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 hidden md:table-cell">
                    Country
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 hidden md:table-cell w-14">
                    Age
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 hidden md:table-cell">
                    Gender
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 hidden xl:table-cell">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => (
                  <tr key={p.user_id} className="hover:bg-gray-50/80">
                    {backupPanelOpen && (
                      <td className="px-3 py-2 align-middle">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selected.has(p.user_id)}
                          onChange={() => toggle(p.user_id)}
                          aria-label={`Select ${p.user_id}`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={p.profile_picture_url || undefined} alt="" />
                          <AvatarFallback className="text-[10px]">
                            {(p.name || p.username || '?').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="font-medium text-gray-900 truncate">
                              {p.name || '—'}
                            </span>
                            {p.role ? (
                              <Badge
                                variant={
                                  p.role === 'admin' || p.role === 'promoter'
                                    ? 'outline'
                                    : 'secondary'
                                }
                                className={cn(
                                  'shrink-0 text-[10px] font-normal px-1.5 py-0 h-5',
                                  roleBadgeClassName(p.role)
                                )}
                              >
                                {ROLE_LABELS[p.role] ?? p.role}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="shrink-0 text-[10px] font-normal text-gray-500 px-1.5 py-0 h-5"
                              >
                                No role
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 font-mono truncate">
                            {p.user_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle text-gray-700 hidden lg:table-cell">
                      {p.username || '—'}
                    </td>
                    <td className="px-3 py-2 align-middle text-gray-600 hidden md:table-cell">
                      <ProfileCountryDisplay code={p.country_code} />
                    </td>
                    <td className="px-3 py-2 align-middle text-gray-600 tabular-nums hidden md:table-cell whitespace-nowrap">
                      {p.age != null ? p.age : '—'}
                    </td>
                    <td className="px-3 py-2 align-middle text-gray-600 hidden md:table-cell">
                      <span className="capitalize">
                        {p.gender?.trim() || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-middle text-gray-600 text-xs hidden xl:table-cell whitespace-nowrap">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) setAllowDeleteStaff(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} user(s)?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-gray-600 space-y-3">
                <p>
                  For each user, admin/developer role rows (if any) are set to <strong>user</strong>{' '}
                  first, then the profile, all role rows, and the Supabase Auth user are removed.
                  Other tables that still reference this user may cause profile delete to fail for
                  some rows.
                </p>
                <p>
                  By default, accounts with <strong>admin</strong> or <strong>developer</strong> in{' '}
                  <code className="text-xs bg-gray-100 px-1 rounded">user_roles</code> are skipped so
                  you do not wipe panel access by mistake. That is why you saw &quot;skipped&quot;.
                </p>
                <p>
                  When allowed, each of those accounts is first demoted to role{' '}
                  <strong>user</strong> in <code className="text-xs bg-gray-100 px-1 rounded">user_roles</code>, then
                  the profile, roles, and auth user are removed.
                </p>
                <label className="flex items-start gap-2 cursor-pointer rounded-md border border-amber-200 bg-amber-50/80 p-3 text-amber-950">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-amber-400"
                    checked={allowDeleteStaff}
                    onChange={(e) => setAllowDeleteStaff(e.target.checked)}
                  />
                  <span>
                    Allow deleting <strong>admin</strong> / <strong>developer</strong> accounts in
                    this batch (demote to user, then delete; you still cannot delete your own
                    account).
                  </span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleting}
              onClick={(ev) => {
                ev.preventDefault()
                runDelete()
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={exportDeleteOpen}
        onOpenChange={(open) => {
          setExportDeleteOpen(open)
          if (!open) setAllowDeleteStaff(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Download backup and delete {selected.size} user(s)?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-gray-600 space-y-3">
                <p>
                  A JSON file is downloaded first, then the same delete as &quot;Delete selected&quot; runs
                  (profile rows, <code className="text-xs bg-gray-100 px-1 rounded">user_roles</code>, auth
                  user — not storage).
                </p>
                <label className="flex items-start gap-2 cursor-pointer rounded-md border border-amber-200 bg-amber-50/80 p-3 text-amber-950">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-amber-400"
                    checked={allowDeleteStaff}
                    onChange={(e) => setAllowDeleteStaff(e.target.checked)}
                  />
                  <span>
                    Allow deleting <strong>admin</strong> / <strong>developer</strong> if any slipped into
                    the selection (normally skipped).
                  </span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleting}
              onClick={(ev) => {
                ev.preventDefault()
                runExportAndDelete()
              }}
            >
              {deleting ? 'Working…' : 'Download & delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
