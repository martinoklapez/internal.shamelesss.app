'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import {
  Building2,
  CircleUser,
  ExternalLink,
  Loader2,
  UserRound,
} from 'lucide-react'
import { SiInstagram, SiTiktok } from 'react-icons/si'
import type {
  MissiveContextContactDto,
  MissiveContextProfileDto,
  MissiveContextResponse,
} from '@/lib/creator-outreach/lookup-missive-context'
import {
  contactCrmStatusLabel,
  CONTACT_CRM_STATUS_STYLES,
  canSetPartnershipCrmStatus,
  PARTNERSHIP_CRM_STATUS_OPTIONS,
} from '@/lib/creator-outreach/crm-status-ui'
import {
  contactKindLabel,
} from '@/lib/creator-outreach/store'
import type {
  ContactCrmStatus,
  CreatorContactKind,
  OutreachPlatform,
} from '@/lib/creator-outreach/types'
import { formatFollowerCountShort } from '@/lib/normalize-follower-count'
import { extractParticipantEmails } from '@/lib/missive/extract-conversation'
import {
  clearMissiveAuthSession,
  loadMissiveAuthSession,
  refreshMissiveSession,
  signInMissiveWithPassword,
  type MissiveAuthSession,
} from '@/lib/missive/auth-storage'
import type { MissiveConversation } from '@/lib/missive/types'
import { cn } from '@/lib/utils'

const MISSIVE_SCRIPT = 'https://integrations.missiveapp.com/missive.js'

function ContactCrmStatusBadge({ status }: { status: ContactCrmStatus }) {
  const { chip, dot } = CONTACT_CRM_STATUS_STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight ring-1 ring-inset',
        chip
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden />
      <span className="truncate">{contactCrmStatusLabel(status)}</span>
    </span>
  )
}
function PlatformIcon({
  platform,
  className,
}: {
  platform: OutreachPlatform
  className?: string
}) {
  if (platform === 'tiktok') {
    return <SiTiktok className={cn('h-3 w-3 shrink-0', className)} />
  }
  return <SiInstagram className={cn('h-3 w-3 shrink-0', className)} />
}

function ContactKindIcon({
  kind,
  className,
}: {
  kind: CreatorContactKind
  className?: string
}) {
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

function OutreachDot({ sent }: { sent: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
        sent ? 'bg-emerald-500' : 'bg-amber-400'
      )}
      title={sent ? 'Outreach sent' : 'Outreach pending'}
    />
  )
}

function profilePrimaryLabel(profile: MissiveContextProfileDto): string {
  const name = profile.displayName.trim()
  return name || `@${profile.handle.replace(/^@/, '')}`
}

function profileAvatarSrc(profile: MissiveContextProfileDto): string {
  const stored = profile.avatarUrl?.trim()
  if (stored) return stored
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(profile.id)}`
}

function ProfileRow({
  profile,
  highlight,
}: {
  profile: MissiveContextProfileDto
  highlight?: boolean
}) {
  const title = profilePrimaryLabel(profile)
  const cleanHandle = profile.handle.replace(/^@/, '')
  return (
    <li
      className={cn(
        'flex items-start gap-2 rounded-md border px-2 py-2',
        highlight ? 'border-gray-300 bg-gray-50' : 'border-gray-100'
      )}
    >
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profileAvatarSrc(profile)}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-medium text-gray-900">
          <PlatformIcon platform={profile.platform} />
          <span className="truncate">{title}</span>
        </p>
        <p className="text-xs text-gray-500">@{cleanHandle}</p>
        {profile.followerCount != null ? (
          <p className="text-xs text-gray-400">
            {formatFollowerCountShort(profile.followerCount)} followers
          </p>
        ) : null}
      </div>
    </li>
  )
}

function ContactRow({
  contact,
  highlight,
}: {
  contact: MissiveContextContactDto
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-2 py-2',
        highlight ? 'border-gray-300 bg-gray-50' : 'border-gray-100'
      )}
    >
      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-900">
        <ContactKindIcon kind={contact.kind} />
        <span>{contact.name || contact.email || 'Contact'}</span>
        <span className="text-[10px] font-normal uppercase text-gray-400">
          {contactKindLabel(contact.kind)}
        </span>
        <ContactCrmStatusBadge status={contact.status} />
      </p>
      {contact.email ? (
        <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-gray-500">
          <OutreachDot sent={contact.outreachSent} />
          <span className="truncate">{contact.email}</span>
        </p>
      ) : null}
    </div>
  )
}

function PartnershipStagePicker({
  contact,
  saving,
  error,
  onSelect,
}: {
  contact: MissiveContextContactDto
  saving: boolean
  error: string | null
  onSelect: (status: ContactCrmStatus) => void
}) {
  if (!canSetPartnershipCrmStatus(contact.status)) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
          Partnership stage
        </p>
        <ContactCrmStatusBadge status={contact.status} />
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
        Update CRM status while you work this thread in Missive.
      </p>
      <div className="mt-3 space-y-2">
        {PARTNERSHIP_CRM_STATUS_OPTIONS.map((option) => {
          const selected = contact.status === option.value
          const { dot } = CONTACT_CRM_STATUS_STYLES[option.value]
          return (
            <button
              key={option.value}
              type="button"
              disabled={saving || selected}
              onClick={() => onSelect(option.value)}
              className={cn(
                'flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors disabled:cursor-default',
                selected
                  ? 'border-gray-300 bg-white ring-1 ring-inset ring-gray-200'
                  : 'border-transparent bg-white hover:border-gray-200 hover:bg-white disabled:opacity-60'
              )}
            >
              <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-gray-900">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
                  {option.description}
                </span>
              </span>
              {selected ? (
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  Current
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {error ? <p className="mt-2 text-[11px] text-red-600">{error}</p> : null}
    </div>
  )
}

function ContextSheet({
  context,
  accessToken,
  conversationId,
  participantEmails,
  onContextUpdated,
}: {
  context: MissiveContextResponse
  accessToken: string
  conversationId: string
  participantEmails: string[]
  onContextUpdated: (next: MissiveContextResponse) => void
}) {
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const matchedContact =
    context.contacts.find((c) => c.id === context.matchedContactId) ?? context.contact

  const updatePartnershipStage = useCallback(
    async (status: ContactCrmStatus) => {
      if (!matchedContact) return
      setStatusSaving(true)
      setStatusError(null)
      try {
        const next = await updateContactCrmStatus(
          accessToken,
          matchedContact.id,
          status,
          conversationId,
          participantEmails
        )
        onContextUpdated(next)
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : 'Failed to update status')
      } finally {
        setStatusSaving(false)
      }
    },
    [accessToken, conversationId, matchedContact, onContextUpdated, participantEmails]
  )

  const pipelineHref = context.creator ? `/pipeline` : '/pipeline'

  if (!context.contact) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm text-gray-600">
          No CRM contact matches this conversation yet.
        </p>
        <p className="text-xs text-gray-400">
          Link happens automatically after outreach sends via Missive, or when the
          participant email matches a contact in Creator Pipeline.
        </p>
        <a
          href={pipelineHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
        >
          Open Pipeline
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    )
  }

  if (!context.creator) {
    return (
      <div className="space-y-4 p-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Contact
          </p>
          <div className="mt-2">
            <ContactRow contact={context.contact} highlight />
          </div>
        </div>
        {matchedContact ? (
          <PartnershipStagePicker
            contact={matchedContact}
            saving={statusSaving}
            error={statusError}
            onSelect={(status) => void updatePartnershipStage(status)}
          />
        ) : null}
        <p className="text-xs text-gray-500">
          This contact is not linked to a creator. Link them in the Pipeline app.
        </p>
        <a
          href={pipelineHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
        >
          Open Pipeline
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    )
  }

  const creator = context.creator
  const notes = creator.notes.trim()

  return (
    <div className="space-y-4 p-4 pb-6">
      <div className="flex items-start gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-violet-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={creator.avatarImageSrc}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-900">
            {creator.displayName}
          </p>
          <p className="text-xs text-gray-400">Creator Pipeline</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
          CRM status
        </p>
        <ContactCrmStatusBadge status={creator.status} />
      </div>

      {matchedContact ? (
        <PartnershipStagePicker
          contact={matchedContact}
          saving={statusSaving}
          error={statusError}
          onSelect={(status) => void updatePartnershipStage(status)}
        />
      ) : null}

      {notes ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Notes
          </p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{notes}</p>
        </div>
      ) : null}

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
          Profiles
        </p>
        {context.linkedProfiles.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {context.linkedProfiles.map((p) => (
              <ProfileRow key={p.id} profile={p} />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-gray-400">No profiles linked</p>
        )}
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
          Contacts
        </p>
        <div className="mt-2 space-y-2">
          {context.contacts.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              highlight={c.id === context.matchedContactId}
            />
          ))}
        </div>
      </div>

      <a
        href={pipelineHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50"
      >
        Open Pipeline
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}

async function fetchMissiveContext(
  accessToken: string,
  conversationId: string,
  emails: string[]
): Promise<MissiveContextResponse> {
  const params = new URLSearchParams({ conversationId })
  if (emails.length > 0) {
    params.set('emails', emails.join(','))
  }
  const res = await fetch(`/api/creator-pipeline/missive-context?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Failed to load CRM context (${res.status})`
    )
  }
  return data as MissiveContextResponse
}

async function updateContactCrmStatus(
  accessToken: string,
  contactId: string,
  status: ContactCrmStatus,
  conversationId: string,
  emails: string[]
): Promise<MissiveContextResponse> {
  const res = await fetch('/api/creator-pipeline/mutate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'updateContact',
      contactId,
      patch: { status },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Status update failed (${res.status})`)
  }

  return fetchMissiveContext(accessToken, conversationId, emails)
}

export function MissiveIntegrationPanel() {
  const [missiveReady, setMissiveReady] = useState(false)
  const [session, setSession] = useState<MissiveAuthSession | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [signInError, setSignInError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  const [context, setContext] = useState<MissiveContextResponse | null>(null)
  const [activeConversationId, setActiveConversationId] = useState('')
  const [participantEmails, setParticipantEmails] = useState<string[]>([])
  const [contextLoading, setContextLoading] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)
  const [outsideMissive, setOutsideMissive] = useState(false)

  const sessionRef = useRef<MissiveAuthSession | null>(null)
  sessionRef.current = session

  const loadContextForConversation = useCallback(
    async (conversation: MissiveConversation) => {
      const currentSession = sessionRef.current
      if (!currentSession) return

      setContextLoading(true)
      setContextError(null)
      try {
        const emails = extractParticipantEmails(conversation)
        setActiveConversationId(conversation.id)
        setParticipantEmails(emails)
        const result = await fetchMissiveContext(
          currentSession.access_token,
          conversation.id,
          emails
        )
        setContext(result)
      } catch (err) {
        setContext(null)
        setActiveConversationId('')
        setParticipantEmails([])
        setContextError(err instanceof Error ? err.message : 'Failed to load context')
      } finally {
        setContextLoading(false)
      }
    },
    []
  )

  const bindMissiveListeners = useCallback(() => {
    const Missive = window.Missive
    if (!Missive) return

    Missive.on('change:conversations', (ids: unknown) => {
      const conversationIds = Array.isArray(ids) ? (ids as string[]) : []
      if (conversationIds.length !== 1) {
        setContext(null)
        setActiveConversationId('')
        setParticipantEmails([])
        setContextError(null)
        setContextLoading(false)
        return
      }

      Missive.fetchConversations(conversationIds, ['latest_message'])
        .then((conversations) => {
          const conversation = conversations[0]
          if (!conversation) {
            setContext(null)
            return
          }
          return loadContextForConversation(conversation)
        })
        .catch((err: unknown) => {
          console.error('Missive.fetchConversations:', err)
          setContextError('Could not read conversation from Missive')
        })
    })
  }, [loadContextForConversation])

  useEffect(() => {
    let cancelled = false

    async function initAuth() {
      setAuthLoading(true)
      let loaded = await loadMissiveAuthSession()
      if (loaded) {
        const refreshed = await refreshMissiveSession(loaded.refresh_token)
        if (refreshed) loaded = refreshed
      }
      if (!cancelled) {
        setSession(loaded)
        setAuthLoading(false)
      }
    }

    void initAuth()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!missiveReady) {
      setOutsideMissive(typeof window !== 'undefined' && !window.Missive)
      return
    }
    setOutsideMissive(false)
    bindMissiveListeners()
  }, [missiveReady, bindMissiveListeners])

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSignInError(null)
    setSigningIn(true)
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim()
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    try {
      const result = await signInMissiveWithPassword(email, password)
      const nextSession = {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      }
      setSession(nextSession)
      sessionRef.current = nextSession
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setSigningIn(false)
    }
  }

  async function handleSignOut() {
    await clearMissiveAuthSession()
    setSession(null)
    setContext(null)
    sessionRef.current = null
  }

  return (
    <div className="flex min-h-svh flex-col bg-white text-gray-900">
      <Script
        src={MISSIVE_SCRIPT}
        strategy="afterInteractive"
        onLoad={() => setMissiveReady(true)}
      />

      <header className="shrink-0 border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">Shamelesss Pipeline</p>
        <p className="text-xs text-gray-400">Creator CRM context</p>
      </header>

      {authLoading ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : !session ? (
        <form className="flex flex-1 flex-col gap-3 p-4" onSubmit={handleSignIn}>
          <p className="text-xs text-gray-500">
            Sign in with your internal app account (admin, dev, or developer).
          </p>
          <label className="block text-xs font-medium text-gray-700">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm"
            />
          </label>
          {signInError ? (
            <p className="text-xs text-red-600">{signInError}</p>
          ) : null}
          <button
            type="submit"
            disabled={signingIn}
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {signingIn ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <>
          {outsideMissive ? (
            <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-900">
              Open this page inside Missive to see conversation context. You can still
              sign in here for testing.
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {contextLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading CRM context…
              </div>
            ) : contextError ? (
              <p className="p-4 text-sm text-red-600">{contextError}</p>
            ) : context ? (
              session ? (
                <ContextSheet
                  context={context}
                  accessToken={session.access_token}
                  conversationId={activeConversationId}
                  participantEmails={participantEmails}
                  onContextUpdated={setContext}
                />
              ) : null
            ) : (
              <p className="p-4 text-sm text-gray-500">
                {outsideMissive
                  ? 'Select a conversation in Missive to load creator context.'
                  : 'Select a single conversation to see CRM context.'}
              </p>
            )}
          </div>

          <footer className="shrink-0 border-t border-gray-100 px-4 py-2">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="text-[11px] text-gray-400 hover:text-gray-600"
            >
              Sign out
            </button>
          </footer>
        </>
      )}
    </div>
  )
}
