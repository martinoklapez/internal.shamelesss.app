'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Building2,
  CircleUser,
  Columns3,
  ExternalLink,
  LayoutList,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Unlink,
  UserRound,
  X,
} from 'lucide-react'
import { SiInstagram, SiTiktok } from 'react-icons/si'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CreatorOutreachLoading } from '@/components/creator-outreach-loading'
import { OutreachPushPanel } from '@/components/creator-outreach-push-panel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'
import type {
  ContactCrmStatus,
  CreatorContact,
  CreatorContactKind,
  CreatorPerson,
  CreatorOutreachStore,
  OutreachPlatform,
  SocialMediaProfile,
} from '@/lib/creator-outreach/types'
import {
  addCreatorContact,
  contactCrmStatusLabel,
  contactKindLabel,
  createCreator,
  getContactsForCreator,
  hasOutreachBeenSentToEmail,
  linkProfileToCreator,
  normalizeEmail,
  platformLabel,
  removeCreatorContact,
  scoutProfile,
  unlinkProfileFromCreator,
  updateCreator,
  updateCreatorContact,
  updateProfile,
} from '@/lib/creator-outreach/store'
import { fetchCreatorOutreachStore, mutateCreatorOutreach } from '@/lib/creator-outreach/client-api'
import { inferCreatorContactKind } from '@/lib/creator-outreach/infer-contact-kind'

type PipelineFilter = 'all' | 'creators' | 'profiles' | 'contacts'

const PIPELINE_FILTERS: { id: PipelineFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'creators', label: 'Creators' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'contacts', label: 'Contacts' },
]

const CRM_STATUS_COLUMNS: ContactCrmStatus[] = ['new', 'contacted', 'reached', 'blocked']

type PipelineViewMode = 'list' | 'kanban'

function emptyCrmStatusGroups<T>(): Map<ContactCrmStatus, T[]> {
  return new Map(CRM_STATUS_COLUMNS.map((status) => [status, []]))
}

function groupByCrmStatus<T>(
  items: T[],
  getStatus: (item: T) => ContactCrmStatus
): Map<ContactCrmStatus, T[]> {
  const groups = emptyCrmStatusGroups<T>()
  for (const item of items) {
    groups.get(getStatus(item))!.push(item)
  }
  return groups
}

type ActivePanel =
  | { type: 'scout' }
  | { type: 'creator'; id: string }
  | { type: 'profile'; id: string }
  | { type: 'contact'; id: string }

function PlatformIcon({ platform, className }: { platform: OutreachPlatform; className?: string }) {
  if (platform === 'tiktok') {
    return <SiTiktok className={cn('h-3 w-3 shrink-0', className)} />
  }
  return <SiInstagram className={cn('h-3 w-3 shrink-0', className)} />
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function creatorAvatarUrl(creatorId: string): string {
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(creatorId)}`
}

function profileAvatarUrl(profileId: string): string {
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(profileId)}`
}

function CreatorAvatar({
  creator,
  className,
}: {
  creator: CreatorPerson
  className?: string
}) {
  return (
    <Avatar className={cn('h-9 w-9 shrink-0', className)}>
      <AvatarImage src={creatorAvatarUrl(creator.id)} alt={creator.displayName} />
      <AvatarFallback className="text-xs font-medium bg-violet-100 text-violet-800">
        {initialsFromName(creator.displayName)}
      </AvatarFallback>
    </Avatar>
  )
}

function ProfileAvatar({
  profile,
  className,
}: {
  profile: SocialMediaProfile
  className?: string
}) {
  return (
    <Avatar className={cn('h-6 w-6 shrink-0', className)}>
      <AvatarImage src={profileAvatarUrl(profile.id)} alt={`@${profile.handle}`} />
      <AvatarFallback
        className={cn(
          'text-[10px] font-medium',
          profile.platform === 'tiktok'
            ? 'bg-gray-900 text-white'
            : 'bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] text-white'
        )}
      >
        {profile.handle.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

function OutreachDot({ sent }: { sent: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-1.5 w-1.5 rounded-full shrink-0',
        sent ? 'bg-emerald-500' : 'bg-amber-400'
      )}
      title={sent ? 'Outreach sent' : 'Outreach pending'}
    />
  )
}

const CONTACT_CRM_STATUS_STYLES: Record<
  ContactCrmStatus,
  { chip: string; dot: string }
> = {
  new: {
    chip: 'bg-gray-100 text-gray-700 ring-gray-200/90',
    dot: 'bg-gray-400',
  },
  contacted: {
    chip: 'bg-sky-50 text-sky-800 ring-sky-200/80',
    dot: 'bg-sky-500',
  },
  reached: {
    chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  blocked: {
    chip: 'bg-red-50 text-red-800 ring-red-200/80',
    dot: 'bg-red-500',
  },
}

function ContactCrmStatusBadge({
  status,
  size = 'sm',
  className,
}: {
  status: ContactCrmStatus
  size?: 'sm' | 'md'
  className?: string
}) {
  const { chip, dot } = CONTACT_CRM_STATUS_STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md font-medium ring-1 ring-inset',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px] leading-tight' : 'px-2.5 py-1 text-xs',
        chip,
        className
      )}
    >
      <span
        className={cn('shrink-0 rounded-full', size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2', dot)}
        aria-hidden
      />
      <span className="truncate">{contactCrmStatusLabel(status)}</span>
    </span>
  )
}

function ContactKindIcon({ kind, className }: { kind: CreatorContactKind; className?: string }) {
  if (kind === 'creator') {
    return <CircleUser className={cn('h-3 w-3 shrink-0 text-violet-600', className)} />
  }
  if (kind === 'agency') {
    return <Building2 className={cn('h-3 w-3 shrink-0', className)} />
  }
  if (kind === 'manager') {
    return <UserRound className={cn('h-3 w-3 shrink-0', className)} />
  }
  return <UserRound className={cn('h-3 w-3 shrink-0 text-gray-400', className)} />
}

function TruncatedText({
  children,
  className,
  title,
}: {
  children: ReactNode
  className?: string
  title?: string
}) {
  const resolvedTitle =
    title ?? (typeof children === 'string' || typeof children === 'number' ? String(children) : undefined)
  return (
    <span className={cn('min-w-0 truncate', className)} title={resolvedTitle}>
      {children}
    </span>
  )
}

const KANBAN_CARD_CLASS = 'min-w-0 overflow-hidden'

function contactLine(c: CreatorContact, sentEmailSet: Set<string>, compact = false) {
  const sent = c.email ? sentEmailSet.has(normalizeEmail(c.email)) : null
  if (compact) {
    return (
      <div key={c.id} className="min-w-0 max-w-full space-y-0.5 text-xs text-gray-500">
        <div className="flex min-w-0 items-center gap-1">
          <ContactKindIcon kind={c.kind} className="shrink-0" />
          <TruncatedText className="text-gray-800">{c.name}</TruncatedText>
        </div>
        {c.email ? (
          <div className="flex min-w-0 items-center gap-1 pl-4">
            <TruncatedText className="font-mono text-[11px]">{c.email}</TruncatedText>
            {sent !== null ? <OutreachDot sent={sent} /> : null}
          </div>
        ) : null}
      </div>
    )
  }
  return (
    <span key={c.id} className="inline-flex items-center gap-1 text-gray-500">
      <ContactKindIcon kind={c.kind} />
      <span className="text-gray-800">{c.name}</span>
      <ContactCrmStatusBadge status={c.status} />
      {c.company && c.kind === 'agency' ? (
        <span className="text-gray-400">· {c.company}</span>
      ) : null}
      {c.email ? (
        <>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-[11px]">{c.email}</span>
          {sent !== null && <OutreachDot sent={sent} />}
        </>
      ) : null}
    </span>
  )
}

function CreatorSheetHeader({
  creator,
  editing,
  nameDraft,
  onNameDraftChange,
  onStartEdit,
  onSave,
  onCancel,
}: {
  creator: CreatorPerson
  editing: boolean
  nameDraft: string
  onNameDraftChange: (value: string) => void
  onStartEdit: () => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0 w-full">
      <CreatorAvatar creator={creator} className="h-7 w-7 shrink-0" />
      {editing ? (
        <Input
          className="h-8 flex-1 min-w-0 text-base font-semibold border-gray-200"
          value={nameDraft}
          onChange={(e) => onNameDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSave()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          autoFocus
        />
      ) : (
        <span className="inline-flex items-center gap-1 min-w-0 flex-1">
          <span className="truncate">{creator.displayName}</span>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            onClick={onStartEdit}
            title="Edit name"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
    </span>
  )
}

function profileLine(p: SocialMediaProfile, compact = false) {
  if (compact) {
    return (
      <div
        key={p.id}
        className="flex min-w-0 max-w-full items-center gap-1 text-xs text-gray-500"
      >
        <PlatformIcon platform={p.platform} className="shrink-0" />
        <TruncatedText className="text-gray-800">@{p.handle}</TruncatedText>
      </div>
    )
  }
  return (
    <span key={p.id} className="inline-flex items-center gap-1 text-gray-500">
      <PlatformIcon platform={p.platform} />
      <span className="text-gray-800">@{p.handle}</span>
    </span>
  )
}

function KanbanColumn({
  title,
  status,
  count,
  children,
  className,
}: {
  title: string
  status?: ContactCrmStatus
  count: number
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col rounded-lg border border-gray-200/80 bg-gray-50/40',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-hidden border-b border-gray-200/80 px-3 py-2.5">
        {status ? (
          <ContactCrmStatusBadge status={status} size="sm" className="min-w-0 max-w-full" />
        ) : (
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
            {title}
          </span>
        )}
        <span className="ml-auto text-xs tabular-nums text-gray-400">{count}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 max-h-[calc(100vh-16rem)]">
        <div className="space-y-2">
          {children}
          {count === 0 ? (
            <p className="py-6 text-center text-xs text-gray-400">Empty</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function PipelineKanbanBoard<T>({
  groups,
  getItemKey,
  renderCard,
  extraColumn,
}: {
  groups: Map<ContactCrmStatus, T[]>
  getItemKey: (item: T) => string
  renderCard: (item: T) => ReactNode
  extraColumn?: { title: string; items: T[] }
}) {
  return (
    <div className="flex w-full gap-3 pb-2">
      {CRM_STATUS_COLUMNS.map((status) => {
        const items = groups.get(status) ?? []
        return (
          <KanbanColumn
            key={status}
            title={contactCrmStatusLabel(status)}
            status={status}
            count={items.length}
          >
            {items.map((item) => (
              <div
                key={getItemKey(item)}
                className={cn(
                  'shrink-0 rounded-md border border-gray-100 bg-white shadow-sm',
                  KANBAN_CARD_CLASS
                )}
              >
                {renderCard(item)}
              </div>
            ))}
          </KanbanColumn>
        )
      })}
      {extraColumn && extraColumn.items.length > 0 ? (
        <KanbanColumn title={extraColumn.title} count={extraColumn.items.length}>
          {extraColumn.items.map((item) => (
            <div
              key={getItemKey(item)}
              className={cn(
                'shrink-0 rounded-md border border-gray-100 bg-white shadow-sm',
                KANBAN_CARD_CLASS
              )}
            >
              {renderCard(item)}
            </div>
          ))}
        </KanbanColumn>
      ) : null}
    </div>
  )
}

export default function CreatorOutreachManager() {
  const [store, setStore] = useState<CreatorOutreachStore | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>('all')
  const [pipelineViewMode, setPipelineViewMode] = useState<PipelineViewMode>('list')
  const [search, setSearch] = useState('')
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null)
  const [panelStack, setPanelStack] = useState<ActivePanel[]>([])
  const [linkProfileId, setLinkProfileId] = useState<string | null>(null)
  const [unlinkConfirm, setUnlinkConfirm] = useState<{
    profile: SocialMediaProfile
    creator: CreatorPerson
  } | null>(null)
  const [editingCreatorName, setEditingCreatorName] = useState(false)
  const [creatorNameDraft, setCreatorNameDraft] = useState('')

  const closePanel = useCallback(() => {
    setActivePanel(null)
    setPanelStack([])
    setEditingCreatorName(false)
  }, [])

  const openRootPanel = useCallback((panel: ActivePanel) => {
    setPanelStack([])
    setActivePanel(panel)
    setEditingCreatorName(false)
  }, [])

  const openChildPanel = useCallback(
    (panel: ActivePanel) => {
      setPanelStack((stack) => (activePanel ? [...stack, activePanel] : stack))
      setActivePanel(panel)
      setEditingCreatorName(false)
    },
    [activePanel]
  )

  const openProfilePanel = useCallback(
    (profileId: string) => {
      if (!store) return
      const profile = store.profiles.find((p) => p.id === profileId)
      if (profile?.creatorId) {
        setPanelStack([{ type: 'creator', id: profile.creatorId }])
        setActivePanel({ type: 'profile', id: profileId })
      } else {
        setPanelStack([])
        setActivePanel({ type: 'profile', id: profileId })
      }
      setEditingCreatorName(false)
    },
    [store]
  )

  const openContactPanel = useCallback((creatorId: string, contactId: string) => {
    setPanelStack([{ type: 'creator', id: creatorId }])
    setActivePanel({ type: 'contact', id: contactId })
    setEditingCreatorName(false)
  }, [])

  const panelGoBack = useCallback(() => {
    setEditingCreatorName(false)
    setPanelStack((stack) => {
      if (stack.length > 0) {
        setActivePanel(stack[stack.length - 1])
        return stack.slice(0, -1)
      }
      return stack
    })
  }, [])

  const showPanelBack =
    activePanel?.type === 'contact' ||
    (activePanel?.type === 'profile' &&
      Boolean(store?.profiles.find((p) => p.id === activePanel.id)?.creatorId)) ||
    panelStack.length > 0

  const requestUnlink = useCallback(
    (profile: SocialMediaProfile, creator: CreatorPerson) => {
      setUnlinkConfirm({ profile, creator })
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    fetchCreatorOutreachStore()
      .then((data) => {
        if (!cancelled) setStore(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load pipeline')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(async (next: CreatorOutreachStore) => {
    setSaving(true)
    try {
      const { store: saved } = await mutateCreatorOutreach({
        action: 'replaceStore',
        store: next,
      })
      setStore(saved)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to save')
      throw err
    } finally {
      setSaving(false)
    }
  }, [])

  const voidPersist = useCallback(
    (next: CreatorOutreachStore) => {
      void persist(next)
    },
    [persist]
  )

  const confirmUnlink = useCallback(async () => {
    if (!unlinkConfirm || !store) return
    const next = structuredClone(store)
    unlinkProfileFromCreator(next, unlinkConfirm.profile.id)
    await persist(next)
    setUnlinkConfirm(null)
    notifySuccess(
      `@${unlinkConfirm.profile.handle} is now unlinked from ${unlinkConfirm.creator.displayName}.`
    )
  }, [unlinkConfirm, store, persist])

  const handleOutreachResult = useCallback(
    (result?: { action: string; reason?: string }) => {
      if (!result) return
      if (result.action === 'sent') {
        notifySuccess('Outreach triggered (mock).', 'Sent')
      } else if (result.action === 'skipped') {
        notifySuccess(result.reason ?? 'Already contacted.', 'Skipped')
      }
    },
    []
  )

  const { sentEmailSet, profilesByCreatorId, contactsByCreatorId } = useMemo(() => {
    if (!store) {
      return {
        sentEmailSet: new Set<string>(),
        profilesByCreatorId: new Map<string, SocialMediaProfile[]>(),
        contactsByCreatorId: new Map<string, CreatorContact[]>(),
      }
    }
    const sent = new Set(
      store.outreachSends
        .filter((s) => s.status === 'sent')
        .map((s) => normalizeEmail(s.email))
    )
    const byCreator = new Map<string, SocialMediaProfile[]>()
    for (const p of store.profiles) {
      if (!p.creatorId) continue
      const list = byCreator.get(p.creatorId) ?? []
      list.push(p)
      byCreator.set(p.creatorId, list)
    }
    const contactsBy = new Map<string, CreatorContact[]>()
    for (const c of store.contacts) {
      const list = contactsBy.get(c.creatorId) ?? []
      list.push(c)
      contactsBy.set(c.creatorId, list)
    }
    return {
      sentEmailSet: sent,
      profilesByCreatorId: byCreator,
      contactsByCreatorId: contactsBy,
    }
  }, [store])

  const summary = useMemo(() => {
    if (!store) return ''
    const unlinked = store.profiles.filter((p) => !p.creatorId).length
    let pending = 0
    for (const c of store.contacts) {
      if (c.email && !sentEmailSet.has(normalizeEmail(c.email))) pending++
    }
    const parts = [
      `${store.creators.length} creators`,
      `${store.profiles.length} profiles`,
      `${store.contacts.length} contacts`,
    ]
    if (unlinked) parts.push(`${unlinked} unlinked`)
    if (pending) parts.push(`${pending} pending outreach`)
    return parts.join(' · ')
  }, [store, sentEmailSet])

  const filteredCreators = useMemo(() => {
    if (!store) return []
    const q = search.trim().toLowerCase()
    if (!q) return store.creators
    return store.creators.filter((c) => {
      if (
        c.displayName.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q) ||
        contactCrmStatusLabel(c.status).toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q)
      ) {
        return true
      }
      const profiles = profilesByCreatorId.get(c.id) ?? []
      if (
        profiles.some(
          (p) =>
            p.handle.toLowerCase().includes(q) ||
            p.notes.toLowerCase().includes(q)
        )
      ) {
        return true
      }
      const contacts = contactsByCreatorId.get(c.id) ?? []
      return contacts.some(
        (contact) =>
          contact.name.toLowerCase().includes(q) ||
          contact.company.toLowerCase().includes(q) ||
          contact.email.toLowerCase().includes(q) ||
          contact.notes.toLowerCase().includes(q) ||
          contact.status.toLowerCase().includes(q) ||
          contact.missiveConversationIds.some((id) => id.toLowerCase().includes(q))
      )
    })
  }, [store, search, profilesByCreatorId, contactsByCreatorId])

  const creatorsById = useMemo(() => {
    if (!store) return new Map<string, CreatorPerson>()
    return new Map(store.creators.map((c) => [c.id, c]))
  }, [store])

  const unlinkedProfiles = useMemo(() => {
    if (!store) return []
    const q = search.trim().toLowerCase()
    let list = store.profiles.filter((p) => !p.creatorId)
    if (q) {
      list = list.filter(
        (p) =>
          p.handle.toLowerCase().includes(q) ||
          p.notes.toLowerCase().includes(q)
      )
    }
    return list
  }, [store, search])

  const filteredProfiles = useMemo(() => {
    if (!store) return []
    const q = search.trim().toLowerCase()
    return store.profiles.filter((p) => {
      if (!q) return true
      if (p.handle.toLowerCase().includes(q) || p.notes.toLowerCase().includes(q)) {
        return true
      }
      const creator = p.creatorId ? creatorsById.get(p.creatorId) : null
      return creator?.displayName.toLowerCase().includes(q) ?? false
    })
  }, [store, search, creatorsById])

  const filteredContacts = useMemo(() => {
    if (!store) return []
    const q = search.trim().toLowerCase()
    return store.contacts.filter((c) => {
      if (!q) return true
      const creator = creatorsById.get(c.creatorId)
      return (
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q) ||
        contactCrmStatusLabel(c.status).toLowerCase().includes(q) ||
        c.missiveConversationIds.some((id) => id.toLowerCase().includes(q)) ||
        (creator?.displayName.toLowerCase().includes(q) ?? false)
      )
    })
  }, [store, search, creatorsById])

  const creatorsByCrmStatus = useMemo(
    () => groupByCrmStatus(filteredCreators, (c) => c.status),
    [filteredCreators]
  )

  const { profilesByCrmStatus, unlinkedKanbanProfiles } = useMemo(() => {
    const byStatus = emptyCrmStatusGroups<SocialMediaProfile>()
    const unlinked: SocialMediaProfile[] = []
    for (const profile of filteredProfiles) {
      if (!profile.creatorId) {
        unlinked.push(profile)
        continue
      }
      const status = creatorsById.get(profile.creatorId)?.status ?? 'new'
      byStatus.get(status)!.push(profile)
    }
    return { profilesByCrmStatus: byStatus, unlinkedKanbanProfiles: unlinked }
  }, [filteredProfiles, creatorsById])

  const contactsByCrmStatus = useMemo(
    () => groupByCrmStatus(filteredContacts, (c) => c.status),
    [filteredContacts]
  )

  const renderCreatorCard = (creator: CreatorPerson, showNested: boolean) => {
    const profiles = profilesByCreatorId.get(creator.id) ?? []
    const contacts = contactsByCreatorId.get(creator.id) ?? []
    const emails = [
      ...new Set(contacts.filter((c) => c.email).map((c) => normalizeEmail(c.email))),
    ]
    const allSent = emails.length > 0 && emails.every((e) => sentEmailSet.has(e))
    const anyPending = emails.length > 0 && emails.some((e) => !sentEmailSet.has(e))
    const isKanban = pipelineViewMode === 'kanban'
    const metaLabel = `${profiles.length} account${profiles.length !== 1 ? 's' : ''}${
      contacts.length > 0
        ? ` · ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`
        : ''
    }`

    return (
      <button
        type="button"
        onClick={() => openRootPanel({ type: 'creator', id: creator.id })}
        className={cn(
          'w-full min-w-0 text-left hover:bg-gray-50/80 rounded-md transition-colors',
          isKanban ? 'overflow-hidden p-2.5' : 'py-3 -mx-2 px-2',
          activePanel?.type === 'creator' &&
            activePanel.id === creator.id &&
            'bg-gray-50'
        )}
      >
        <div className={cn('flex items-start gap-3 min-w-0', isKanban && 'gap-2')}>
          <CreatorAvatar creator={creator} className={isKanban ? 'h-7 w-7 shrink-0' : undefined} />
          <div className="min-w-0 flex-1 overflow-hidden">
            <div
              className={cn(
                'flex gap-2 min-w-0',
                isKanban ? 'items-center' : 'items-baseline flex-wrap'
              )}
            >
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900"
                title={creator.displayName}
              >
                {creator.displayName}
              </span>
              {!isKanban ? <ContactCrmStatusBadge status={creator.status} /> : null}
              {anyPending && <OutreachDot sent={false} />}
              {allSent && <OutreachDot sent={true} />}
              {!isKanban ? (
                <span className="text-xs text-gray-400 ml-auto shrink-0">{metaLabel}</span>
              ) : null}
            </div>
            {isKanban ? (
              <TruncatedText className="text-xs text-gray-400 mt-0.5">{metaLabel}</TruncatedText>
            ) : null}
            {showNested && (
              <>
                <div
                  className={cn(
                    'mt-1.5 min-w-0 overflow-hidden',
                    isKanban ? 'flex flex-col gap-1' : 'flex flex-wrap gap-x-3 gap-y-1.5 text-xs'
                  )}
                >
                  {profiles.map((p) => profileLine(p, isKanban))}
                </div>
                {contacts.length > 0 && (
                  <div
                    className={cn(
                      'mt-1 min-w-0 overflow-hidden',
                      isKanban ? 'flex flex-col gap-1' : 'flex flex-wrap gap-x-3 gap-y-1.5 text-xs'
                    )}
                  >
                    {contacts.map((c) => contactLine(c, sentEmailSet, isKanban))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </button>
    )
  }

  const renderProfileCard = (profile: SocialMediaProfile) => {
    const creator = profile.creatorId ? creatorsById.get(profile.creatorId) : null
    const isKanban = pipelineViewMode === 'kanban'
    return (
      <div className={cn('flex min-w-0 items-center gap-2 p-2.5', isKanban && 'overflow-hidden')}>
        <button
          type="button"
          onClick={() => openProfilePanel(profile.id)}
          className={cn(
            'min-w-0 flex-1 overflow-hidden text-left hover:bg-gray-50/80 rounded-md transition-colors',
            activePanel?.type === 'profile' &&
              activePanel.id === profile.id &&
              'bg-gray-50'
          )}
        >
          <span className="flex min-w-0 items-start gap-2">
            <ProfileAvatar profile={profile} className="h-7 w-7 shrink-0" />
            <span className="min-w-0 flex-1 overflow-hidden">
              <span className="flex min-w-0 items-center gap-x-1.5 text-sm font-medium text-gray-900">
                <PlatformIcon platform={profile.platform} className="shrink-0" />
                <span className="min-w-0 truncate" title={`@${profile.handle}`}>
                  @{profile.handle}
                </span>
              </span>
              {creator ? (
                <TruncatedText className="text-xs text-gray-500 mt-0.5">
                  {creator.displayName}
                </TruncatedText>
              ) : (
                <span className="text-xs text-gray-400 mt-0.5 block">Unlinked</span>
              )}
            </span>
          </span>
        </button>
        {!profile.creatorId ? (
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-900 shrink-0 px-1"
            onClick={() => setLinkProfileId(profile.id)}
          >
            Link
          </button>
        ) : null}
      </div>
    )
  }

  const renderContactCard = (contact: CreatorContact) => {
    const isKanban = pipelineViewMode === 'kanban'
    const creator = creatorsById.get(contact.creatorId)
    const metaLabel = [
      contactKindLabel(contact.kind),
      contact.company || null,
      creator?.displayName || null,
    ]
      .filter(Boolean)
      .join(' · ')

    return (
      <button
        type="button"
        onClick={() => openContactPanel(contact.creatorId, contact.id)}
        className={cn(
          'w-full min-w-0 text-left hover:bg-gray-50/80 rounded-md transition-colors',
          isKanban ? 'overflow-hidden p-2.5' : 'py-3 -mx-2 px-2',
          activePanel?.type === 'contact' &&
            activePanel.id === contact.id &&
            'bg-gray-50'
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
            <ContactKindIcon kind={contact.kind} className="h-3.5 w-3.5 text-gray-600" />
          </span>
          <div className="min-w-0 flex-1 overflow-hidden">
            <span
              className={cn(
                'flex gap-1.5 text-sm font-medium text-gray-900 min-w-0',
                isKanban ? 'items-center' : 'flex-wrap items-center'
              )}
            >
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900"
                title={contact.name}
              >
                {contact.name}
              </span>
              {!isKanban ? <ContactCrmStatusBadge status={contact.status} /> : null}
            </span>
            <TruncatedText className="text-xs text-gray-500 mt-0.5" title={metaLabel}>
              {metaLabel}
            </TruncatedText>
            {contact.email ? (
              <p className="font-mono text-xs text-gray-500 mt-1 flex min-w-0 items-center gap-1.5">
                <OutreachDot sent={sentEmailSet.has(normalizeEmail(contact.email))} />
                <span className="min-w-0 flex-1 truncate" title={contact.email}>
                  {contact.email}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </button>
    )
  }

  const selectedCreator =
    store && activePanel?.type === 'creator'
      ? store.creators.find((c) => c.id === activePanel.id) ?? null
      : null

  const panelHeaderCreator = useMemo(() => {
    if (!store || !activePanel) return null
    if (activePanel.type === 'creator') {
      return store.creators.find((c) => c.id === activePanel.id) ?? null
    }
    if (activePanel.type === 'profile') {
      const profile = store.profiles.find((p) => p.id === activePanel.id)
      if (!profile?.creatorId) return null
      return store.creators.find((c) => c.id === profile.creatorId) ?? null
    }
    if (activePanel.type === 'contact') {
      const contact = store.contacts.find((c) => c.id === activePanel.id)
      if (!contact) return null
      return store.creators.find((c) => c.id === contact.creatorId) ?? null
    }
    return null
  }, [store, activePanel])

  const selectedProfile =
    store && activePanel?.type === 'profile'
      ? store.profiles.find((p) => p.id === activePanel.id) ?? null
      : null
  const selectedContact =
    store && activePanel?.type === 'contact'
      ? store.contacts.find((c) => c.id === activePanel.id) ?? null
      : null
  const creatorProfiles =
    store && selectedCreator
      ? store.profiles.filter((p) => p.creatorId === selectedCreator.id)
      : []
  const creatorContacts =
    store && selectedCreator ? getContactsForCreator(store, selectedCreator.id) : []

  useEffect(() => {
    if (panelHeaderCreator) {
      setCreatorNameDraft(panelHeaderCreator.displayName)
    }
    if (activePanel?.type === 'creator') {
      setEditingCreatorName(false)
    }
  }, [panelHeaderCreator?.id, panelHeaderCreator?.displayName, activePanel?.type])

  const cancelCreatorDisplayName = useCallback(() => {
    if (!panelHeaderCreator) return
    setCreatorNameDraft(panelHeaderCreator.displayName)
    setEditingCreatorName(false)
  }, [panelHeaderCreator])

  const saveCreatorDisplayName = useCallback(() => {
    if (!store || !panelHeaderCreator) return
    const trimmed = creatorNameDraft.trim()
    if (!trimmed) {
      notifyError('Name cannot be empty.')
      setCreatorNameDraft(panelHeaderCreator.displayName)
      setEditingCreatorName(false)
      return
    }
    if (trimmed !== panelHeaderCreator.displayName) {
      const next = { ...store }
      updateCreator(next, panelHeaderCreator.id, { displayName: trimmed })
      voidPersist(next)
    }
    setEditingCreatorName(false)
  }, [store, panelHeaderCreator, creatorNameDraft, voidPersist])

  if (!store) {
    if (loadError) {
      return (
        <div className="px-5 sm:px-8 lg:px-10 py-12">
          <p className="text-sm text-red-600">{loadError}</p>
          <p className="text-xs text-gray-500 mt-2">
            Run the creator_pipeline migration and expose the schema in Supabase API settings.
          </p>
        </div>
      )
    }
    return <CreatorOutreachLoading variant="pipeline" />
  }

  const panelTitle =
    activePanel?.type === 'scout' ? (
      'Scout profile'
    ) : panelHeaderCreator ? (
      <CreatorSheetHeader
        creator={panelHeaderCreator}
        editing={editingCreatorName}
        nameDraft={creatorNameDraft}
        onNameDraftChange={setCreatorNameDraft}
        onStartEdit={() => setEditingCreatorName(true)}
        onSave={saveCreatorDisplayName}
        onCancel={cancelCreatorDisplayName}
      />
    ) : activePanel?.type === 'profile' && selectedProfile ? (
      <span className="inline-flex items-center gap-2 min-w-0 w-full">
        <ProfileAvatar profile={selectedProfile} className="h-7 w-7 shrink-0" />
        <span className="inline-flex items-center gap-1.5 min-w-0 truncate text-sm font-medium">
          <PlatformIcon platform={selectedProfile.platform} />
          @{selectedProfile.handle}
        </span>
      </span>
    ) : (
      ''
    )

  return (
    <div className="flex h-full min-h-0 flex-1 w-full overflow-hidden">
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-5 sm:px-8 lg:px-10 py-8">
        <h1 className="text-lg font-semibold text-gray-900 mb-6">Pipeline</h1>

      <p className="text-xs text-gray-400 mb-4">
        {summary}
        <span className="text-gray-300 mx-1.5">·</span>
        <span className="text-gray-400">Supabase · creator_pipeline</span>
        {saving ? <span className="text-gray-400"> · saving…</span> : null}
      </p>

      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 pb-3 mb-4">
        <nav className="flex gap-4 text-sm shrink-0">
          {PIPELINE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPipelineFilter(f.id)}
              className={cn(
                'pb-3 -mb-3 border-b-2 transition-colors',
                pipelineFilter === f.id
                  ? 'border-gray-900 text-gray-900 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {f.label}
            </button>
          ))}
        </nav>
        <div
          className="flex h-8 shrink-0 rounded-md border border-gray-200 bg-gray-50/50 p-0.5"
          role="group"
          aria-label="Pipeline view"
        >
          <button
            type="button"
            title="List view"
            onClick={() => setPipelineViewMode('list')}
            className={cn(
              'inline-flex h-full items-center gap-1 rounded px-2.5 text-xs transition-colors',
              pipelineViewMode === 'list'
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-800'
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
            List
          </button>
          <button
            type="button"
            title="Kanban board"
            onClick={() => setPipelineViewMode('kanban')}
            className={cn(
              'inline-flex h-full items-center gap-1 rounded px-2.5 text-xs transition-colors',
              pipelineViewMode === 'kanban'
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-800'
            )}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Board
          </button>
        </div>
        <div className="relative flex-1 min-w-[10rem] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <Input
            className="h-8 pl-8 text-sm border-gray-200 bg-gray-50/50"
            placeholder="Search creators, handles, contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => openRootPanel({ type: 'scout' })}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
          {pipelineViewMode === 'list' &&
            (pipelineFilter === 'all' || pipelineFilter === 'creators') && (
            <ul className="divide-y divide-gray-100">
              {filteredCreators.map((creator) => (
                <li key={creator.id}>
                  {renderCreatorCard(creator, pipelineFilter === 'all')}
                </li>
              ))}
              {filteredCreators.length === 0 && (
                <li className="py-8 text-sm text-gray-400 text-center">No matches</li>
              )}
            </ul>
          )}

          {pipelineViewMode === 'kanban' &&
            (pipelineFilter === 'all' || pipelineFilter === 'creators') && (
            <PipelineKanbanBoard
              groups={creatorsByCrmStatus}
              getItemKey={(c) => c.id}
              renderCard={(creator) => renderCreatorCard(creator, pipelineFilter === 'all')}
            />
          )}

          {pipelineViewMode === 'kanban' &&
            pipelineFilter === 'all' &&
            unlinkedProfiles.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">
                Unlinked profiles
              </p>
              <div className="flex flex-wrap gap-2">
                {unlinkedProfiles.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      'min-w-0 flex-1 rounded-md border border-gray-100 bg-white shadow-sm',
                      KANBAN_CARD_CLASS
                    )}
                  >
                    {renderProfileCard(p)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pipelineViewMode === 'list' && pipelineFilter === 'profiles' && (
            <ul className="divide-y divide-gray-100">
              {filteredProfiles.map((p) => (
                <li key={p.id} className="py-2.5 flex items-center gap-3 text-sm">
                  {renderProfileCard(p)}
                </li>
              ))}
              {filteredProfiles.length === 0 && (
                <li className="py-8 text-sm text-gray-400 text-center">No matches</li>
              )}
            </ul>
          )}

          {pipelineViewMode === 'kanban' && pipelineFilter === 'profiles' && (
            <PipelineKanbanBoard
              groups={profilesByCrmStatus}
              getItemKey={(p) => p.id}
              renderCard={renderProfileCard}
              extraColumn={
                unlinkedKanbanProfiles.length > 0
                  ? { title: 'Unlinked', items: unlinkedKanbanProfiles }
                  : undefined
              }
            />
          )}

          {pipelineViewMode === 'list' && pipelineFilter === 'contacts' && (
            <ul className="divide-y divide-gray-100">
              {filteredContacts.map((c) => (
                <li key={c.id}>{renderContactCard(c)}</li>
              ))}
              {filteredContacts.length === 0 && (
                <li className="py-8 text-sm text-gray-400 text-center">No matches</li>
              )}
            </ul>
          )}

          {pipelineViewMode === 'kanban' && pipelineFilter === 'contacts' && (
            <PipelineKanbanBoard
              groups={contactsByCrmStatus}
              getItemKey={(c) => c.id}
              renderCard={renderContactCard}
            />
          )}

          {pipelineViewMode === 'list' &&
            pipelineFilter === 'all' &&
            unlinkedProfiles.length > 0 && (
            <>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 mt-8 mb-2">
                Unlinked
              </p>
              <ul className="divide-y divide-gray-100">
                {unlinkedProfiles.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center gap-3 text-sm">
                    {renderProfileCard(p)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

      <UnlinkConfirmDialog
        open={Boolean(unlinkConfirm)}
        profile={unlinkConfirm?.profile ?? null}
        creator={unlinkConfirm?.creator ?? null}
        onOpenChange={(open) => !open && setUnlinkConfirm(null)}
        onConfirm={confirmUnlink}
      />

      <LinkProfileDialog
        open={Boolean(linkProfileId)}
        profile={store.profiles.find((p) => p.id === linkProfileId) ?? null}
        creators={store.creators}
        onOpenChange={(open) => !open && setLinkProfileId(null)}
        onLink={(creatorId) => {
          const next = structuredClone(store)
          linkProfileToCreator(next, linkProfileId!, creatorId)
          voidPersist(next)
          setLinkProfileId(null)
        }}
        onCreateAndLink={(name) => {
          const next = structuredClone(store)
          const created = createCreator(next, name)
          linkProfileToCreator(next, linkProfileId!, created.id)
          voidPersist(next)
          setLinkProfileId(null)
        }}
      />
      </div>

      <OutreachPushPanel
        open={Boolean(activePanel)}
        onClose={closePanel}
        onBack={showPanelBack ? panelGoBack : undefined}
        title={panelTitle}
        hideClose={Boolean(panelHeaderCreator && editingCreatorName)}
        headerActions={
          panelHeaderCreator && editingCreatorName ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500"
                onClick={cancelCreatorDisplayName}
                title="Discard"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Discard</span>
              </Button>
              <Button size="sm" className="h-8" onClick={saveCreatorDisplayName}>
                Save
              </Button>
            </>
          ) : undefined
        }
      >
        {activePanel?.type === 'scout' && (
          <ScoutProfilePanel
            store={store}
            onSave={(input) => {
              const next = structuredClone(store)
              scoutProfile(next, input)
              voidPersist(next)
              closePanel()
            }}
          />
        )}
        {activePanel?.type === 'creator' && selectedCreator && (
          <CreatorDetailPanel
            creator={selectedCreator}
            profiles={creatorProfiles}
            contacts={creatorContacts}
            store={store}
            sentEmailSet={sentEmailSet}
            onSelectProfile={(id) => openChildPanel({ type: 'profile', id })}
            onSelectContact={(id) => openChildPanel({ type: 'contact', id })}
            onSaveCreator={(patch) => {
              const next = structuredClone(store)
              updateCreator(next, selectedCreator.id, patch)
              voidPersist(next)
            }}
            onRequestUnlink={(profile) => requestUnlink(profile, selectedCreator)}
            onAddContact={(input) => {
              const next = structuredClone(store)
              const { store: updated, outreach } = addCreatorContact(next, {
                creatorId: selectedCreator.id,
                ...input,
              })
              voidPersist(updated)
              handleOutreachResult(outreach)
            }}
            onRemoveContact={(contactId) => {
              const next = structuredClone(store)
              removeCreatorContact(next, contactId)
              voidPersist(next)
            }}
          />
        )}
        {activePanel?.type === 'profile' && selectedProfile && (
          <ProfileDetailPanel
            profile={selectedProfile}
            creator={panelHeaderCreator}
            onSave={(patch) => {
              const next = structuredClone(store)
              updateProfile(next, selectedProfile.id, patch)
              voidPersist(next)
            }}
            onLink={() => setLinkProfileId(selectedProfile.id)}
            onRequestUnlink={
              panelHeaderCreator
                ? (profile, creator) => requestUnlink(profile, creator)
                : undefined
            }
          />
        )}
        {activePanel?.type === 'contact' && selectedContact && (
          <ContactDetailPanel
            contact={selectedContact}
            store={store}
            sentEmailSet={sentEmailSet}
            onSave={(patch) => {
              const next = structuredClone(store)
              const { store: updated, outreach } = updateCreatorContact(
                next,
                selectedContact.id,
                patch
              )
              voidPersist(updated)
              handleOutreachResult(outreach)
            }}
          />
        )}
      </OutreachPushPanel>
    </div>
  )
}

function ScoutProfilePanel({
  store,
  onSave,
}: {
  store: CreatorOutreachStore
  onSave: (input: Parameters<typeof scoutProfile>[1]) => void
}) {
  const [platform, setPlatform] = useState<OutreachPlatform>('tiktok')
  const [handle, setHandle] = useState('')
  const [notes, setNotes] = useState('')
  const [scoutedBy, setScoutedBy] = useState('')
  const [linkMode, setLinkMode] = useState<'none' | 'existing' | 'new'>('none')
  const [creatorId, setCreatorId] = useState('')
  const [newCreatorName, setNewCreatorName] = useState('')

  const reset = () => {
    setPlatform('tiktok')
    setHandle('')
    setNotes('')
    setScoutedBy('')
    setLinkMode('none')
    setCreatorId('')
    setNewCreatorName('')
  }

  const submit = () => {
    if (!handle.trim()) {
      notifyError('Handle required.')
      return
    }
    if (linkMode === 'existing' && !creatorId) {
      notifyError('Select a creator.')
      return
    }
    if (linkMode === 'new' && !newCreatorName.trim()) {
      notifyError('Name required.')
      return
    }
    onSave({
      platform,
      handle,
      notes,
      scoutedBy,
      creatorId: linkMode === 'existing' ? creatorId : null,
      newCreatorName: linkMode === 'new' ? newCreatorName : undefined,
    })
    reset()
  }

  return (
    <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-400">Platform</p>
            <Select value={platform} onValueChange={(v) => setPlatform(v as OutreachPlatform)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-400">Handle</p>
            <Input
              className="h-9"
              placeholder="@username"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-400">Creator</p>
            <Select value={linkMode} onValueChange={(v) => setLinkMode(v as typeof linkMode)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unlinked</SelectItem>
                <SelectItem value="existing">Existing</SelectItem>
                <SelectItem value="new">New person</SelectItem>
              </SelectContent>
            </Select>
            {linkMode === 'existing' && (
              <Select value={creatorId} onValueChange={setCreatorId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select creator" />
                </SelectTrigger>
                <SelectContent>
                  {store.creators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {linkMode === 'new' && (
              <Input
                className="h-9"
                placeholder="Display name"
                value={newCreatorName}
                onChange={(e) => setNewCreatorName(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-400">Notes</p>
            <Textarea
              rows={2}
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-400">Scouted by</p>
            <Input
              className="h-9"
              placeholder="Your name"
              value={scoutedBy}
              onChange={(e) => setScoutedBy(e.target.value)}
            />
          </div>

          <Button size="sm" className="w-full" onClick={submit}>
            Add profile
          </Button>
    </div>
  )
}

function CreatorDetailPanel({
  creator,
  profiles,
  contacts,
  store,
  sentEmailSet,
  onSelectProfile,
  onSelectContact,
  onSaveCreator,
  onRequestUnlink,
  onAddContact,
  onRemoveContact,
}: {
  creator: CreatorPerson
  profiles: SocialMediaProfile[]
  contacts: CreatorContact[]
  store: CreatorOutreachStore
  sentEmailSet: Set<string>
  onSelectProfile: (id: string) => void
  onSelectContact: (id: string) => void
  onSaveCreator: (patch: Partial<Pick<CreatorPerson, 'displayName' | 'notes'>>) => void
  onRequestUnlink: (profile: SocialMediaProfile) => void
  onAddContact: (input: {
    kind: CreatorContactKind
    name: string
    company?: string
    email?: string
    notes?: string
  }) => void
  onRemoveContact: (contactId: string) => void
}) {
  const [notes, setNotes] = useState('')
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactKind, setContactKind] = useState<CreatorContactKind>('manager')
  const [contactName, setContactName] = useState('')
  const [contactCompany, setContactCompany] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactNotes, setContactNotes] = useState('')

  useEffect(() => {
    if (creator) {
      setNotes(creator.notes)
    }
  }, [creator])

  useEffect(() => {
    const email = contactEmail.trim()
    if (!email.includes('@')) return
    const inferred = inferCreatorContactKind(
      store,
      creator.id,
      email,
      contactName.trim() || creator.displayName
    )
    setContactKind(inferred)
    if (inferred === 'creator' && !contactName.trim()) {
      setContactName(creator.displayName)
    }
  }, [contactEmail, contactName, creator.id, creator.displayName, store])

  const notesDirty = notes !== creator.notes

  return (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">CRM status</p>
            <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-3">
              <ContactCrmStatusBadge status={creator.status} size="md" />
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                Rolled up from contacts when outreach runs.
              </p>
            </div>
          </div>

          <Textarea rows={2} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {notesDirty && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => onSaveCreator({ notes })}
            >
              Save notes
            </Button>
          )}

          <div className="pt-2">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">Profiles</p>
            <ul className="space-y-2">
              {profiles.map((p) => (
                <li key={p.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    className="flex-1 text-left min-w-0 flex items-start gap-2"
                    onClick={() => onSelectProfile(p.id)}
                  >
                    <ProfileAvatar profile={p} className="h-8 w-8" />
                    <span className="min-w-0 flex items-center gap-1.5">
                      <PlatformIcon platform={p.platform} />
                      <span className="font-medium">@{p.handle}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-400 hover:text-gray-700 p-1"
                    onClick={() => onRequestUnlink(p)}
                    title="Unlink from creator"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] uppercase tracking-wider text-gray-400">Contacts</p>
              <button
                type="button"
                className="text-[11px] text-gray-500 hover:text-gray-900"
                onClick={() => setShowAddContact((v) => !v)}
              >
                {showAddContact ? 'Cancel' : '+ Add'}
              </button>
            </div>
            {showAddContact && (
              <div className="space-y-2 mb-3 rounded-md border border-gray-100 p-3">
                <Select
                  value={contactKind}
                  onValueChange={(v) => setContactKind(v as CreatorContactKind)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creator">Creator</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-9"
                  placeholder="Name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
                {contactKind === 'agency' && (
                  <Input
                    className="h-9"
                    placeholder="Company"
                    value={contactCompany}
                    onChange={(e) => setContactCompany(e.target.value)}
                  />
                )}
                <Input
                  type="email"
                  className="h-9 font-mono text-xs"
                  placeholder="Email (optional)"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
                <Input
                  className="h-9"
                  placeholder="Notes (optional)"
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (!contactName.trim()) {
                      notifyError('Contact name required.')
                      return
                    }
                    onAddContact({
                      kind: contactKind,
                      name: contactName,
                      company: contactCompany,
                      email: contactEmail,
                      notes: contactNotes,
                    })
                    setContactName('')
                    setContactCompany('')
                    setContactEmail('')
                    setContactNotes('')
                    setShowAddContact(false)
                  }}
                >
                  Add contact
                </Button>
              </div>
            )}
            {contacts.length === 0 && !showAddContact ? (
              <p className="text-xs text-gray-400">No contacts yet.</p>
            ) : (
              <ul className="space-y-2">
                {contacts.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start gap-2 rounded-md border border-gray-100 px-2 py-2"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left hover:text-gray-600"
                      onClick={() => onSelectContact(c.id)}
                    >
                      <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-900">
                        <ContactKindIcon kind={c.kind} />
                        {c.name}
                        <span className="text-[10px] font-normal text-gray-400 uppercase">
                          {contactKindLabel(c.kind)}
                        </span>
                        <ContactCrmStatusBadge status={c.status} className="ml-0.5" />
                      </span>
                      {c.company ? (
                        <p className="text-xs text-gray-500 mt-0.5">{c.company}</p>
                      ) : null}
                      {c.email ? (
                        <p className="font-mono text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                          <OutreachDot sent={sentEmailSet.has(normalizeEmail(c.email))} />
                          {c.email}
                        </p>
                      ) : null}
                      {c.missiveConversationIds.length > 0 ? (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {c.missiveConversationIds.length} Missive conversation
                          {c.missiveConversationIds.length !== 1 ? 's' : ''}
                        </p>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-700 p-1 shrink-0"
                      onClick={() => onRemoveContact(c.id)}
                      title="Remove contact"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
  )
}

function ProfileDetailPanel({
  profile,
  creator,
  onSave,
  onLink,
  onRequestUnlink,
}: {
  profile: SocialMediaProfile
  creator: CreatorPerson | null
  onSave: (patch: Partial<Pick<SocialMediaProfile, 'notes'>>) => void
  onLink: () => void
  onRequestUnlink?: (profile: SocialMediaProfile, creator: CreatorPerson) => void
}) {
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (profile) {
      setNotes(profile.notes)
    }
  }, [profile])

  const notesDirty = notes !== profile.notes

  return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-1">
            <ProfileAvatar profile={profile} className="h-10 w-10" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <PlatformIcon platform={profile.platform} />
                @{profile.handle}
              </p>
            </div>
          </div>
          <a
            href={profile.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>

          {creator && onRequestUnlink ? (
            <div className="flex items-center justify-end">
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
                onClick={() => onRequestUnlink(profile, creator)}
              >
                <Unlink className="h-3 w-3" />
                Unlink from creator
              </button>
            </div>
          ) : !creator ? (
            <button type="button" className="text-xs text-gray-600 hover:text-gray-900" onClick={onLink}>
              <Link2 className="h-3 w-3 inline mr-1" />
              Link to creator
            </button>
          ) : null}

          <Textarea rows={2} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {notesDirty && (
            <Button size="sm" className="w-full" onClick={() => onSave({ notes })}>
              Save notes
            </Button>
          )}
        </div>
  )
}

function ContactDetailPanel({
  contact,
  store,
  sentEmailSet,
  onSave,
}: {
  contact: CreatorContact
  store: CreatorOutreachStore
  sentEmailSet: Set<string>
  onSave: (patch: Parameters<typeof updateCreatorContact>[2]) => void
}) {
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    setEmailDraft(contact.email)
    setNotes(contact.notes)
    setEditingEmail(false)
  }, [contact])

  const saveEmail = () => {
    const normalized = normalizeEmail(emailDraft)
    if (normalized !== contact.email) {
      onSave({ email: normalized })
    }
    setEditingEmail(false)
  }

  const cancelEmail = () => {
    setEmailDraft(contact.email)
    setEditingEmail(false)
  }

  const emailSent = contact.email && hasOutreachBeenSentToEmail(store, contact.email)
  const notesDirty = notes !== contact.notes

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ContactKindIcon kind={contact.kind} className="h-4 w-4" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">{contact.name}</p>
            <p className="text-xs text-gray-500">
              {contactKindLabel(contact.kind)}
              {contact.company ? ` · ${contact.company}` : ''}
            </p>
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">Notes</p>
          <Textarea
            rows={2}
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {notesDirty && (
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-2"
              onClick={() => onSave({ notes })}
            >
              Save notes
            </Button>
          )}
        </div>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">CRM status</p>
        <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-3">
          <ContactCrmStatusBadge status={contact.status} size="md" />
          <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
            Updated automatically when outreach runs.
          </p>
        </div>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">Email</p>
        {editingEmail ? (
          <div className="space-y-2">
            <Input
              type="email"
              className="h-9 font-mono text-xs"
              placeholder="Email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveEmail()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelEmail()
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-8" onClick={saveEmail}>
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={cancelEmail}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 min-w-0">
              {emailDraft ? (
                <>
                  <OutreachDot sent={!!emailSent} />
                  <span className="font-mono text-xs text-gray-900 truncate">{emailDraft}</span>
                </>
              ) : (
                <span className="text-xs text-gray-400">No email</span>
              )}
              <button
                type="button"
                className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                onClick={() => setEditingEmail(true)}
                title={emailDraft ? 'Edit email' : 'Add email'}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </span>
            {emailDraft ? (
              <p className="text-[11px] text-gray-400 mt-1.5">
                {emailSent ? 'Already emailed.' : 'New email triggers outreach (mock).'}
              </p>
            ) : null}
          </>
        )}
      </div>

      {contact.missiveConversationIds.length > 0 ? (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">
            Missive conversations
          </p>
          <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 space-y-1.5">
            {contact.missiveConversationIds.map((id) => (
              <p key={id} className="font-mono text-[11px] text-gray-700 truncate">
                {id}
              </p>
            ))}
            <p className="text-[11px] text-gray-400 pt-1">Linked by integration.</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function LinkProfileDialog({
  open,
  profile,
  creators,
  onOpenChange,
  onLink,
  onCreateAndLink,
}: {
  open: boolean
  profile: SocialMediaProfile | null
  creators: CreatorPerson[]
  onOpenChange: (open: boolean) => void
  onLink: (creatorId: string) => void
  onCreateAndLink: (name: string) => void
}) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [creatorId, setCreatorId] = useState('')
  const [newName, setNewName] = useState('')

  if (!profile) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Link @{profile.handle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="existing">Existing creator</SelectItem>
              <SelectItem value="new">New creator</SelectItem>
            </SelectContent>
          </Select>
          {mode === 'existing' ? (
            <Select value={creatorId} onValueChange={setCreatorId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {creators.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-9"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (mode === 'existing') {
                if (!creatorId) {
                  notifyError('Select a creator.')
                  return
                }
                onLink(creatorId)
              } else {
                if (!newName.trim()) {
                  notifyError('Name required.')
                  return
                }
                onCreateAndLink(newName.trim())
              }
            }}
          >
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UnlinkConfirmDialog({
  open,
  profile,
  creator,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  profile: SocialMediaProfile | null
  creator: CreatorPerson | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  if (!profile || !creator) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Unlink profile from creator?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 leading-relaxed">
          These stay separate records — only the link between them is removed. The profile
          moves to your unlinked list; nothing is deleted.
        </p>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Social profile</p>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-3">
            <div className="flex items-start gap-3">
              <ProfileAvatar profile={profile} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  <PlatformIcon platform={profile.platform} />
                  @{profile.handle}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{platformLabel(profile.platform)}</p>
                {profile.followerCount != null && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {profile.followerCount >= 1_000_000
                      ? `${(profile.followerCount / 1_000_000).toFixed(1)}M`
                      : profile.followerCount >= 1_000
                        ? `${(profile.followerCount / 1_000).toFixed(1)}K`
                        : profile.followerCount}{' '}
                    followers
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 py-0.5">will be unlinked from</p>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Creator (person)</p>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-3">
            <div className="flex items-start gap-3">
              <CreatorAvatar creator={creator} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{creator.displayName}</p>
                {creator.notes ? (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{creator.notes}</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">No creator notes</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            Unlink
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
