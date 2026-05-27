'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UserDialog, type UserDialogUser } from '@/components/edit-user-dialog'
import { shamelessProfileHeadline } from '@/components/shameless-profile-blocks'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Pencil, Search, Send, Trash2 } from 'lucide-react'
import type { ActivityConnectionChatPayload, ActivityConnectionChatMessageRow } from '@/lib/activity-feed-types'
import { profileGenderEmoji } from '@/lib/profile-gender-emoji'
import { cn } from '@/lib/utils'
import { ChatMessageTranslateFooter } from '@/components/chat-message-translate-footer'
import { ChatTranslateToolbar } from '@/components/chat-translate-toolbar'
import { useChatTranslation } from '@/hooks/use-chat-translation'

type ConnectionRow = {
  id: string
  status: string | null
  created_at: string | null
  peer_user_id: string | null
  last_message_at: string | null
  last_message_preview: string | null
  /** Peer messages after support’s last reply (approx. WhatsApp-style backlog). */
  unread_message_count: number
  /** True when `unread_message_count > 0` (badge / “Unread” filter). */
  unread: boolean
  /** Last chat line was from the customer, not support — needs a reply (ignores read state). */
  unreplied: boolean
  peer: {
    user_id: string
    name: string | null
    username: string | null
    profile_picture_url: string | null
    gender: string | null
  } | null
}

/** Matches GET /api/users/detail `user` payload */
type UsersDetailApiUser = {
  id: string
  name: string | null
  username: string | null
  role: string
  profile_picture_url: string | null
  age: number | null
  country_code: string | null
  gender: string | null
  instagram_handle: string | null
  snapchat_handle: string | null
  connection_count: number
  created_at: string | null
  updated_at: string | null
  email: string | null
}

function detailUserToDialogUser(u: UsersDetailApiUser): UserDialogUser {
  return {
    id: u.id,
    name: u.name ?? null,
    username: u.username ?? null,
    role: u.role,
    profile_picture_url: u.profile_picture_url ?? null,
    age: u.age ?? null,
    country_code: u.country_code ?? null,
    gender: u.gender ?? null,
    instagram_handle: u.instagram_handle ?? null,
    snapchat_handle: u.snapchat_handle ?? null,
    connection_count: u.connection_count ?? 0,
    created_at: u.created_at ?? null,
    updated_at: u.updated_at ?? null,
    email: u.email ?? null,
  }
}

function userDialogUserToPeerMini(u: UserDialogUser): NonNullable<ConnectionRow['peer']> {
  return {
    user_id: u.id,
    name: u.name,
    username: u.username,
    profile_picture_url: u.profile_picture_url,
    gender: u.gender,
  }
}

function supportProfileSubtitle(u: UserDialogUser): string {
  const un = u.username?.trim()
  const name = u.name?.trim()
  if (name && un) return `@${un}`
  if (un) return `@${un}`
  const cc = u.country_code?.trim()
  const bits: string[] = []
  if (cc) bits.push(cc.toUpperCase())
  if (u.age != null && Number.isFinite(u.age)) bits.push(`${u.age}`)
  return bits.length > 0 ? bits.join(' · ') : 'Customer-facing support account'
}

function PeerChatAvatar({
  peer,
  className,
  fallbackClassName,
}: {
  peer: ConnectionRow['peer']
  className?: string
  fallbackClassName?: string
}) {
  const url = peer?.profile_picture_url?.trim()
  return (
    <Avatar className={className}>
      {url ? <AvatarImage src={url} alt="" /> : null}
      <AvatarFallback className={fallbackClassName}>{profileGenderEmoji(peer?.gender)}</AvatarFallback>
    </Avatar>
  )
}

function peerLabel(row: ConnectionRow): string {
  const p = row.peer
  if (p?.name?.trim()) return p.name.trim()
  if (p?.username?.trim()) return `@${p.username.trim()}`
  if (row.peer_user_id) return `${row.peer_user_id.slice(0, 8)}…`
  return 'Unknown'
}

function coerceUnreadCount(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

function SupportSidebarUnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  const aria = `${count} unread message${count === 1 ? '' : 's'}`
  return (
    <span
      className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full border border-gray-200 bg-[#f5f5f7] px-[5px] text-[10px] font-semibold tabular-nums leading-none text-gray-600"
      aria-label={aria}
    >
      {count > 99 ? '99+' : String(count)}
    </span>
  )
}

function normalizeConnectionRow(c: ConnectionRow): ConnectionRow {
  const unread_message_count = coerceUnreadCount(c.unread_message_count)
  const unrepliedFallback = unread_message_count > 0
  return {
    ...c,
    unread_message_count,
    unread: unread_message_count > 0,
    unreplied: typeof c.unreplied === 'boolean' ? c.unreplied : unrepliedFallback,
  }
}

function truncateSidebarPreview(text: string, max = 72): string {
  const single = text.replace(/\s+/g, ' ').trim()
  if (single.length <= max) return single
  return `${single.slice(0, max - 1)}…`
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function SupportChat() {
  const { toast } = useToast()
  const [subjectUserId, setSubjectUserId] = useState<string | null>(null)
  const [supportUserId, setSupportUserId] = useState<string | null>(null)
  const [supportConfigured, setSupportConfigured] = useState<boolean | null>(null)

  const [connections, setConnections] = useState<ConnectionRow[]>([])
  const [loadingConnections, setLoadingConnections] = useState(false)
  const [filter, setFilter] = useState('')
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'unreplied'>('all')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chatPayload, setChatPayload] = useState<ActivityConnectionChatPayload | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editTarget, setEditTarget] = useState<ActivityConnectionChatMessageRow | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [supportProfileUser, setSupportProfileUser] = useState<UserDialogUser | null>(null)
  const [supportProfileLoading, setSupportProfileLoading] = useState(false)
  const [supportProfileError, setSupportProfileError] = useState<string | null>(null)
  const [supportProfileEditOpen, setSupportProfileEditOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  const chatTranslation = useChatTranslation({
    scrollRootRef: scrollRef,
    observeKey: selectedId ?? '',
  })

  useEffect(() => {
    if (editTarget) setEditDraft(editTarget.content ?? '')
  }, [editTarget])

  useEffect(() => {
    let cancelled = false
    fetch('/api/support-chat/meta')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        setSupportUserId(typeof j.support_user_id === 'string' ? j.support_user_id : null)
        setSupportConfigured(j.configured === true)
      })
      .catch(() => {
        if (!cancelled) {
          setSupportUserId(null)
          setSupportConfigured(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadSupportProfile = useCallback(async () => {
    if (!supportUserId) return
    setSupportProfileLoading(true)
    setSupportProfileError(null)
    try {
      const res = await fetch(`/api/users/detail?user_id=${encodeURIComponent(supportUserId)}`)
      const json = (await res.json()) as { error?: string; user?: UsersDetailApiUser }
      if (!res.ok) throw new Error(json.error || 'Failed to load support profile')
      if (!json.user) throw new Error('Missing profile payload')
      setSupportProfileUser(detailUserToDialogUser(json.user))
    } catch (e) {
      setSupportProfileUser(null)
      setSupportProfileError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSupportProfileLoading(false)
    }
  }, [supportUserId])

  useEffect(() => {
    if (supportConfigured !== true || !supportUserId) {
      setSupportProfileUser(null)
      setSupportProfileError(null)
      setSupportProfileLoading(false)
      setSupportProfileEditOpen(false)
      return
    }
    loadSupportProfile()
  }, [supportConfigured, supportUserId, loadSupportProfile])

  const loadConnections = useCallback(async () => {
    setLoadingConnections(true)
    setConnections([])
    setSelectedId(null)
    setChatPayload(null)
    try {
      const res = await fetch('/api/support-chat/connections')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load connections')
      setConnections(
        Array.isArray(json.connections)
          ? (json.connections as ConnectionRow[]).map((c) => normalizeConnectionRow(c))
          : []
      )
      const sid =
        typeof json.subject_user_id === 'string' ? json.subject_user_id.toLowerCase() : null
      setSubjectUserId(sid)
    } catch (e) {
      toast({
        title: 'Could not load connections',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoadingConnections(false)
    }
  }, [toast])

  useEffect(() => {
    if (supportConfigured !== true) return
    loadConnections()
  }, [supportConfigured, loadConnections])

  const loadMessages = useCallback(
    async (connectionId: string) => {
      setLoadingMessages(true)
      setChatPayload(null)
      try {
        const res = await fetch(
          `/api/activity/connection-messages?connection_id=${encodeURIComponent(connectionId)}`
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load messages')
        setChatPayload(json as ActivityConnectionChatPayload)
      } catch (e) {
        toast({
          title: 'Could not load chat',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        })
      } finally {
        setLoadingMessages(false)
      }
    },
    [toast]
  )

  const refreshConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/support-chat/connections')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to refresh connections')
      setConnections(
        Array.isArray(json.connections)
          ? (json.connections as ConnectionRow[]).map((c) => normalizeConnectionRow(c))
          : []
      )
    } catch (e) {
      toast({
        title: 'Could not refresh inbox',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }, [toast])

  useEffect(() => {
    if (!selectedId) return
    loadMessages(selectedId)
  }, [selectedId, loadMessages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatPayload?.messages])

  const filteredConnections = useMemo(() => {
    let list = connections
    if (inboxFilter === 'unread') list = connections.filter((c) => c.unread_message_count > 0)
    else if (inboxFilter === 'unreplied') list = connections.filter((c) => c.unreplied)
    const q = filter.trim().toLowerCase()
    if (!q) return list
    return list.filter((c) => {
      const label = peerLabel(c).toLowerCase()
      const un = c.peer?.username?.toLowerCase() ?? ''
      const pid = (c.peer_user_id ?? '').toLowerCase()
      const preview = (c.last_message_preview ?? '').toLowerCase()
      return label.includes(q) || un.includes(q) || pid.includes(q) || preview.includes(q)
    })
  }, [connections, filter, inboxFilter])

  useEffect(() => {
    if (!selectedId) return
    if (!filteredConnections.some((c) => c.id === selectedId)) {
      setSelectedId(null)
      setChatPayload(null)
    }
  }, [filteredConnections, selectedId])

  const selectedConn = connections.find((c) => c.id === selectedId) ?? null

  const sendMessage = async () => {
    if (!subjectUserId || !selectedId || !supportUserId) return
    const text = draft.trim()
    if (!text) return
    setSending(true)
    try {
      const res = await fetch('/api/support-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: selectedId,
          subject_user_id: subjectUserId,
          content: text,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Send failed')
      setDraft('')
      await loadMessages(selectedId)
      const preview = truncateSidebarPreview(text)
      const now = new Date().toISOString()
      setConnections((prev) => {
        const next = prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                last_message_preview: preview,
                last_message_at: now,
                unread_message_count: 0,
                unread: false,
                unreplied: false,
              }
            : c
        )
        return [...next].sort((a, b) => {
          const ta = new Date(a.last_message_at || a.created_at || 0).getTime()
          const tb = new Date(b.last_message_at || b.created_at || 0).getTime()
          return tb - ta
        })
      })
    } catch (e) {
      toast({
        title: 'Could not send',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  const confirmDeleteMessage = async () => {
    if (!pendingDeleteId || !selectedId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/support-chat/messages/${encodeURIComponent(pendingDeleteId)}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Delete failed')
      setPendingDeleteId(null)
      await loadMessages(selectedId)
      await refreshConnections()
      toast({ title: 'Message deleted' })
    } catch (e) {
      toast({
        title: 'Could not delete message',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const saveEditedMessage = async () => {
    if (!editTarget || !selectedId) return
    const text = editDraft.trim()
    if (!text) {
      toast({
        title: 'Message cannot be empty',
        description: 'Enter some text before saving.',
        variant: 'destructive',
      })
      return
    }
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/support-chat/messages/${encodeURIComponent(editTarget.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Update failed')
      setEditTarget(null)
      await loadMessages(selectedId)
      await refreshConnections()
      toast({ title: 'Message updated' })
    } catch (e) {
      toast({
        title: 'Could not update message',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  const messages = chatPayload?.messages ?? []

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden lg:flex-row lg:rounded-2xl lg:border lg:border-gray-200 lg:bg-[#f5f5f7] lg:shadow-sm">
      {/* Sidebar */}
      <aside className="flex min-h-0 w-full min-w-0 flex-[2] flex-col overflow-hidden border border-gray-200 bg-white lg:flex-none lg:w-[340px] lg:max-h-full lg:flex-[unset] lg:rounded-none lg:rounded-l-2xl lg:border-y-0 lg:border-l-0">
        <div className="shrink-0 space-y-3 border-b border-gray-100 p-3 sm:p-4">
          {supportConfigured === false && (
            <p className="text-xs font-medium text-amber-700">
              Set SUPPORT_CHAT_USER_ID on the server to load chats and send.
            </p>
          )}
          {supportConfigured === true && supportUserId ? (
            <div className="flex w-full gap-3 border-b border-gray-50 pb-3">
              {supportProfileLoading ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-[#eef2f7]">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : supportProfileUser ? (
                <PeerChatAvatar
                  peer={userDialogUserToPeerMini(supportProfileUser)}
                  className="h-11 w-11 shrink-0 border border-gray-100"
                  fallbackClassName="bg-[#eef2f7] text-2xl leading-none"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-[#eef2f7] text-lg font-semibold text-gray-400">
                  ?
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-[15px] text-gray-900">
                    {supportProfileUser ? shamelessProfileHeadline(supportProfileUser) : 'Support profile'}
                  </span>
                  <button
                    type="button"
                    disabled={!supportProfileUser || supportProfileLoading}
                    onClick={() => setSupportProfileEditOpen(true)}
                    className="shrink-0 text-[11px] font-medium text-gray-600 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-40"
                  >
                    Edit
                  </button>
                </div>
                <p className="truncate text-xs text-gray-600">
                  {supportProfileError
                    ? supportProfileError
                    : supportProfileUser
                      ? supportProfileSubtitle(supportProfileUser)
                      : supportProfileLoading
                        ? 'Loading…'
                        : ''}
                </p>
              </div>
            </div>
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search chats…"
              className="h-9 rounded-xl border-0 bg-[#f5f5f7] pl-9 text-sm"
              disabled={connections.length === 0 && !loadingConnections}
            />
          </div>
          <div
            className="flex rounded-xl bg-[#f5f5f7] p-1"
            role="tablist"
            aria-label="Inbox filter"
          >
            <button
              type="button"
              role="tab"
              aria-selected={inboxFilter === 'all'}
              disabled={loadingConnections || connections.length === 0}
              onClick={() => setInboxFilter('all')}
              className={cn(
                'flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-colors disabled:opacity-40',
                inboxFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inboxFilter === 'unread'}
              disabled={loadingConnections || connections.length === 0}
              onClick={() => setInboxFilter('unread')}
              className={cn(
                'flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-colors disabled:opacity-40',
                inboxFilter === 'unread'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
              title="Chats where the backlog counter is greater than zero"
            >
              Unread
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inboxFilter === 'unreplied'}
              disabled={loadingConnections || connections.length === 0}
              onClick={() => setInboxFilter('unreplied')}
              className={cn(
                'flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-colors disabled:opacity-40',
                inboxFilter === 'unreplied'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
              title="Latest message was from the user, not support"
            >
              Unreplied
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          {loadingConnections && connections.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
            </div>
          ) : null}
          {!loadingConnections && connections.length === 0 && subjectUserId ? (
            <p className="p-4 text-sm text-gray-500">No connections for this inbox.</p>
          ) : null}
          {!subjectUserId && supportConfigured === false ? (
            <p className="p-4 text-sm text-gray-500">Configure support user id to load chats.</p>
          ) : null}
          {!loadingConnections &&
          connections.length > 0 &&
          filteredConnections.length === 0 &&
          (filter.trim() || inboxFilter !== 'all') ? (
            <p className="p-4 text-sm text-gray-500">
              {filter.trim()
                ? 'No chats match your search.'
                : inboxFilter === 'unread'
                  ? 'No chats with unread messages.'
                  : 'No unreplied chats.'}
            </p>
          ) : null}
          {filteredConnections.map((c) => {
            const isSelected = selectedId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                aria-pressed={isSelected}
                className={cn(
                  'relative flex w-full gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50',
                  isSelected &&
                    'bg-gray-100 hover:bg-gray-100 before:pointer-events-none before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-r before:bg-gray-400'
                )}
              >
                <PeerChatAvatar
                  peer={c.peer}
                  className="h-11 w-11 shrink-0 border border-gray-100"
                  fallbackClassName="bg-[#eef2f7] text-2xl leading-none"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-[15px] text-gray-900">{peerLabel(c)}</span>
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {formatTime(c.last_message_at || c.created_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p
                      className={cn(
                        'min-w-0 flex-1 truncate text-xs leading-snug text-gray-600',
                        c.unread_message_count > 0 && 'font-semibold text-gray-900'
                      )}
                    >
                      {c.last_message_preview ?? 'No messages yet'}
                    </p>
                    <SupportSidebarUnreadBadge count={c.unread_message_count} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-h-0 w-full min-w-0 flex-[3] flex-col overflow-hidden border border-gray-200 bg-white lg:max-h-full lg:flex-1 lg:rounded-none lg:rounded-r-2xl lg:border-y-0 lg:border-r-0 lg:border-l lg:border-gray-200">
        {!selectedConn ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center text-sm text-gray-500">
            {subjectUserId ? 'Select a conversation' : 'Waiting for inbox…'}
          </div>
        ) : (
          <>
            <header className="flex shrink-0 flex-col gap-2 border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <PeerChatAvatar
                  peer={selectedConn.peer}
                  className="h-10 w-10 border border-gray-100"
                  fallbackClassName="bg-[#eef2f7] text-xl leading-none"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-gray-900">{peerLabel(selectedConn)}</h2>
                  <p className="truncate font-mono text-xs text-gray-500">{selectedConn.peer_user_id ?? ''}</p>
                </div>
              </div>
              <ChatTranslateToolbar
                targetLang={chatTranslation.targetLang}
                onTargetLangChange={chatTranslation.setTargetLang}
                configured={chatTranslation.configured}
                chatTranslateActive={chatTranslation.chatTranslateActive}
                onToggleConversation={chatTranslation.toggleChatTranslate}
                translatingCount={Object.keys(chatTranslation.pendingIds).length}
              />
            </header>

            <div
              ref={scrollRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain bg-[#f5f5f7] p-4"
            >
              {loadingMessages ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                messages.map((m: ActivityConnectionChatMessageRow) => {
                  const fromSupport = Boolean(supportUserId && m.sender_id === supportUserId)
                  const bubbleVariant = fromSupport ? 'gradient' : 'white'
                  const bubble = (
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
                        fromSupport
                          ? 'rounded-br-md bg-gradient-to-br from-sky-400 to-blue-500 text-white'
                          : 'rounded-bl-md border border-gray-200 bg-white text-gray-900'
                      }`}
                    >
                      <p className="break-words text-sm whitespace-pre-wrap">{m.content ?? ''}</p>
                      <ChatMessageTranslateFooter
                        mode={chatTranslation.chatTranslateActive ? 'conversation' : 'idle'}
                        rawText={m.content}
                        targetLang={chatTranslation.targetLang}
                        translatedText={chatTranslation.byMessageId[m.id]}
                        isTranslating={Boolean(chatTranslation.pendingIds[m.id])}
                        onHide={() => chatTranslation.hideTranslation(m.id)}
                        bubbleVariant={bubbleVariant}
                      />
                      <p
                        className={`mt-1 text-right text-[10px] ${
                          fromSupport ? 'text-white/80' : 'text-gray-400'
                        }`}
                      >
                        {formatTime(m.created_at)}
                      </p>
                    </div>
                  )

                  return (
                    <div
                      key={m.id}
                      ref={chatTranslation.observeMessageRow(m.id, m.content)}
                      data-translate-row={m.id}
                      className={`flex ${fromSupport ? 'justify-end' : 'justify-start'}`}
                    >
                      {fromSupport ? (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>{bubble}</ContextMenuTrigger>
                          <ContextMenuContent>
                            {(m.content ?? '').trim() ? (
                              <>
                                <ContextMenuItem onSelect={() => setEditTarget(m)}>
                                  <Pencil />
                                  Edit message
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                              </>
                            ) : null}
                            <ContextMenuItem
                              className="text-red-600 focus:bg-red-50 focus:text-red-700"
                              onSelect={() => setPendingDeleteId(m.id)}
                            >
                              <Trash2 />
                              Delete message
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ) : (
                        bubble
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <footer className="shrink-0 border-t border-gray-100 bg-white p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-[#fafafa] px-3 py-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    supportConfigured === false ? 'Configure SUPPORT_CHAT_USER_ID to send…' : 'Type a message…'
                  }
                  disabled={sending || supportConfigured === false}
                  rows={1}
                  className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-gray-400 disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full"
                  disabled={sending || !draft.trim() || supportConfigured === false}
                  onClick={sendMessage}
                  aria-label="Send"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </footer>
          </>
        )}
      </main>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the message from the conversation for everyone. You cannot undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleting} onClick={confirmDeleteMessage}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open && !savingEdit) setEditTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit message</DialogTitle>
            <DialogDescription>Changes apply immediately for everyone in this chat.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            rows={6}
            disabled={savingEdit}
            className="resize-y"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={savingEdit} onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={savingEdit || !editDraft.trim()} onClick={saveEditedMessage}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {supportProfileUser ? (
        <UserDialog
          open={supportProfileEditOpen}
          onOpenChange={setSupportProfileEditOpen}
          user={supportProfileUser}
          onUserSaved={loadSupportProfile}
        />
      ) : null}
    </div>
  )
}
