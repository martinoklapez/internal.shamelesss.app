'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { planQuickAdd, type QuickAddPlan } from '@/lib/creator-outreach/quick-add'
import {
  Building2,
  CircleUser,
  Columns3,
  ExternalLink,
  LayoutList,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Unlink,
  UserRound,
  X,
  Zap,
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
import { ContactMissiveSentEmails } from '@/components/contact-missive-sent-emails'
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
import {
  OUTREACH_CONTACT_KINDS,
  type ContactCrmStatus,
  type CreatorContact,
  type CreatorContactKind,
  type CreatorPerson,
  type CreatorOutreachStore,
  type OutreachPlatform,
  type SocialMediaProfile,
} from '@/lib/creator-outreach/types'
import {
  CONTACT_CRM_STATUS_STYLES,
  contactCrmStatusLabel,
} from '@/lib/creator-outreach/crm-status-ui'
import {
  addCreatorContact,
  contactKindLabel,
  createCreator,
  getContactsForCreator,
  linkContactToCreator,
  linkProfileToCreator,
  normalizeEmail,
  normalizePhone,
  formatPhoneForDisplay,
  isValidPhoneInput,
  platformLabel,
  removeCreatorContact,
  scoutProfile,
  unlinkContactFromCreator,
  unlinkProfileFromCreator,
  updateCreator,
  updateCreatorContact,
  updateProfile,
} from '@/lib/creator-outreach/store'
import { hasActiveOutreachForEmail } from '@/lib/creator-outreach/rules-engine'
import {
  fetchCreatorOutreachStore,
  mutateCreatorOutreach,
} from '@/lib/creator-outreach/client-api'
import type { QuickAddJobView } from '@/lib/creator-outreach/quick-add-jobs'
import type { QuickAddPlanWarning } from '@/lib/creator-outreach/quick-add-integrity'
import {
  useQuickAddAutoAcceptPreference,
  useQuickAddJobs,
} from '@/hooks/use-quick-add-jobs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { inferCreatorContactKind } from '@/lib/creator-outreach/infer-contact-kind'
import {
  buildProfilesByCreatorIdMap,
  isCreatorAvatarProfileSelected,
  resolveCreatorAvatarImageSrc,
  sortProfilesByScoutedAt,
} from '@/lib/creator-outreach/creator-avatar'
import { profilePicturePreviewUrl } from '@/lib/social-profile-picture-fetch'
import {
  validateSocialProfileUrl,
  type ResolvedSocialProfile,
} from '@/lib/social-profile-url'
import { formatFollowerCountShort } from '@/lib/normalize-follower-count'
import {
  draftContactSourceLabel,
  type DraftContactFromProfile,
} from '@/lib/social-profile-draft-contact'
import { createClient } from '@/lib/supabase/client'

type PipelineFilter = 'all' | 'creators' | 'profiles' | 'contacts'

const PIPELINE_FILTERS: { id: PipelineFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'creators', label: 'Creators' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'contacts', label: 'Contacts' },
]

const CRM_STATUS_COLUMNS: ContactCrmStatus[] = [
  'new',
  'contacted',
  'in_talks',
  'test_phase',
  'active_partnership',
  'reached',
  'blocked',
]

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
  | { type: 'quick-add' }
  | { type: 'create-creator' }
  | { type: 'create-contact' }
  | { type: 'creator'; id: string }
  | { type: 'profile'; id: string }
  | { type: 'contact'; id: string }

function addPanelForFilter(filter: PipelineFilter): ActivePanel {
  if (filter === 'creators') return { type: 'create-creator' }
  if (filter === 'contacts') return { type: 'create-contact' }
  return { type: 'scout' }
}

function addPanelTitle(panel: ActivePanel): string {
  if (panel.type === 'quick-add') return 'Quick Add'
  if (panel.type === 'scout') return 'Scout profile'
  if (panel.type === 'create-creator') return 'New creator'
  if (panel.type === 'create-contact') return 'New contact'
  return ''
}

function isRootAddPanel(panel: ActivePanel): boolean {
  return (
    panel.type === 'scout' ||
    panel.type === 'create-creator' ||
    panel.type === 'create-contact'
  )
}

function PlatformIcon({ platform, className }: { platform: OutreachPlatform; className?: string }) {
  if (platform === 'tiktok') {
    return <SiTiktok className={cn('h-3 w-3 shrink-0', className)} />
  }
  return <SiInstagram className={cn('h-3 w-3 shrink-0', className)} />
}

const OUTREACH_PLATFORMS: OutreachPlatform[] = ['tiktok', 'instagram']

function PlatformPicker({
  value,
  onChange,
}: {
  value: OutreachPlatform | null
  onChange: (platform: OutreachPlatform | null) => void
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Platform">
      {OUTREACH_PLATFORMS.map((p) => {
        const selected = value === p
        return (
          <button
            key={p}
            type="button"
            aria-pressed={selected}
            title={platformLabel(p)}
            onClick={() => onChange(selected ? null : p)}
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
              selected
                ? p === 'tiktok'
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-transparent bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] text-white'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-800'
            )}
          >
            <PlatformIcon platform={p} className="h-5 w-5" />
          </button>
        )
      })}
    </div>
  )
}

function profilePrimaryLabel(profile: SocialMediaProfile): string {
  const name = profile.displayName.trim()
  return name || `@${profile.handle}`
}

function profileFollowerLabel(count: number | null | undefined): string | null {
  if (count == null) return null
  return `${formatFollowerCountShort(count)} followers`
}

type QuickAddActionKind = 'link' | 'create' | 'skip'

function QuickAddActionLabel({ kind }: { kind: QuickAddActionKind }) {
  const label = kind === 'link' ? 'Link' : kind === 'create' ? 'Create' : 'Skip'
  return (
    <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 shrink-0">
      {label}
    </span>
  )
}

/** Same row layout as the post-import profile preview (name + @handle · followers). */
function PipelinePreviewCard({
  avatar,
  title,
  subtitle,
  action,
}: {
  avatar: ReactNode
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
        {subtitle ? (
          <p className="text-xs text-gray-500 flex items-center gap-1 truncate">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function ImportProfilePreviewRow({
  platform,
  displayName,
  handle,
  followerCount,
  avatarSrc,
  action,
}: {
  platform: OutreachPlatform
  displayName: string
  handle: string
  followerCount: number | null
  avatarSrc: string | null
  action?: ReactNode
}) {
  const cleanHandle = handle.replace(/^@/, '')
  return (
    <PipelinePreviewCard
      avatar={
        <Avatar className="h-11 w-11 shrink-0">
          {avatarSrc ? <AvatarImage src={avatarSrc} alt={displayName || cleanHandle} /> : null}
          <AvatarFallback
            className={cn(
              'text-xs font-medium',
              platform === 'tiktok'
                ? 'bg-gray-900 text-white'
                : 'bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] text-white'
            )}
          >
            {initialsFromName(displayName || cleanHandle || '??')}
          </AvatarFallback>
        </Avatar>
      }
      title={displayName.trim() || cleanHandle}
      subtitle={
        <>
          <PlatformIcon platform={platform} />
          @{cleanHandle}
          {followerCount != null ? (
            <span className="text-gray-400">
              {' '}
              · {formatFollowerCountShort(followerCount)} followers
            </span>
          ) : null}
        </>
      }
      action={action}
    />
  )
}

/** Profile row matching `CreatorDetailPanel` → Profiles list. */
function CreatorSheetProfileListItem({
  profile,
  avatarPreviewSrc,
}: {
  profile: SocialMediaProfile
  /** Scraped CDN URL before avatar is stored (create flow). */
  avatarPreviewSrc?: string | null
}) {
  const cleanHandle = profile.handle.replace(/^@/, '')
  const label = profilePrimaryLabel(profile)
  const followers = profileFollowerLabel(profile.followerCount)

  const avatar = avatarPreviewSrc ? (
    <Avatar className="h-8 w-8 shrink-0">
      <AvatarImage src={avatarPreviewSrc} alt={label} />
      <AvatarFallback
        className={cn(
          'text-[10px] font-medium',
          profile.platform === 'tiktok'
            ? 'bg-gray-900 text-white'
            : 'bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] text-white'
        )}
      >
        {initialsFromName(label)}
      </AvatarFallback>
    </Avatar>
  ) : (
    <ProfileAvatar profile={profile} className="h-8 w-8 shrink-0" />
  )

  return (
    <div className="flex-1 min-w-0 flex items-start gap-2">
      {avatar}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-medium text-gray-900">
          <PlatformIcon platform={profile.platform} />
          <span className="truncate">{label}</span>
        </span>
        <span className="text-xs text-gray-500 block truncate">@{cleanHandle}</span>
        {followers ? (
          <span className="text-xs text-gray-400 block truncate">{followers}</span>
        ) : null}
      </span>
    </div>
  )
}

/** Contact row matching `CreatorDetailPanel` → Contacts list. */
function CreatorSheetContactListItem({
  contact,
  sentEmailSet,
  sourceHint,
}: {
  contact: CreatorContact
  sentEmailSet: Set<string>
  /** Shown under email when creating from scraped profile (no CRM row yet). */
  sourceHint?: string | null
}) {
  const sent = contact.email ? sentEmailSet.has(normalizeEmail(contact.email)) : false

  return (
    <div className="min-w-0 flex-1 text-left">
      <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-900">
        <ContactKindIcon kind={contact.kind} />
        {contact.name}
        <span className="text-[10px] font-normal text-gray-400 uppercase">
          {contactKindLabel(contact.kind)}
        </span>
        <ContactCrmStatusBadge status={contact.status} className="ml-0.5" />
      </span>
      {contact.company ? (
        <p className="text-xs text-gray-500 mt-0.5">{contact.company}</p>
      ) : null}
      {contact.email ? (
        <p className="font-mono text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 min-w-0">
          <OutreachDot sent={sent} />
          <span className="truncate">{contact.email}</span>
        </p>
      ) : null}
      {contact.phone ? (
        <p className="text-xs text-gray-500 mt-0.5 truncate">{formatPhoneForDisplay(contact.phone)}</p>
      ) : null}
      {sourceHint ? (
        <p className="text-[11px] text-gray-400 mt-0.5">{sourceHint}</p>
      ) : null}
    </div>
  )
}

function QuickAddPlanPreviews({
  plan,
  store,
  profilesByCreatorId,
  platform,
  handle,
  displayName,
  followerCount,
  profilePicture,
  profileUrl,
  sentEmailSet,
}: {
  plan: QuickAddPlan
  store: CreatorOutreachStore
  profilesByCreatorId: Map<string, SocialMediaProfile[]>
  platform: OutreachPlatform
  handle: string
  displayName: string
  followerCount: number | null
  profilePicture: string | null
  profileUrl: string
  sentEmailSet: Set<string>
}) {
  const cleanHandle = handle.replace(/^@/, '')
  const importAvatarSrc = profilePicturePreviewUrl(profilePicture)

  const profileForRow: SocialMediaProfile =
    plan.profile.action === 'existing'
      ? plan.profile.profile
      : {
          id: '__quick_add_draft__',
          platform,
          handle: cleanHandle,
          displayName: displayName.trim() || cleanHandle,
          profileUrl,
          avatarUrl: null,
          followerCount,
          creatorId: null,
          notes: '',
          scoutedAt: '',
          scoutedBy: '',
        }

  const profileAction: QuickAddActionKind =
    plan.profile.action === 'existing' ? 'link' : 'create'

  const targetCreatorId =
    plan.creator.action === 'link' ? plan.creator.creator.id : null

  let contactForRow: CreatorContact | null = null
  let contactAction: QuickAddActionKind = 'skip'
  let contactSourceHint: string | null = null

  if (plan.contact.action === 'link') {
    contactForRow = plan.contact.contact
    contactAction = 'link'
  } else if (plan.contact.action === 'create') {
    const draft = plan.contact.draft
    const kind =
      targetCreatorId != null
        ? inferCreatorContactKind(store, targetCreatorId, draft.email, draft.name)
        : 'creator'
    contactForRow = {
      id: '__quick_add_draft_contact__',
      creatorId: targetCreatorId,
      kind,
      name: draft.name.trim() || displayName,
      company: '',
      email: draft.email,
      phone: '',
      notes: '',
      status: 'new',
      missiveConversationIds: [],
      createdAt: '',
    }
    contactAction = 'create'
    contactSourceHint = `From ${draftContactSourceLabel(draft.source, platform)}`
  }

  const creatorAction: QuickAddActionKind =
    plan.creator.action === 'link' ? 'link' : 'create'

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Creator</p>
          <QuickAddActionLabel kind={creatorAction} />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {plan.creator.action === 'link' ? (
            <CreatorAvatar
              creator={plan.creator.creator}
              profiles={profilesByCreatorId.get(plan.creator.creator.id) ?? []}
              className="h-7 w-7 shrink-0"
            />
          ) : (
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="text-xs font-medium bg-violet-100 text-violet-800">
                {initialsFromName(plan.creator.displayName)}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="text-sm font-semibold text-gray-900 truncate">
            {plan.creator.action === 'link'
              ? plan.creator.creator.displayName
              : plan.creator.displayName}
          </span>
          {plan.creator.action === 'link' ? (
            <ContactCrmStatusBadge status={plan.creator.creator.status} size="sm" />
          ) : (
            <ContactCrmStatusBadge status="new" size="sm" />
          )}
        </div>
        {plan.creator.action === 'link' ? (
          <p className="text-xs text-gray-500 mt-1">{plan.creator.reason}</p>
        ) : (
          <p className="text-xs text-gray-500 mt-1">New person in CRM</p>
        )}
      </div>

      <div className="pt-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Profiles</p>
          <QuickAddActionLabel kind={profileAction} />
        </div>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <CreatorSheetProfileListItem
              profile={profileForRow}
              avatarPreviewSrc={
                plan.profile.action === 'create' ? importAvatarSrc : undefined
              }
            />
          </li>
        </ul>
      </div>

      <div className="pt-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Contacts</p>
          <QuickAddActionLabel kind={contactAction} />
        </div>
        {contactForRow ? (
          <ul className="space-y-2">
            <li className="flex items-start gap-2 rounded-md border border-gray-100 px-2 py-2">
              <CreatorSheetContactListItem
                contact={contactForRow}
                sentEmailSet={sentEmailSet}
                sourceHint={contactSourceHint}
              />
            </li>
          </ul>
        ) : (
          <p className="text-xs text-gray-400">No email on profile — no contact to add.</p>
        )}
      </div>
    </div>
  )
}

function NotesField({
  value,
  onChange,
  placeholder = 'Notes',
  dirty = false,
  onSave,
  saveLabel = 'Save notes',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  dirty?: boolean
  onSave?: () => void
  saveLabel?: string
}) {
  const hasContent = Boolean(value.trim())
  const [expanded, setExpanded] = useState(hasContent)

  useEffect(() => {
    if (hasContent) setExpanded(true)
  }, [hasContent])

  if (!expanded && !hasContent) {
    return (
      <button
        type="button"
        className="text-xs text-gray-500 hover:text-gray-800"
        onClick={() => setExpanded(true)}
      >
        Add notes
      </button>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wider text-gray-400">Notes</p>
      <Textarea
        rows={2}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {dirty && onSave ? (
        <Button size="sm" variant="outline" className="w-full" onClick={onSave}>
          {saveLabel}
        </Button>
      ) : null}
    </div>
  )
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

/** Generated placeholder when `profile.avatarUrl` is not set (shadcn Avatar + image pattern). */
function profilePlaceholderAvatarUrl(profileId: string): string {
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(profileId)}`
}

function CreatorAvatar({
  creator,
  profiles,
  className,
}: {
  creator: CreatorPerson
  profiles: SocialMediaProfile[]
  className?: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const imageSrc = resolveCreatorAvatarImageSrc(creator, profiles)
  const showImage = !imageFailed

  useEffect(() => {
    setImageFailed(false)
  }, [imageSrc])

  return (
    <Avatar className={cn('h-9 w-9 shrink-0', className)}>
      {showImage ? (
        <AvatarImage
          src={imageSrc}
          alt={creator.displayName}
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <AvatarFallback className="text-xs font-medium bg-violet-100 text-violet-800">
        {initialsFromName(creator.displayName)}
      </AvatarFallback>
    </Avatar>
  )
}

function CreatorPicker({
  creators,
  profilesByCreatorId,
  value,
  onChange,
}: {
  creators: CreatorPerson[]
  profilesByCreatorId: Map<string, SocialMediaProfile[]>
  value: string
  onChange: (creatorId: string) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return creators
    return creators.filter((c) => c.displayName.toLowerCase().includes(q))
  }, [creators, query])

  if (creators.length === 0) {
    return <p className="text-xs text-gray-400">No creators yet. Create one first.</p>
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <Input
          className="h-8 pl-8 text-xs border-gray-200"
          placeholder="Search creators…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-md border border-gray-100 bg-gray-50/30 p-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No matches.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((creator) => {
              const selected = value === creator.id
              return (
                <button
                  key={creator.id}
                  type="button"
                  aria-pressed={selected}
                  title={creator.displayName}
                  onClick={() => onChange(selected ? '' : creator.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border p-2.5 min-w-0 transition-colors',
                    selected
                      ? 'border-gray-900 bg-white ring-1 ring-gray-900 shadow-sm'
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <CreatorAvatar
                    creator={creator}
                    profiles={profilesByCreatorId.get(creator.id) ?? []}
                    className="h-12 w-12"
                  />
                  <span className="text-xs font-medium text-gray-900 truncate w-full leading-tight">
                    {creator.displayName}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileAvatar({
  profile,
  className,
}: {
  profile: SocialMediaProfile
  className?: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const storedSrc = profile.avatarUrl?.trim() || null
  const imageSrc = storedSrc ?? profilePlaceholderAvatarUrl(profile.id)
  const showImage = !imageFailed

  useEffect(() => {
    setImageFailed(false)
  }, [storedSrc])

  return (
    <Avatar className={cn('h-6 w-6 shrink-0', className)}>
      {showImage ? (
        <AvatarImage
          src={imageSrc}
          alt={profilePrimaryLabel(profile)}
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <AvatarFallback
        className={cn(
          'text-[10px] font-medium',
          profile.platform === 'tiktok'
            ? 'bg-gray-900 text-white'
            : 'bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] text-white'
        )}
      >
        {initialsFromName(profile.displayName || profile.handle)}
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

function contactPhoneMatchesQuery(phone: string, q: string): boolean {
  if (!phone) return false
  if (phone.toLowerCase().includes(q)) return true
  return formatPhoneForDisplay(phone).toLowerCase().includes(q)
}

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
        {c.phone ? (
          <div className="flex min-w-0 items-center gap-1 pl-4">
            <TruncatedText className="text-[11px]">{formatPhoneForDisplay(c.phone)}</TruncatedText>
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
      {c.phone ? (
        <>
          <span className="text-gray-300">·</span>
          <span className="text-[11px]">{formatPhoneForDisplay(c.phone)}</span>
        </>
      ) : null}
    </span>
  )
}

function CreatorSheetHeader({
  creator,
  profiles,
  editing,
  nameDraft,
  onNameDraftChange,
  onStartEdit,
  onSave,
  onCancel,
  onAvatarClick,
}: {
  creator: CreatorPerson
  profiles: SocialMediaProfile[]
  editing: boolean
  nameDraft: string
  onNameDraftChange: (value: string) => void
  onStartEdit: () => void
  onSave: () => void
  onCancel: () => void
  onAvatarClick?: () => void
}) {
  const avatar = (
    <CreatorAvatar creator={creator} profiles={profiles} className="h-7 w-7 shrink-0" />
  )

  return (
    <span className="inline-flex items-center gap-2 min-w-0 w-full">
      {onAvatarClick ? (
        <button
          type="button"
          className="shrink-0 rounded-full ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 hover:opacity-90 transition-opacity"
          onClick={onAvatarClick}
          title="Change photo"
        >
          {avatar}
        </button>
      ) : (
        avatar
      )}
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
  const [unlinkConfirm, setUnlinkConfirm] = useState<
    | { type: 'profile'; profile: SocialMediaProfile; creator: CreatorPerson }
    | { type: 'contact'; contact: CreatorContact; creator: CreatorPerson }
    | null
  >(null)
  const [editingCreatorName, setEditingCreatorName] = useState(false)
  const [creatorNameDraft, setCreatorNameDraft] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [scoutLinkCreatorId, setScoutLinkCreatorId] = useState<string | null>(null)
  const [linkProfilesForCreatorId, setLinkProfilesForCreatorId] = useState<string | null>(null)
  const [linkContactsForCreatorId, setLinkContactsForCreatorId] = useState<string | null>(null)
  const [avatarPhotoPickerCreatorId, setAvatarPhotoPickerCreatorId] = useState<string | null>(
    null
  )

  const closePanel = useCallback(() => {
    setActivePanel(null)
    setPanelStack([])
    setEditingCreatorName(false)
    setScoutLinkCreatorId(null)
  }, [])

  const openRootPanel = useCallback((panel: ActivePanel) => {
    setPanelStack([])
    setActivePanel(panel)
    setEditingCreatorName(false)
  }, [])

  const openScoutPanel = useCallback(
    (variant: 'default' | 'quick-add' = 'default') => {
      setPanelStack([])
      setActivePanel(variant === 'quick-add' ? { type: 'quick-add' } : { type: 'scout' })
      setEditingCreatorName(false)
    },
    []
  )

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

  const openContactPanel = useCallback((creatorId: string | null, contactId: string) => {
    if (creatorId) {
      setPanelStack([{ type: 'creator', id: creatorId }])
    } else {
      setPanelStack([])
    }
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

  useEffect(() => {
    if (panelStack.length > 0) return
    setActivePanel((current) => {
      if (!current || !isRootAddPanel(current)) return current
      const next = addPanelForFilter(pipelineFilter)
      return current.type === next.type ? current : next
    })
  }, [pipelineFilter, panelStack.length])

  const showPanelBack =
    activePanel?.type === 'contact' ||
    (activePanel?.type === 'profile' &&
      Boolean(store?.profiles.find((p) => p.id === activePanel.id)?.creatorId)) ||
    panelStack.length > 0

  const requestUnlinkProfile = useCallback(
    (profile: SocialMediaProfile, creator: CreatorPerson) => {
      setUnlinkConfirm({ type: 'profile', profile, creator })
    },
    []
  )

  const requestUnlinkContact = useCallback(
    (contact: CreatorContact, creator: CreatorPerson) => {
      setUnlinkConfirm({ type: 'contact', contact, creator })
    },
    []
  )

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null)
    })
  }, [])

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

  const handleOutreachResult = useCallback(
    (payload?: {
      outreach?: { action: string; reason?: string }
      missiveSent?: number
      missiveFailed?: number
      lastMissiveError?: string
      lastMissiveWarning?: string
    }) => {
      if (!payload) return
      if (payload.missiveSent && payload.missiveSent > 0) {
        if (payload.lastMissiveWarning) {
          notifySuccess(payload.lastMissiveWarning, 'Sent — wrong From address')
        } else {
          notifySuccess(
            payload.missiveSent === 1
              ? 'Email sent via Missive.'
              : `${payload.missiveSent} emails sent via Missive.`,
            'Sent'
          )
        }
      } else if (payload.missiveFailed && payload.missiveFailed > 0) {
        const detail =
          payload.lastMissiveError ??
          'Missive could not send the email. Check Pipeline → Senders and Missive alias permissions.'
        if (payload.outreach?.action === 'queued') {
          notifyError(
            `${detail} The contact was saved; outreach stays queued. Fix the sender in Pipeline → Rules or Missive, then run process-outreach again.`,
            'Contact saved — email not sent'
          )
        } else {
          notifyError(detail)
        }
      } else if (payload.outreach?.action === 'queued') {
        notifySuccess('Outreach queued per Rules.', 'Queued')
      } else if (payload.outreach?.action === 'skipped') {
        notifySuccess(payload.outreach.reason ?? 'Already contacted.', 'Skipped')
      }
    },
    []
  )

  const persist = useCallback(async (next: CreatorOutreachStore) => {
    setSaving(true)
    try {
      const { store: saved, outreach, missiveSent, missiveFailed, lastMissiveError } =
        await mutateCreatorOutreach({
          action: 'replaceStore',
          store: next,
        })
      setStore(saved)
      handleOutreachResult({ outreach, missiveSent, missiveFailed, lastMissiveError })
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to save')
      throw err
    } finally {
      setSaving(false)
    }
  }, [handleOutreachResult])

  const voidPersist = useCallback(
    (next: CreatorOutreachStore) => {
      void persist(next)
    },
    [persist]
  )

  const runPipelineMutation = useCallback(
    async (body: Parameters<typeof mutateCreatorOutreach>[0]) => {
      setSaving(true)
      try {
        const { store: saved, outreach, missiveSent, missiveFailed, lastMissiveError } =
          await mutateCreatorOutreach(body)
        setStore(saved)
        handleOutreachResult({ outreach, missiveSent, missiveFailed, lastMissiveError })
        return saved
      } catch (err) {
        notifyError(err instanceof Error ? err.message : 'Failed to save')
        throw err
      } finally {
        setSaving(false)
      }
    },
    [handleOutreachResult]
  )

  const confirmUnlink = useCallback(async () => {
    if (!unlinkConfirm || !store) return
    const next = structuredClone(store)
    if (unlinkConfirm.type === 'profile') {
      unlinkProfileFromCreator(next, unlinkConfirm.profile.id)
    } else {
      unlinkContactFromCreator(next, unlinkConfirm.contact.id)
    }
    await persist(next)
    const { creator } = unlinkConfirm
    setUnlinkConfirm(null)
    if (unlinkConfirm.type === 'profile') {
      notifySuccess(
        `@${unlinkConfirm.profile.handle} is now unlinked from ${creator.displayName}.`
      )
    } else {
      notifySuccess(
        `${unlinkConfirm.contact.name} is now unlinked from ${creator.displayName}.`
      )
      if (
        activePanel?.type === 'contact' &&
        activePanel.id === unlinkConfirm.contact.id
      ) {
        closePanel()
      }
    }
  }, [unlinkConfirm, store, persist, activePanel, closePanel])

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
        .filter((s) => s.status === 'sent' || s.status === 'queued')
        .map((s) => normalizeEmail(s.email))
    )
    const byCreator = buildProfilesByCreatorIdMap(store)
    const contactsBy = new Map<string, CreatorContact[]>()
    for (const c of store.contacts) {
      if (!c.creatorId) continue
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
            p.displayName.toLowerCase().includes(q) ||
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
          contactPhoneMatchesQuery(contact.phone, q) ||
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
          p.displayName.toLowerCase().includes(q) ||
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
      if (
        p.handle.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q)
      ) {
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
      const creator = c.creatorId ? creatorsById.get(c.creatorId) : undefined
      return (
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        contactPhoneMatchesQuery(c.phone, q) ||
        c.notes.toLowerCase().includes(q) ||
        contactCrmStatusLabel(c.status).toLowerCase().includes(q) ||
        c.missiveConversationIds.some((id) => id.toLowerCase().includes(q)) ||
        (creator?.displayName.toLowerCase().includes(q) ?? false) ||
        (!c.creatorId && 'unlinked'.includes(q))
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
          <CreatorAvatar
            creator={creator}
            profiles={profiles}
            className={isKanban ? 'h-7 w-7 shrink-0' : undefined}
          />
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
                <span className="min-w-0 truncate" title={profilePrimaryLabel(profile)}>
                  {profilePrimaryLabel(profile)}
                </span>
              </span>
              <span className="text-xs text-gray-500 mt-0.5 block truncate">@{profile.handle}</span>
              {profileFollowerLabel(profile.followerCount) ? (
                <span className="text-xs text-gray-400 mt-0.5 block">
                  {profileFollowerLabel(profile.followerCount)}
                </span>
              ) : null}
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
    const creator = contact.creatorId ? creatorsById.get(contact.creatorId) : undefined
    const metaLabel = [
      contactKindLabel(contact.kind),
      contact.company || null,
      creator?.displayName ?? (contact.creatorId ? null : 'Unlinked'),
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
            {contact.phone ? (
              <p className="text-xs text-gray-500 mt-0.5 truncate" title={contact.phone}>
                {formatPhoneForDisplay(contact.phone)}
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
      ? (profilesByCreatorId.get(selectedCreator.id) ?? [])
      : []
  const panelHeaderCreatorProfiles = panelHeaderCreator
    ? (profilesByCreatorId.get(panelHeaderCreator.id) ?? [])
    : []
  const creatorContacts =
    store && selectedCreator ? getContactsForCreator(store, selectedCreator.id) : []

  const panelFooter = useMemo(() => {
    if (!activePanel) return null

    if (activePanel.type === 'creator' && selectedCreator) {
      const profileCount = creatorProfiles.length
      const contactCount = creatorContacts.length
      return (
        <PanelDeleteFooter
          buttonLabel="Delete creator"
          title="Delete creator?"
          description={
            profileCount > 0 || contactCount > 0
              ? `This permanently deletes ${selectedCreator.displayName} and all ${contactCount} contact${contactCount === 1 ? '' : 's'}. Linked profiles (${profileCount}) will become unlinked, not deleted.`
              : `This permanently deletes ${selectedCreator.displayName}.`
          }
          onConfirm={async () => {
            await runPipelineMutation({
              action: 'deleteCreator',
              creatorId: selectedCreator.id,
            })
            closePanel()
            notifySuccess(`Deleted ${selectedCreator.displayName}.`)
          }}
        />
      )
    }

    if (activePanel.type === 'profile' && selectedProfile) {
      return (
        <div className="flex w-full flex-col gap-2">
          {selectedProfile.creatorId && panelHeaderCreator ? (
            <PanelUnlinkFooter
              onUnlink={() => requestUnlinkProfile(selectedProfile, panelHeaderCreator)}
            />
          ) : null}
          <PanelDeleteFooter
            buttonLabel="Delete profile"
            title="Delete profile?"
            description={`This permanently deletes @${selectedProfile.handle} (${platformLabel(selectedProfile.platform)}) and removes it from the pipeline.`}
            onConfirm={async () => {
              await runPipelineMutation({
                action: 'deleteProfile',
                profileId: selectedProfile.id,
              })
              closePanel()
              notifySuccess(`Deleted @${selectedProfile.handle}.`)
            }}
          />
        </div>
      )
    }

    if (activePanel.type === 'contact' && selectedContact) {
      return (
        <div className="flex w-full flex-col gap-2">
          {selectedContact.creatorId && panelHeaderCreator ? (
            <PanelUnlinkFooter
              onUnlink={() => requestUnlinkContact(selectedContact, panelHeaderCreator)}
            />
          ) : null}
          <PanelDeleteFooter
            buttonLabel="Delete contact"
            title="Delete contact?"
            description={`This permanently deletes ${selectedContact.name} (${contactKindLabel(selectedContact.kind)}) and related outreach records.`}
            onConfirm={async () => {
              await runPipelineMutation({
                action: 'removeContact',
                contactId: selectedContact.id,
              })
              panelGoBack()
              notifySuccess(`Deleted contact ${selectedContact.name}.`)
            }}
          />
        </div>
      )
    }

    return null
  }, [
    activePanel,
    selectedCreator,
    selectedProfile,
    selectedContact,
    creatorProfiles.length,
    creatorContacts.length,
    runPipelineMutation,
    closePanel,
    panelGoBack,
    panelHeaderCreator,
    requestUnlinkProfile,
    requestUnlinkContact,
  ])

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
      const hint = loadError.includes('fetch failed')
        ? 'Could not reach Supabase from the dev server. Check NEXT_PUBLIC_SUPABASE_URL, restart npm run dev, and try disabling VPN.'
        : loadError.includes('Server not configured') ||
            loadError.includes('SUPABASE_SERVICE_ROLE_KEY')
          ? 'Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API), then restart the dev server.'
          : loadError.includes('schema') || loadError.includes('PGRST')
            ? 'Expose the creator_pipeline schema in Supabase → Project Settings → API → Exposed schemas, and run pending migrations.'
            : 'Check the terminal for GET /api/creator-pipeline and fix the error shown there.'
      return (
        <div className="px-5 sm:px-8 lg:px-10 py-12">
          <p className="text-sm text-red-600">{loadError}</p>
          <p className="text-xs text-gray-500 mt-2">{hint}</p>
        </div>
      )
    }
    return <CreatorOutreachLoading variant="pipeline" />
  }

  const panelTitle =
    activePanel &&
    (activePanel.type === 'scout' ||
      activePanel.type === 'quick-add' ||
      activePanel.type === 'create-creator' ||
      activePanel.type === 'create-contact') ? (
      addPanelTitle(activePanel)
    ) : panelHeaderCreator ? (
      <CreatorSheetHeader
        creator={panelHeaderCreator}
        profiles={panelHeaderCreatorProfiles}
        editing={editingCreatorName}
        nameDraft={creatorNameDraft}
        onNameDraftChange={setCreatorNameDraft}
        onStartEdit={() => setEditingCreatorName(true)}
        onSave={saveCreatorDisplayName}
        onCancel={cancelCreatorDisplayName}
        onAvatarClick={
          activePanel?.type === 'creator'
            ? () => setAvatarPhotoPickerCreatorId(panelHeaderCreator.id)
            : undefined
        }
      />
    ) : activePanel?.type === 'profile' && selectedProfile && !selectedProfile.creatorId ? (
      <span className="inline-flex items-center gap-2 min-w-0 w-full">
        <ProfileAvatar profile={selectedProfile} className="h-7 w-7 shrink-0" />
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 shrink-0"
          onClick={() => setLinkProfileId(selectedProfile.id)}
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          Link to creator
        </button>
      </span>
    ) : (
      ''
    )

  return (
    <div className="flex h-full min-h-0 flex-1 w-full overflow-hidden">
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-5 sm:px-8 lg:px-10 py-8">
        <h1 className="text-lg font-semibold text-gray-900 mb-6">Creator Pipeline</h1>

      <p className="text-xs text-gray-400 mb-4">
        {summary}
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
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-2.5 text-xs"
            title="Paste a TikTok or Instagram profile URL"
            onClick={() => openScoutPanel('quick-add')}
          >
            <Zap className="h-3.5 w-3.5" />
            Quick Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            title={
              pipelineFilter === 'creators'
                ? 'Add creator'
                : pipelineFilter === 'contacts'
                  ? 'Add contact'
                  : 'Scout profile'
            }
            onClick={() => {
              if (pipelineFilter === 'profiles' || pipelineFilter === 'all') {
                openScoutPanel('default')
              } else {
                openRootPanel(addPanelForFilter(pipelineFilter))
              }
            }}
          >
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

      <CreatorAvatarPhotoDialog
        open={Boolean(avatarPhotoPickerCreatorId)}
        creator={
          avatarPhotoPickerCreatorId
            ? (store.creators.find((c) => c.id === avatarPhotoPickerCreatorId) ?? null)
            : null
        }
        profiles={
          avatarPhotoPickerCreatorId
            ? (profilesByCreatorId.get(avatarPhotoPickerCreatorId) ?? [])
            : []
        }
        onOpenChange={(open) => !open && setAvatarPhotoPickerCreatorId(null)}
        onSelect={(avatarProfileId) => {
          if (!avatarPhotoPickerCreatorId) return
          const next = structuredClone(store)
          updateCreator(next, avatarPhotoPickerCreatorId, { avatarProfileId })
          voidPersist(next)
          setAvatarPhotoPickerCreatorId(null)
        }}
      />

      <UnlinkConfirmDialog
        open={Boolean(unlinkConfirm)}
        target={unlinkConfirm}
        creatorProfiles={
          unlinkConfirm
            ? (profilesByCreatorId.get(unlinkConfirm.creator.id) ?? [])
            : []
        }
        onOpenChange={(open) => !open && setUnlinkConfirm(null)}
        onConfirm={confirmUnlink}
      />

      <LinkUnlinkedProfilesForCreatorDialog
        open={Boolean(linkProfilesForCreatorId)}
        targetCreator={
          linkProfilesForCreatorId
            ? (store.creators.find((c) => c.id === linkProfilesForCreatorId) ?? null)
            : null
        }
        profiles={store.profiles.filter((p) => !p.creatorId)}
        onOpenChange={(open) => !open && setLinkProfilesForCreatorId(null)}
        onLink={(profileId) => {
          if (!linkProfilesForCreatorId) return
          const next = structuredClone(store)
          linkProfileToCreator(next, profileId, linkProfilesForCreatorId)
          voidPersist(next)
          setLinkProfilesForCreatorId(null)
          notifySuccess('Profile linked to this creator.')
        }}
      />

      <LinkContactToCreatorDialog
        open={Boolean(linkContactsForCreatorId)}
        targetCreator={
          linkContactsForCreatorId
            ? (store.creators.find((c) => c.id === linkContactsForCreatorId) ?? null)
            : null
        }
        store={store}
        onOpenChange={(open) => !open && setLinkContactsForCreatorId(null)}
        onLink={(contactId) => {
          if (!linkContactsForCreatorId) return
          const next = structuredClone(store)
          linkContactToCreator(next, contactId, linkContactsForCreatorId)
          voidPersist(next)
          setLinkContactsForCreatorId(null)
          notifySuccess('Contact linked to this creator.')
        }}
      />

      <LinkProfileDialog
        open={Boolean(linkProfileId)}
        profile={store.profiles.find((p) => p.id === linkProfileId) ?? null}
        creators={store.creators}
        profilesByCreatorId={profilesByCreatorId}
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
        footer={panelFooter}
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
        {activePanel?.type === 'quick-add' && (
          <QuickAddQueuePanel
            store={store}
            profilesByCreatorId={profilesByCreatorId}
            sentEmailSet={sentEmailSet}
            saving={saving}
            currentUserId={currentUserId}
            onStoreUpdated={(saved, outreach, missiveSent, missiveFailed, lastMissiveError) => {
              setStore(saved)
              handleOutreachResult({ outreach, missiveSent, missiveFailed, lastMissiveError })
            }}
            onSavingChange={setSaving}
          />
        )}
        {activePanel?.type === 'scout' && (
          <ScoutProfilePanel
            store={store}
            profilesByCreatorId={profilesByCreatorId}
            sentEmailSet={sentEmailSet}
            initialLinkCreatorId={scoutLinkCreatorId}
            focusUrlImport
            onSave={(input) => {
              if (!currentUserId) {
                notifyError('You must be signed in to scout profiles.')
                return
              }
              void runPipelineMutation({
                action: 'scoutProfile',
                input: { ...input, scoutedBy: currentUserId },
              })
                .then(() => closePanel())
                .catch(() => {})
            }}
            saving={saving}
          />
        )}
        {activePanel?.type === 'create-creator' && (
          <CreateCreatorPanel
            onSave={({ displayName, notes }) => {
              const next = structuredClone(store)
              const created = createCreator(next, displayName)
              if (notes.trim()) {
                updateCreator(next, created.id, { notes: notes.trim() })
              }
              voidPersist(next)
              closePanel()
            }}
          />
        )}
        {activePanel?.type === 'create-contact' && (
          <CreateContactPanel
            store={store}
            onSave={(input) => {
              const next = structuredClone(store)
              const { store: updated } = addCreatorContact(next, input)
              voidPersist(updated)
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
            onRequestUnlinkContact={(contact) =>
              requestUnlinkContact(contact, selectedCreator)
            }
            onRequestUnlinkProfile={(profile) =>
              requestUnlinkProfile(profile, selectedCreator)
            }
            onAddContact={(input) => {
              const next = structuredClone(store)
              const { store: updated } = addCreatorContact(next, {
                creatorId: selectedCreator.id,
                ...input,
              })
              voidPersist(updated)
            }}
            onRemoveContact={(contactId) => {
              void runPipelineMutation({ action: 'removeContact', contactId })
            }}
            onLinkProfile={() => setLinkProfilesForCreatorId(selectedCreator.id)}
            onAddProfile={() => {
              setScoutLinkCreatorId(selectedCreator.id)
              openScoutPanel('default')
            }}
            onLinkContact={() => setLinkContactsForCreatorId(selectedCreator.id)}
          />
        )}
        {activePanel?.type === 'profile' && selectedProfile && (
          <ProfileDetailPanel
            profile={selectedProfile}
            onSave={(patch) => {
              const next = structuredClone(store)
              updateProfile(next, selectedProfile.id, patch)
              voidPersist(next)
            }}
          />
        )}
        {activePanel?.type === 'contact' && selectedContact && (
          <ContactDetailPanel
            contact={selectedContact}
            store={store}
            sentEmailSet={sentEmailSet}
            onSave={(patch) => {
              const next = structuredClone(store)
              const { store: updated } = updateCreatorContact(
                next,
                selectedContact.id,
                patch
              )
              voidPersist(updated)
            }}
          />
        )}
      </OutreachPushPanel>
    </div>
  )
}

function CreateCreatorPanel({
  onSave,
}: {
  onSave: (input: { displayName: string; notes: string }) => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [notes, setNotes] = useState('')

  const submit = () => {
    const trimmed = displayName.trim()
    if (!trimmed) {
      notifyError('Display name required.')
      return
    }
    onSave({ displayName: trimmed, notes })
    setDisplayName('')
    setNotes('')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-wider text-gray-400">Display name</p>
        <Input
          className="h-9"
          placeholder="Creator name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <NotesField
        value={notes}
        onChange={setNotes}
        placeholder="Optional"
      />
      <Button size="sm" className="w-full" onClick={submit}>
        Add creator
      </Button>
    </div>
  )
}

function CreateContactPanel({
  store,
  onSave,
}: {
  store: CreatorOutreachStore
  onSave: (input: Parameters<typeof addCreatorContact>[1]) => void
}) {
  const [creatorId, setCreatorId] = useState('')
  const [contactKind, setContactKind] = useState<CreatorContactKind>('creator')
  const [contactName, setContactName] = useState('')
  const [contactCompany, setContactCompany] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactNotes, setContactNotes] = useState('')

  const submit = () => {
    if (!creatorId) {
      notifyError('Select a creator.')
      return
    }
    if (!contactName.trim()) {
      notifyError('Contact name required.')
      return
    }
    if (contactPhone.trim() && !isValidPhoneInput(contactPhone)) {
      notifyError('Enter a valid phone number (include country code, e.g. +1 …).')
      return
    }
    onSave({
      creatorId,
      kind: contactKind,
      name: contactName,
      company: contactCompany,
      email: contactEmail,
      phone: contactPhone,
      notes: contactNotes,
    })
    setCreatorId('')
    setContactKind('creator')
    setContactName('')
    setContactCompany('')
    setContactEmail('')
    setContactPhone('')
    setContactNotes('')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-wider text-gray-400">Creator</p>
        <CreatorPicker
          creators={store.creators}
          profilesByCreatorId={buildProfilesByCreatorIdMap(store)}
          value={creatorId}
          onChange={setCreatorId}
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-wider text-gray-400">Type</p>
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
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-wider text-gray-400">Name</p>
        <Input
          className="h-9"
          placeholder="Contact name"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />
      </div>
      {contactKind === 'agency' && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Company</p>
          <Input
            className="h-9"
            placeholder="Company"
            value={contactCompany}
            onChange={(e) => setContactCompany(e.target.value)}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-wider text-gray-400">Email</p>
        <Input
          type="email"
          className="h-9 font-mono text-xs"
          placeholder="Optional"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-wider text-gray-400">Phone</p>
        <Input
          type="tel"
          className="h-9 text-xs"
          placeholder="Optional (+1 …)"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
        />
      </div>
      <NotesField
        value={contactNotes}
        onChange={setContactNotes}
        placeholder="Optional"
      />
      <Button size="sm" className="w-full" onClick={submit}>
        Add contact
      </Button>
    </div>
  )
}

function QuickAddWarnings({ warnings }: { warnings: QuickAddPlanWarning[] }) {
  if (warnings.length === 0) return null
  return (
    <ul className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
      {warnings.map((w, i) => (
        <li
          key={`${w.code}-${i}`}
          className={cn(
            'text-xs',
            w.severity === 'block' ? 'text-red-700 font-medium' : 'text-amber-900'
          )}
        >
          {w.message}
        </li>
      ))}
    </ul>
  )
}

function QuickAddQueuePanel({
  store,
  profilesByCreatorId,
  sentEmailSet,
  saving,
  currentUserId,
  onStoreUpdated,
  onSavingChange,
}: {
  store: CreatorOutreachStore
  profilesByCreatorId: Map<string, SocialMediaProfile[]>
  sentEmailSet: Set<string>
  saving: boolean
  currentUserId: string | null
  onStoreUpdated: (
    saved: CreatorOutreachStore,
    outreach?: import('@/lib/creator-outreach/rules-engine').EvaluateOutreachResult,
    missiveSent?: number,
    missiveFailed?: number,
    lastMissiveError?: string
  ) => void
  onSavingChange: (saving: boolean) => void
}) {
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [notesByJobId, setNotesByJobId] = useState<Record<string, string>>({})
  const [reviewJobId, setReviewJobId] = useState<string | null>(null)
  const [enqueueing, setEnqueueing] = useState(false)
  const [autoAccept, setAutoAccept] = useQuickAddAutoAcceptPreference()
  const urlInputRef = useRef<HTMLInputElement>(null)

  const { jobs, enqueueUrl: enqueueJob, confirmJob, retryJob, runAutoAccept } =
    useQuickAddJobs(currentUserId)

  useEffect(() => {
    const focusId = requestAnimationFrame(() => {
      urlInputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(focusId)
  }, [])

  const reviewJob = jobs.find((j) => j.id === reviewJobId) ?? null
  const reviewPlan = reviewJob?.plan ?? null

  useEffect(() => {
    if (reviewJobId && jobs.some((j) => j.id === reviewJobId)) return
    const nextReady = jobs
      .filter((j) => j.status === 'ready' && !j.optimistic)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
    if (nextReady) setReviewJobId(nextReady.id)
  }, [jobs, reviewJobId])

  const performConfirm = useCallback(
    async (jobId: string, notes: string, options?: { force?: boolean; allowAuto?: boolean }) => {
      onSavingChange(true)
      try {
        const { store: saved, outreach, missiveSent, missiveFailed, lastMissiveError } =
          await confirmJob(jobId, notes, options)
        onStoreUpdated(saved, outreach, missiveSent, missiveFailed, lastMissiveError)
        const job = jobs.find((j) => j.id === jobId)
        const handle = job?.resolved?.username?.replace(/^@/, '') ?? 'profile'
        if (!options?.allowAuto) {
          notifySuccess(`Added @${handle} to CRM`)
        }
        setReviewJobId(null)
      } catch (err) {
        notifyError(err instanceof Error ? err.message : 'Failed to save')
        throw err
      } finally {
        onSavingChange(false)
      }
    },
    [confirmJob, jobs, onSavingChange, onStoreUpdated]
  )

  useEffect(() => {
    if (!autoAccept || saving) return
    void runAutoAccept(autoAccept, (jobId, notes) =>
      performConfirm(jobId, notes, { allowAuto: true })
    ).then((count) => {
      if (count > 0) {
        notifySuccess(
          count === 1 ? '1 profile auto-added to CRM' : `${count} profiles auto-added to CRM`
        )
      }
    })
  }, [autoAccept, saving, jobs, runAutoAccept, performConfirm])

  const enqueueUrl = async () => {
    const url = urlInput.trim()
    const validation = validateSocialProfileUrl(url)
    if (!validation.ok) {
      setUrlError(validation.error)
      notifyError(validation.error)
      return
    }
    setUrlError(null)
    setEnqueueing(true)
    try {
      const added = await enqueueJob(url)
      if (added) setReviewJobId((current) => current ?? added.id)
      setUrlInput('')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to enqueue')
    } finally {
      setEnqueueing(false)
    }
  }

  const confirmReview = async (force = false) => {
    if (!reviewJob?.resolved || !reviewPlan) {
      notifyError('Nothing to confirm.')
      return
    }
    const notes = notesByJobId[reviewJob.id] ?? ''
    await performConfirm(reviewJob.id, notes, { force })
  }

  const activeJobs = jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled')
  const readyCount = jobs.filter((j) => j.status === 'ready').length
  const hasBlock = reviewJob?.warnings.some((w) => w.severity === 'block') ?? false

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
        <div className="min-w-0">
          <Label htmlFor="quick-add-auto" className="text-xs font-medium text-gray-900">
            Auto-accept
          </Label>
          <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
            Adds ready profiles automatically in queue order (new or existing). Hard conflicts
            still need manual review.
          </p>
        </div>
        <Switch
          id="quick-add-auto"
          checked={autoAccept}
          onCheckedChange={setAutoAccept}
          disabled={saving}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Profile URL</p>
          {readyCount > 0 ? (
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              {readyCount} ready
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Input
            ref={urlInputRef}
            className={cn('h-9 flex-1', urlError && 'border-red-300 focus-visible:ring-red-200')}
            placeholder="https://www.tiktok.com/@username or https://www.instagram.com/username"
            value={urlInput}
            onChange={(e) => {
              const value = e.target.value
              setUrlInput(value)
              if (!value.trim()) {
                setUrlError(null)
              } else {
                const v = validateSocialProfileUrl(value)
                setUrlError(v.ok ? null : v.error)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void enqueueUrl()
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 shrink-0"
            disabled={
              enqueueing ||
              !urlInput.trim() ||
              !validateSocialProfileUrl(urlInput.trim()).ok
            }
            onClick={() => void enqueueUrl()}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add to queue</span>
          </Button>
        </div>
        {urlError ? <p className="text-xs text-red-600">{urlError}</p> : null}
      </div>

      {activeJobs.length > 0 ? (
        <ul className="space-y-1.5 max-h-36 overflow-y-auto">
          {activeJobs.map((job) => {
            const isReviewing = job.id === reviewJobId
            const label =
              job.resolved?.name?.trim() ||
              job.resolved?.username ||
              job.url.replace(/^https?:\/\//, '').slice(0, 40)
            const isBusy =
              job.status === 'pending' ||
              job.status === 'scraping' ||
              job.status === 'confirming'
            return (
              <li
                key={job.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors',
                  isReviewing
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                )}
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />
                ) : job.status === 'failed' ? (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-red-100" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-emerald-500" />
                )}
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  disabled={job.status !== 'ready' && job.status !== 'failed'}
                  onClick={() => {
                    if (job.status === 'ready') setReviewJobId(job.id)
                  }}
                >
                  <p className="text-xs font-medium text-gray-900 truncate">{label}</p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {job.optimistic
                      ? 'Saving to server queue…'
                      : job.status === 'pending'
                      ? 'Queued…'
                      : job.status === 'scraping'
                        ? 'Loading profile…'
                        : job.status === 'confirming'
                          ? 'Saving to CRM…'
                          : job.status === 'failed'
                            ? job.errorMessage
                            : job.resolved
                              ? `@${job.resolved.username.replace(/^@/, '')}`
                              : job.url}
                  </p>
                </button>
                {job.status === 'failed' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs shrink-0"
                    onClick={() => {
                      void retryJob(job.id).catch((err) =>
                        notifyError(err instanceof Error ? err.message : 'Retry failed')
                      )
                    }}
                  >
                    Retry
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {reviewJob?.resolved && reviewPlan ? (
        <div className="space-y-4 pt-1 border-t border-gray-100">
          {autoAccept && reviewJob.autoConfirmEligible && !hasBlock ? (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              Auto-accept is on — this profile will be added without a click when it is next in
              queue.
            </p>
          ) : null}
          {reviewJob.readyAhead && reviewJob.readyAhead > 0 ? (
            <p className="text-xs text-amber-800">
              {reviewJob.readyAhead} profile(s) ahead in queue — confirm in order when possible.
            </p>
          ) : null}
          <QuickAddWarnings warnings={reviewJob.warnings} />
          <ImportProfilePreviewRow
            platform={reviewJob.resolved.platform}
            displayName={reviewJob.resolved.name.trim() || reviewJob.resolved.username}
            handle={reviewJob.resolved.username}
            followerCount={reviewJob.resolved.followerCount}
            avatarSrc={profilePicturePreviewUrl(reviewJob.resolved.profilePicture)}
          />
          <QuickAddPlanPreviews
            plan={reviewPlan}
            store={store}
            profilesByCreatorId={profilesByCreatorId}
            platform={reviewJob.resolved.platform}
            handle={reviewJob.resolved.username}
            displayName={reviewJob.resolved.name.trim() || reviewJob.resolved.username}
            followerCount={reviewJob.resolved.followerCount}
            profilePicture={reviewJob.resolved.profilePicture}
            profileUrl={reviewJob.resolved.profileUrl}
            sentEmailSet={sentEmailSet}
          />
          <NotesField
            value={notesByJobId[reviewJob.id] ?? ''}
            onChange={(notes) => {
              setNotesByJobId((prev) => ({ ...prev, [reviewJob.id]: notes }))
            }}
            placeholder="Optional"
          />
          {!(autoAccept && reviewJob.autoConfirmEligible && !hasBlock) ? (
            <Button
              size="sm"
              className="w-full"
              disabled={saving || reviewJob.status === 'confirming' || hasBlock}
              onClick={() => void confirmReview()}
            >
              {saving || reviewJob.status === 'confirming' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Saving…
                </>
              ) : (
                'Confirm & add to CRM'
              )}
            </Button>
          ) : null}
          {hasBlock ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full text-red-700 border-red-200"
              disabled={saving || reviewJob.status === 'confirming'}
              onClick={() => void confirmReview(true)}
            >
              Confirm anyway (override)
            </Button>
          ) : null}
        </div>
      ) : activeJobs.some((j) => j.status === 'pending' || j.status === 'scraping') ? (
        <p className="text-xs text-gray-400 text-center py-4">
          Add more URLs while profiles load. Review will open when the next one is ready.
        </p>
      ) : null}
    </div>
  )
}

function ScoutProfilePanel({
  store,
  profilesByCreatorId,
  sentEmailSet,
  initialLinkCreatorId = null,
  focusUrlImport = false,
  onSave,
}: {
  store: CreatorOutreachStore
  profilesByCreatorId: Map<string, SocialMediaProfile[]>
  sentEmailSet: Set<string>
  /** When set, creator link is pre-filled to this person (Add & link from creator sheet). */
  initialLinkCreatorId?: string | null
  focusUrlImport?: boolean
  onSave: (input: Parameters<typeof scoutProfile>[1]) => void
  saving?: boolean
}) {
  const [profileUrlInput, setProfileUrlInput] = useState('')
  const [resolvedProfileUrl, setResolvedProfileUrl] = useState<string | undefined>()
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [platform, setPlatform] = useState<OutreachPlatform | null>(null)
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [notes, setNotes] = useState('')
  const [linkMode, setLinkMode] = useState<'none' | 'existing' | 'new'>(
    initialLinkCreatorId ? 'existing' : 'none'
  )
  const [creatorId, setCreatorId] = useState(initialLinkCreatorId ?? '')
  const [newCreatorName, setNewCreatorName] = useState('')
  const [draftContact, setDraftContact] = useState<DraftContactFromProfile | null>(null)
  const [addDraftContact, setAddDraftContact] = useState(true)
  const [followerCount, setFollowerCount] = useState<number | null>(null)

  useEffect(() => {
    if (initialLinkCreatorId) {
      setLinkMode('existing')
      setCreatorId(initialLinkCreatorId)
    }
  }, [initialLinkCreatorId])

  const reset = () => {
    setProfileUrlInput('')
    setResolvedProfileUrl(undefined)
    setProfilePicture(null)
    setPlatform(null)
    setHandle('')
    setDisplayName('')
    setNotes('')
    setLinkMode('none')
    setCreatorId('')
    setNewCreatorName('')
    setDraftContact(null)
    setAddDraftContact(true)
    setFollowerCount(null)
  }

  const applyResolvedProfile = (data: {
    platform: OutreachPlatform
    username: string
    name: string
    profilePicture: string | null
    followerCount?: number | null
    profileUrl: string
    draftContact?: DraftContactFromProfile | null
  }) => {
    setPlatform(data.platform)
    setHandle(data.username)
    setDisplayName(data.name?.trim() || data.username)
    setResolvedProfileUrl(data.profileUrl)
    setProfilePicture(data.profilePicture)
    setFollowerCount(data.followerCount ?? null)
    setDraftContact(data.draftContact ?? null)
    setAddDraftContact(Boolean(data.draftContact))
    if (data.name && data.name !== data.username) {
      setLinkMode('new')
      setNewCreatorName(data.name)
    }
  }

  const importFromUrl = async () => {
    const url = profileUrlInput.trim()
    if (!url) {
      notifyError('Paste a TikTok or Instagram profile URL.')
      return
    }
    const validation = validateSocialProfileUrl(url)
    if (!validation.ok) {
      notifyError(validation.error)
      return
    }
    setImporting(true)
    try {
      const response = await fetch('/api/creator-outreach/resolve-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await response.json()
      if (!response.ok) {
        notifyError(data.error ?? 'Could not load profile.')
        return
      }
      applyResolvedProfile(data)
      const parts = [`Loaded @${data.username}`]
      if (data.followerCount != null) {
        parts.push(`${formatFollowerCountShort(data.followerCount)} followers`)
      }
      if (data.draftContact) {
        parts.push(`email ${data.draftContact.email}`)
      }
      notifySuccess(parts.join(' · '))
    } catch {
      notifyError('Failed to load profile.')
    } finally {
      setImporting(false)
    }
  }

  const submit = () => {
    if (!platform) {
      notifyError('Select a platform.')
      return
    }
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
    const willLinkCreator = linkMode === 'existing' || linkMode === 'new'
    if (addDraftContact && draftContact && !willLinkCreator) {
      notifyError('Link an existing or new creator to save the scraped email as a contact.')
      return
    }

    onSave({
      platform,
      handle,
      displayName: displayName.trim() || handle.trim(),
      profileUrl: resolvedProfileUrl,
      profilePictureSourceUrl: profilePicture,
      followerCount,
      notes,
      creatorId: linkMode === 'existing' ? creatorId : null,
      newCreatorName: linkMode === 'new' ? newCreatorName : undefined,
      draftContact:
        addDraftContact && draftContact && willLinkCreator ? draftContact : null,
    })
    reset()
  }

  const avatarPreviewSrc = profilePicturePreviewUrl(profilePicture)

  return (
    <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-400">Profile URL</p>
            <div className="flex gap-2">
              <Input
                className="h-9 flex-1"
                placeholder="https://www.tiktok.com/@… or https://www.instagram.com/…"
                value={profileUrlInput}
                onChange={(e) => setProfileUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void importFromUrl()
                }}
                autoFocus={focusUrlImport}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 shrink-0"
                disabled={importing || !profileUrlInput.trim()}
                onClick={() => void importFromUrl()}
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Import'
                )}
              </Button>
            </div>
          </div>

          {(profilePicture || (platform && handle)) && platform ? (
            <ImportProfilePreviewRow
              platform={platform}
              displayName={displayName.trim() || handle}
              handle={handle}
              followerCount={followerCount}
              avatarSrc={avatarPreviewSrc}
            />
          ) : null}

          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-400">Platform</p>
            <PlatformPicker value={platform} onChange={setPlatform} />
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
            <p className="text-[11px] uppercase tracking-wider text-gray-400">Profile name</p>
            <Input
              className="h-9"
              placeholder="Display name from platform"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-400">Creator</p>
            <Select
              value={linkMode}
              onValueChange={(v) => {
                const mode = v as typeof linkMode
                setLinkMode(mode)
                if (mode !== 'existing') setCreatorId('')
              }}
            >
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
              <CreatorPicker
                creators={store.creators}
                profilesByCreatorId={profilesByCreatorId}
                value={creatorId}
                onChange={setCreatorId}
              />
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

          {draftContact ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="scout-add-draft-contact"
                  className="mt-1 h-3.5 w-3.5 rounded border-gray-300"
                  checked={addDraftContact}
                  onChange={(e) => setAddDraftContact(e.target.checked)}
                />
                <label htmlFor="scout-add-draft-contact" className="min-w-0 flex-1 cursor-pointer">
                  <p className="text-sm font-medium text-gray-900">Add contact from profile</p>
                  <p className="font-mono text-xs text-gray-700 mt-0.5">{draftContact.email}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    From {platform ? draftContactSourceLabel(draftContact.source, platform) : 'profile'}
                    {linkMode === 'none' ? ' · link a creator to save' : ''}
                  </p>
                </label>
              </div>
            </div>
          ) : null}

          <NotesField value={notes} onChange={setNotes} placeholder="Optional" />

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
  onRequestUnlinkProfile,
  onRequestUnlinkContact,
  onAddContact,
  onRemoveContact,
  onLinkProfile,
  onAddProfile,
  onLinkContact,
}: {
  creator: CreatorPerson
  profiles: SocialMediaProfile[]
  contacts: CreatorContact[]
  store: CreatorOutreachStore
  sentEmailSet: Set<string>
  onSelectProfile: (id: string) => void
  onSelectContact: (id: string) => void
  onSaveCreator: (
    patch: Partial<Pick<CreatorPerson, 'displayName' | 'notes' | 'avatarProfileId'>>
  ) => void
  onRequestUnlinkProfile: (profile: SocialMediaProfile) => void
  onRequestUnlinkContact: (contact: CreatorContact) => void
  onAddContact: (input: {
    kind: CreatorContactKind
    name: string
    company?: string
    email?: string
    phone?: string
    notes?: string
  }) => void
  onRemoveContact: (contactId: string) => void
  onLinkProfile: () => void
  onAddProfile: () => void
  onLinkContact: () => void
}) {
  const sheetSectionActionClass =
    'inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900 shrink-0'

  const [notes, setNotes] = useState('')
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactKind, setContactKind] = useState<CreatorContactKind>('creator')
  const [contactName, setContactName] = useState('')
  const [contactCompany, setContactCompany] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
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
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px] uppercase tracking-wider text-gray-400">CRM status</p>
              <ContactCrmStatusBadge status={creator.status} size="md" />
            </div>
          </div>

          <NotesField
            value={notes}
            onChange={setNotes}
            dirty={notesDirty}
            onSave={() => onSaveCreator({ notes })}
          />

          <div className="pt-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] uppercase tracking-wider text-gray-400">Profiles</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  className={sheetSectionActionClass}
                  onClick={onLinkProfile}
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  Link
                </button>
                <button
                  type="button"
                  className={sheetSectionActionClass}
                  onClick={onAddProfile}
                >
                  + Add
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {profiles.map((p) => (
                <li key={p.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    className="flex-1 text-left min-w-0 flex items-start gap-2"
                    onClick={() => onSelectProfile(p.id)}
                  >
                    <ProfileAvatar profile={p} className="h-8 w-8" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium">
                        <PlatformIcon platform={p.platform} />
                        <span className="truncate">{profilePrimaryLabel(p)}</span>
                      </span>
                      <span className="text-xs text-gray-500 block truncate">@{p.handle}</span>
                      {profileFollowerLabel(p.followerCount) ? (
                        <span className="text-xs text-gray-400 block truncate">
                          {profileFollowerLabel(p.followerCount)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-400 hover:text-gray-700 p-1"
                    onClick={() => onRequestUnlinkProfile(p)}
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
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  className={sheetSectionActionClass}
                  onClick={onLinkContact}
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  Link
                </button>
                <button
                  type="button"
                  className={sheetSectionActionClass}
                  onClick={() => setShowAddContact((v) => !v)}
                >
                  {showAddContact ? 'Cancel' : '+ Add'}
                </button>
              </div>
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
                  type="tel"
                  className="h-9 text-xs"
                  placeholder="Phone (optional, +1 …)"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
                <NotesField
                  value={contactNotes}
                  onChange={setContactNotes}
                  placeholder="Optional"
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (!contactName.trim()) {
                      notifyError('Contact name required.')
                      return
                    }
                    if (contactPhone.trim() && !isValidPhoneInput(contactPhone)) {
                      notifyError('Enter a valid phone number (include country code, e.g. +1 …).')
                      return
                    }
                    onAddContact({
                      kind: contactKind,
                      name: contactName,
                      company: contactCompany,
                      email: contactEmail,
                      phone: contactPhone,
                      notes: contactNotes,
                    })
                    setContactName('')
                    setContactCompany('')
                    setContactEmail('')
                    setContactPhone('')
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
                      {c.phone ? (
                        <p className="text-xs text-gray-500 mt-0.5">{formatPhoneForDisplay(c.phone)}</p>
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
                      onClick={() => onRequestUnlinkContact(c)}
                      title="Unlink from creator"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-600 p-1 shrink-0"
                      onClick={() => onRemoveContact(c.id)}
                      title="Delete contact"
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
  onSave,
}: {
  profile: SocialMediaProfile
  onSave: (patch: Partial<Pick<SocialMediaProfile, 'notes' | 'displayName'>>) => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName)
      setNotes(profile.notes)
    }
  }, [profile])

  const displayNameDirty = displayName.trim() !== profile.displayName
  const notesDirty = notes !== profile.notes
  const dirty = displayNameDirty || notesDirty

  const save = () => {
    const patch: Partial<Pick<SocialMediaProfile, 'notes' | 'displayName'>> = {}
    if (displayNameDirty) patch.displayName = displayName.trim()
    if (notesDirty) patch.notes = notes
    onSave(patch)
  }

  return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-1">
            <ProfileAvatar profile={profile} className="h-10 w-10" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <PlatformIcon platform={profile.platform} />
                {profilePrimaryLabel(profile)}
              </p>
              <a
                href={profile.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-800 mt-0.5 inline-block"
              >
                @{profile.handle}
              </a>
              {profileFollowerLabel(profile.followerCount) ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  {profileFollowerLabel(profile.followerCount)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-400">Profile name</p>
            <Input
              className="h-9"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <NotesField value={notes} onChange={setNotes} placeholder="Notes" />

          {dirty && (
            <Button size="sm" className="w-full" onClick={save}>
              Save
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
  const [editingPhone, setEditingPhone] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [phoneDraft, setPhoneDraft] = useState('')
  const [notes, setNotes] = useState('')
  const [companyDraft, setCompanyDraft] = useState('')

  useEffect(() => {
    setEmailDraft(contact.email)
    setPhoneDraft(
      contact.phone ? formatPhoneForDisplay(contact.phone) : ''
    )
    setNotes(contact.notes)
    setCompanyDraft(contact.company)
    setEditingEmail(false)
    setEditingPhone(false)
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

  const savePhone = () => {
    const trimmed = phoneDraft.trim()
    if (trimmed && !isValidPhoneInput(trimmed)) {
      notifyError('Enter a valid phone number (include country code, e.g. +1 …).')
      return
    }
    const normalized = normalizePhone(phoneDraft)
    if (normalized !== contact.phone) {
      onSave({ phone: normalized })
    }
    setPhoneDraft(normalized ? formatPhoneForDisplay(normalized) : '')
    setEditingPhone(false)
  }

  const cancelPhone = () => {
    setPhoneDraft(contact.phone ? formatPhoneForDisplay(contact.phone) : '')
    setEditingPhone(false)
  }

  const emailSent = contact.email && hasActiveOutreachForEmail(store, contact.email)
  const phoneDisplay = contact.phone ? formatPhoneForDisplay(contact.phone) : ''
  const notesDirty = notes !== contact.notes
  const companyDirty = companyDraft !== contact.company

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ContactKindIcon kind={contact.kind} className="h-4 w-4 shrink-0" />
          <p className="text-sm font-medium text-gray-900 min-w-0 truncate">{contact.name}</p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">Contact type</p>
          <Select
            value={contact.kind}
            onValueChange={(v) => {
              const kind = v as CreatorContactKind
              if (kind !== contact.kind) onSave({ kind })
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTREACH_CONTACT_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {contactKindLabel(kind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {contact.kind === 'agency' ? (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">Company</p>
            <Input
              className="h-9"
              placeholder="Agency name"
              value={companyDraft}
              onChange={(e) => setCompanyDraft(e.target.value)}
            />
            {companyDirty ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2"
                onClick={() => onSave({ company: companyDraft })}
              >
                Save company
              </Button>
            ) : null}
          </div>
        ) : null}

        <NotesField
          value={notes}
          onChange={setNotes}
          dirty={notesDirty}
          onSave={() => onSave({ notes })}
        />
      </div>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">CRM status</p>
          <ContactCrmStatusBadge status={contact.status} size="md" />
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
            {emailDraft && !emailSent ? (
              <p className="text-[11px] text-gray-400 mt-1.5">
                New email runs Rules (see Creator Pipeline → Rules).
              </p>
            ) : null}
          </>
        )}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">Phone</p>
        {editingPhone ? (
          <div className="space-y-2">
            <Input
              type="tel"
              className="h-9 text-xs"
              placeholder="+1 415 555 2671"
              value={phoneDraft}
              onChange={(e) => setPhoneDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  savePhone()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelPhone()
                }
              }}
              autoFocus
            />
            <p className="text-[11px] text-gray-400">
              Stored in international format. Include country code (+1, +44, …) or use a local
              number (defaults to US).
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="h-8" onClick={savePhone}>
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={cancelPhone}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 min-w-0">
            {phoneDisplay ? (
              <span className="text-xs text-gray-900 truncate" title={contact.phone}>
                {phoneDisplay}
              </span>
            ) : (
              <span className="text-xs text-gray-400">No phone</span>
            )}
            <button
              type="button"
              className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              onClick={() => setEditingPhone(true)}
              title={phoneDisplay ? 'Edit phone' : 'Add phone'}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>

      <ContactMissiveSentEmails
        contactId={contact.id}
        conversationIds={contact.missiveConversationIds}
        outreachSends={store.outreachSends}
        templates={store.templates}
      />
    </div>
  )
}

function PanelUnlinkFooter({ onUnlink }: { onUnlink: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="w-full" onClick={onUnlink}>
      <Unlink className="h-3.5 w-3.5 mr-1.5" />
      Unlink
    </Button>
  )
}

function PanelDeleteFooter({
  buttonLabel,
  title,
  description,
  onConfirm,
}: {
  buttonLabel: string
  title: string
  description: string
  onConfirm: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch {
      // Error toast handled by caller
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
        {buttonLabel}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
          <p className="text-sm text-gray-500">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function LinkUnlinkedProfilesForCreatorDialog({
  open,
  targetCreator,
  profiles,
  onOpenChange,
  onLink,
}: {
  open: boolean
  targetCreator: CreatorPerson | null
  profiles: SocialMediaProfile[]
  onOpenChange: (open: boolean) => void
  onLink: (profileId: string) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter(
      (p) =>
        p.handle.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q) ||
        p.platform.toLowerCase().includes(q)
    )
  }, [profiles, query])

  if (!targetCreator) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Link profile to {targetCreator.displayName}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 leading-relaxed">
          Choose an unlinked social profile to attach to this creator.
        </p>
        {profiles.length > 3 ? (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <Input
              className="h-9 pl-8 text-xs"
              placeholder="Search by handle or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        ) : null}
        <div className="max-h-64 overflow-y-auto space-y-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">
              {profiles.length === 0
                ? 'No unlinked profiles. Use + Add to scout a new one.'
                : 'No matching profiles.'}
            </p>
          ) : (
            filtered.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className="w-full flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 text-left hover:border-gray-200 hover:bg-gray-50/80 transition-colors"
                onClick={() => onLink(profile.id)}
              >
                <ProfileAvatar profile={profile} className="h-9 w-9 shrink-0" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    <PlatformIcon platform={profile.platform} />
                    <span className="truncate">{profilePrimaryLabel(profile)}</span>
                  </span>
                  <span className="text-xs text-gray-500 block truncate">@{profile.handle}</span>
                  {profileFollowerLabel(profile.followerCount) ? (
                    <span className="text-xs text-gray-400 block truncate">
                      {profileFollowerLabel(profile.followerCount)}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LinkContactToCreatorDialog({
  open,
  targetCreator,
  store,
  onOpenChange,
  onLink,
}: {
  open: boolean
  targetCreator: CreatorPerson | null
  store: CreatorOutreachStore
  onOpenChange: (open: boolean) => void
  onLink: (contactId: string) => void
}) {
  const [query, setQuery] = useState('')
  const creatorsById = useMemo(
    () => new Map(store.creators.map((c) => [c.id, c])),
    [store.creators]
  )

  const linkableContacts = useMemo(
    () =>
      targetCreator
        ? store.contacts.filter((c) => c.creatorId !== targetCreator.id)
        : [],
    [store.contacts, targetCreator]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return linkableContacts
    return linkableContacts.filter((c) => {
      const creator = c.creatorId ? creatorsById.get(c.creatorId) : undefined
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        contactPhoneMatchesQuery(c.phone, q) ||
        (creator?.displayName.toLowerCase().includes(q) ?? false)
      )
    })
  }, [linkableContacts, query, creatorsById])

  if (!targetCreator) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Link contact to {targetCreator.displayName}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 leading-relaxed">
          Attach an unlinked contact or move one from another creator to this person.
        </p>
        {linkableContacts.length > 3 ? (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <Input
              className="h-9 pl-8 text-xs"
              placeholder="Search by name, email, phone, or creator…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        ) : null}
        <div className="max-h-64 overflow-y-auto space-y-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">
              {linkableContacts.length === 0
                ? 'No other or unlinked contacts to link.'
                : 'No matching contacts.'}
            </p>
          ) : (
            filtered.map((contact) => {
              const fromCreator = contact.creatorId
                ? creatorsById.get(contact.creatorId)
                : undefined
              return (
                <button
                  key={contact.id}
                  type="button"
                  className="w-full rounded-lg border border-gray-100 px-3 py-2.5 text-left hover:border-gray-200 hover:bg-gray-50/80 transition-colors"
                  onClick={() => onLink(contact.id)}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    <ContactKindIcon kind={contact.kind} />
                    {contact.name}
                  </span>
                  {contact.email ? (
                    <p className="font-mono text-xs text-gray-500 mt-0.5 truncate">{contact.email}</p>
                  ) : null}
                  {contact.phone ? (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {formatPhoneForDisplay(contact.phone)}
                    </p>
                  ) : null}
                  {fromCreator ? (
                    <p className="text-xs text-gray-400 mt-0.5">From {fromCreator.displayName}</p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-0.5">Unlinked</p>
                  )}
                </button>
              )
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LinkProfileDialog({
  open,
  profile,
  creators,
  profilesByCreatorId,
  onOpenChange,
  onLink,
  onCreateAndLink,
}: {
  open: boolean
  profile: SocialMediaProfile | null
  creators: CreatorPerson[]
  profilesByCreatorId: Map<string, SocialMediaProfile[]>
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
      <DialogContent className="sm:max-w-md">
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
            <CreatorPicker
              creators={creators}
              profilesByCreatorId={profilesByCreatorId}
              value={creatorId}
              onChange={setCreatorId}
            />
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

function CreatorAvatarPhotoDialog({
  open,
  creator,
  profiles,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  creator: CreatorPerson | null
  profiles: SocialMediaProfile[]
  onOpenChange: (open: boolean) => void
  onSelect: (avatarProfileId: string | null) => void
}) {
  if (!creator) return null

  const sorted = sortProfilesByScoutedAt(profiles)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Choose creator photo</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 leading-relaxed">
          Pick which linked profile picture to use for {creator.displayName}.
        </p>

        {sorted.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">
            Link a profile to choose a photo from their account.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {sorted.map((profile, index) => {
              const selected = isCreatorAvatarProfileSelected(creator, profile, sorted)
              return (
                <button
                  key={profile.id}
                  type="button"
                  title={`@${profile.handle}`}
                  onClick={() => {
                    onSelect(index === 0 ? null : profile.id)
                    onOpenChange(false)
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors min-w-0',
                    selected
                      ? 'border-gray-900 bg-white ring-1 ring-gray-900'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <ProfileAvatar profile={profile} className="h-10 w-10 shrink-0" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-xs font-medium text-gray-900">
                      <PlatformIcon platform={profile.platform} />
                      <span className="truncate">@{profile.handle}</span>
                    </span>
                    <span className="text-[10px] text-gray-400 block truncate">
                      {profilePrimaryLabel(profile)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UnlinkConfirmDialog({
  open,
  target,
  creatorProfiles,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  target:
    | { type: 'profile'; profile: SocialMediaProfile; creator: CreatorPerson }
    | { type: 'contact'; contact: CreatorContact; creator: CreatorPerson }
    | null
  creatorProfiles: SocialMediaProfile[]
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  if (!target) return null

  const { creator } = target
  const isProfile = target.type === 'profile'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isProfile ? 'Unlink profile from creator?' : 'Unlink contact from creator?'}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 leading-relaxed">
          {isProfile
            ? 'These stay separate records — only the link between them is removed. The profile moves to your unlinked list; nothing is deleted.'
            : 'The contact record is kept — only the link to this creator is removed. You can link it again from another creator or via Link on this sheet.'}
        </p>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">
            {isProfile ? 'Social profile' : 'Contact'}
          </p>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-3">
            {isProfile ? (
              <div className="flex items-start gap-3">
                <ProfileAvatar profile={target.profile} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                    <PlatformIcon platform={target.profile.platform} />
                    @{target.profile.handle}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {platformLabel(target.profile.platform)}
                  </p>
                  {profileFollowerLabel(target.profile.followerCount) ? (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {profileFollowerLabel(target.profile.followerCount)}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <ContactKindIcon kind={target.contact.kind} className="h-10 w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{target.contact.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {contactKindLabel(target.contact.kind)}
                    {target.contact.company ? ` · ${target.contact.company}` : ''}
                  </p>
                  {target.contact.email ? (
                    <p className="font-mono text-xs text-gray-400 mt-0.5 truncate">
                      {target.contact.email}
                    </p>
                  ) : null}
                  {target.contact.phone ? (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {formatPhoneForDisplay(target.contact.phone)}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 py-0.5">will be unlinked from</p>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Creator (person)</p>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-3">
            <div className="flex items-start gap-3">
              <CreatorAvatar
                creator={creator}
                profiles={creatorProfiles}
                className="h-10 w-10"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{creator.displayName}</p>
                {creator.notes.trim() ? (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{creator.notes}</p>
                ) : null}
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
