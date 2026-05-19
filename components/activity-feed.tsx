'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  RefreshCw,
  MessageCircle,
  UserPlus,
  Link2,
  Eye,
  MessagesSquare,
  ImageUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatRelativeCreated } from '@/lib/utils/date'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type {
  ActivityConnectionRow,
  ActivityConnectionChatMessageRow,
  ActivityConnectionChatPayload,
  ActivityFriendRequestRow,
  ActivityMessageRow,
  ActivityProfileMini,
  ActivityProfileViewRow,
  ActivityUploadRow,
} from '@/lib/activity-feed-types'
import { UserDialog, type UserDialogUser } from '@/components/edit-user-dialog'
import { ShamelessProfileModal } from '@/components/shameless-profile-modal'

type ActivityTabId = 'connections' | 'friend_requests' | 'messages' | 'uploads' | 'profile_views'

const PAGE_SIZE = 25

type ActivityTotals = {
  connections: number
  friend_requests: number
  messages: number
  uploads: number
  profile_views: number
}

type ActivityPayload = {
  section: ActivityTabId
  page: number
  per_page: number
  totals: ActivityTotals
  connections: ActivityConnectionRow[]
  friend_requests: ActivityFriendRequestRow[]
  messages: ActivityMessageRow[]
  uploads: ActivityUploadRow[]
  profile_views: ActivityProfileViewRow[]
}

function friendRequestSourceLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  const t = raw.trim().toLowerCase()
  const map: Record<string, string> = {
    explore: 'Explore',
    search: 'Search',
    profile_modal: 'Profile modal',
  }
  return map[t] ?? raw.trim().replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function friendRequestSourceBadgeClass(raw: string | null | undefined): string {
  const k = raw?.trim().toLowerCase() ?? ''
  if (k === 'explore') return 'border-emerald-300/70 bg-emerald-50 text-emerald-950'
  if (k === 'search') return 'border-sky-300/70 bg-sky-50 text-sky-950'
  return ''
}

function displayName(p: ActivityProfileMini | null | undefined, fallbackId: string) {
  const name = p?.name?.trim()
  if (name) return name
  const u = p?.username?.trim()
  if (u) return `@${u}`
  return fallbackId.slice(0, 8) + '…'
}

function ProfileCell({
  profile,
  userId,
  sub,
  onAvatarClick,
}: {
  profile: ActivityProfileMini | null | undefined
  userId: string
  sub?: string | null
  /** Clicking the avatar opens the admin user dialog (activity feed). */
  onAvatarClick?: () => void
}) {
  const label = displayName(profile, userId)
  const avatar = (
    <Avatar className="h-8 w-8 shrink-0">
      <AvatarImage src={profile?.profile_picture_url || undefined} alt="" />
      <AvatarFallback className="text-[10px]">
        {(label.slice(0, 2) || '?').toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )

  return (
    <div className="flex items-center gap-2 min-w-0">
      {onAvatarClick && userId.trim() ? (
        <button
          type="button"
          className="shrink-0 rounded-full cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onAvatarClick()
          }}
          aria-label={`Open profile: ${label}`}
        >
          {avatar}
        </button>
      ) : (
        avatar
      )}
      <div className="min-w-0">
        <div className="font-medium text-gray-900 truncate">{label}</div>
        {sub ? (
          <div className="text-[11px] text-gray-500 truncate">{sub}</div>
        ) : (
          <div className="text-[11px] text-gray-400 font-mono truncate">{userId.slice(0, 13)}…</div>
        )}
      </div>
    </div>
  )
}

const SECTION_CARD =
  'rounded-lg border border-gray-200 bg-white overflow-hidden'

function formatFileSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Resolved URL for message image in activity list (signed private URL or public http `image_url`). */
function activityMessageImageUrl(m: ActivityMessageRow): string | null {
  const s = m.signed_image_url?.trim()
  if (s) return s
  const u = m.image_url?.trim()
  if (u && /^https?:\/\//i.test(u)) return u
  return null
}

/** Build a minimal connection row for the chat dialog from a messages-tab row (uses `connection_id` + participant profiles). */
function connectionSummaryFromMessage(m: ActivityMessageRow): ActivityConnectionRow | null {
  const id = m.connection_id?.trim()
  if (!id) return null
  return {
    id,
    user_id_1: m.sender_id ?? null,
    user_id_2: m.other_user?.user_id ?? null,
    status: null,
    created_at: null,
    user_1: m.sender ?? null,
    user_2: m.other_user ?? null,
    friend_request_source: null,
  }
}

const ACTIVITY_TABS: {
  id: ActivityTabId
  label: string
  Icon: LucideIcon
  count: (d: ActivityPayload) => number
}[] = [
  { id: 'connections', label: 'Connections', Icon: Link2, count: (d) => d.totals.connections },
  { id: 'friend_requests', label: 'Friend requests', Icon: UserPlus, count: (d) => d.totals.friend_requests },
  { id: 'messages', label: 'Messages', Icon: MessageCircle, count: (d) => d.totals.messages },
  { id: 'uploads', label: 'Uploads', Icon: ImageUp, count: (d) => d.totals.uploads },
  { id: 'profile_views', label: 'Profile views', Icon: Eye, count: (d) => d.totals.profile_views },
]

function ConnectionChatMessagesDialog({
  open,
  onOpenChange,
  connectionSummary,
  onOpenUserProfile,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  connectionSummary: ActivityConnectionRow | null
  onOpenUserProfile?: (userId: string) => void
}) {
  const [detail, setDetail] = useState<ActivityConnectionChatPayload | null>(null)
  const [loadingChat, setLoadingChat] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)

  const connectionId = connectionSummary?.id

  useEffect(() => {
    if (!open || !connectionId) {
      setDetail(null)
      setChatError(null)
      setLoadingChat(false)
      return
    }

    let cancelled = false
    setLoadingChat(true)
    setChatError(null)
    setDetail(null)

    ;(async () => {
      try {
        const res = await fetch(
          `/api/activity/connection-messages?connection_id=${encodeURIComponent(connectionId)}`
        )
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(json.error || 'Failed to load chat')
        setDetail(json as ActivityConnectionChatPayload)
      } catch (e) {
        if (!cancelled) {
          setChatError(e instanceof Error ? e.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) setLoadingChat(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, connectionId])

  const titleNames = connectionSummary
    ? `${displayName(connectionSummary.user_1, connectionSummary.user_id_1 || '')} & ${displayName(
        connectionSummary.user_2,
        connectionSummary.user_id_2 || ''
      )}`
    : 'Chat'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] h-[min(640px,calc(100vh-3rem))] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 shrink-0 border-b border-gray-100">
          <DialogTitle className="flex items-center gap-2 text-lg pr-8">
            <MessagesSquare className="h-5 w-5 text-gray-600 shrink-0" aria-hidden />
            <span className="truncate">{titleNames}</span>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-xs text-gray-500 space-y-1">
              {connectionId ? (
                <p className="font-mono break-all">{connectionId}</p>
              ) : (
                <p>Open a connection from the table.</p>
              )}
              {!loadingChat && detail ? (
                <p className="text-gray-600">
                  {detail.messages.length === 1
                    ? '1 message in this conversation.'
                    : `${detail.messages.length} messages.`}{' '}
                  Images from <span className="font-mono">chat-images</span> /{' '}
                  <span className="font-mono">explicit-photos</span> load via short-lived signed URLs (~1h); reopen this
                  dialog to refresh.
                </p>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col">
          {chatError ? (
            <div className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {chatError}
            </div>
          ) : loadingChat ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 py-16">Loading chat…</div>
          ) : detail && detail.messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 py-16">
              No messages in this conversation yet.
            </div>
          ) : detail ? (
            <ul className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {detail.messages.map((m) => (
                <ChatMessageItem key={m.id} msg={m} onOpenUserProfile={onOpenUserProfile} />
              ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChatMessageItem({
  msg,
  onOpenUserProfile,
}: {
  msg: ActivityConnectionChatMessageRow
  onOpenUserProfile?: (userId: string) => void
}) {
  const when = msg.created_at
    ? new Date(msg.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  const trimmedLegacyUrl = typeof msg.image_url === 'string' ? msg.image_url.trim() : ''
  const legacyHttpUrl =
    trimmedLegacyUrl && /^https?:\/\//i.test(trimmedLegacyUrl) ? trimmedLegacyUrl : null

  const displayImageUrl =
    (typeof msg.signed_image_url === 'string' && msg.signed_image_url.trim()) || legacyHttpUrl || null

  const hasPrivateStorage =
    typeof msg.storage_bucket === 'string' &&
    msg.storage_bucket.trim().length > 0 &&
    typeof msg.storage_path === 'string' &&
    msg.storage_path.trim().length > 0

  const signFailedPrivate = hasPrivateStorage && !msg.signed_image_url?.trim()

  const senderLabel = displayName(msg.sender, msg.sender_id || 'unknown')
  const senderId = msg.sender_id?.trim() || ''

  const avatarBlock = (
    <Avatar className="h-9 w-9 shrink-0 mt-0.5">
      <AvatarImage src={msg.sender?.profile_picture_url || undefined} alt="" />
      <AvatarFallback className="text-[10px]">
        {(senderLabel.slice(0, 2) || '?').toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )

  return (
    <li className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 text-sm">
      <div className="flex gap-3">
        {onOpenUserProfile && senderId ? (
          <button
            type="button"
            className="shrink-0 rounded-full cursor-pointer border-0 bg-transparent p-0 mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onOpenUserProfile(senderId)
            }}
            aria-label={`Open profile: ${senderLabel}`}
          >
            {avatarBlock}
          </button>
        ) : (
          avatarBlock
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className="font-medium text-gray-900">{senderLabel}</span>
            <span className="text-[11px] text-gray-400 tabular-nums">{when}</span>
            {msg.is_read === true ? (
              <Badge variant="outline" className="text-[10px] h-5 font-normal">
                Read
              </Badge>
            ) : msg.is_read === false ? (
              <Badge variant="secondary" className="text-[10px] h-5 font-normal">
                Unread
              </Badge>
            ) : null}
          </div>
          {msg.content?.trim() ? (
            <p className="text-gray-800 whitespace-pre-wrap break-words">{msg.content}</p>
          ) : null}

          {displayImageUrl ? (
            <div className="space-y-1 mt-1">
              <img
                src={displayImageUrl}
                alt="Chat attachment"
                className="max-h-64 max-w-full rounded-md border border-gray-200 object-contain"
              />
              {hasPrivateStorage && msg.storage_bucket ? (
                <p className="text-[10px] text-gray-500">
                  Bucket: <span className="font-mono">{msg.storage_bucket}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          {signFailedPrivate ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-1">
              Could not sign image URL (check storage policies / path).{' '}
              <span className="font-mono block mt-0.5 text-[11px]">
                {msg.storage_bucket} / {msg.storage_path}
              </span>
            </p>
          ) : null}

          {!displayImageUrl && !signFailedPrivate && trimmedLegacyUrl && !legacyHttpUrl ? (
            <p className="text-xs text-gray-500 mt-1">{trimmedLegacyUrl}</p>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export default function ActivityFeed() {
  const { toast } = useToast()
  const [data, setData] = useState<ActivityPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<ActivityTabId>('connections')
  const [pageByTab, setPageByTab] = useState<Record<ActivityTabId, number>>({
    connections: 1,
    friend_requests: 1,
    messages: 1,
    uploads: 1,
    profile_views: 1,
  })

  const currentPage = pageByTab[tab]

  const [chatOpen, setChatOpen] = useState(false)
  const [chatConnection, setChatConnection] = useState<ActivityConnectionRow | null>(null)

  const [profilePreviewOpen, setProfilePreviewOpen] = useState(false)
  const [profilePreviewUser, setProfilePreviewUser] = useState<UserDialogUser | null>(null)
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false)
  const [editUserDialogUser, setEditUserDialogUser] = useState<UserDialogUser | null>(null)

  const openChat = (row: ActivityConnectionRow) => {
    setChatConnection(row)
    setChatOpen(true)
  }

  const openUserProfile = useCallback(
    async (userId: string) => {
      const id = userId.trim()
      if (!id) return
      try {
        const res = await fetch(`/api/users/detail?user_id=${encodeURIComponent(id)}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load user')
        setProfilePreviewUser(json.user as UserDialogUser)
        setProfilePreviewOpen(true)
      } catch (e) {
        toast({
          title: 'Could not open profile',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    },
    [toast]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = currentPage
      const res = await fetch(
        `/api/activity?section=${encodeURIComponent(tab)}&page=${page}&per_page=${PAGE_SIZE}`
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load activity')
      const j = json as Partial<ActivityPayload> & { uploads?: unknown }
      const emptyTotals: ActivityTotals = {
        connections: 0,
        friend_requests: 0,
        messages: 0,
        uploads: 0,
        profile_views: 0,
      }
      setData({
        section: (j.section as ActivityTabId) || tab,
        page: typeof j.page === 'number' && j.page >= 1 ? j.page : page,
        per_page: typeof j.per_page === 'number' ? j.per_page : PAGE_SIZE,
        totals: { ...emptyTotals, ...(j.totals ?? {}) },
        connections: Array.isArray(j.connections) ? j.connections : [],
        friend_requests: Array.isArray(j.friend_requests) ? j.friend_requests : [],
        messages: Array.isArray(j.messages)
          ? j.messages.map((row) => {
              const r = row as ActivityMessageRow
              return {
                ...r,
                image_url: r.image_url ?? null,
                signed_image_url: r.signed_image_url ?? null,
              }
            })
          : [],
        uploads: Array.isArray(j.uploads) ? j.uploads : [],
        profile_views: Array.isArray(j.profile_views) ? j.profile_views : [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [tab, currentPage])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-8">
      <ConnectionChatMessagesDialog
        open={chatOpen}
        onOpenChange={(o) => {
          setChatOpen(o)
          if (!o) setChatConnection(null)
        }}
        connectionSummary={chatConnection}
        onOpenUserProfile={openUserProfile}
      />

      <ShamelessProfileModal
        open={profilePreviewOpen}
        onOpenChange={(open) => {
          setProfilePreviewOpen(open)
          if (!open) setProfilePreviewUser(null)
        }}
        user={profilePreviewUser}
        sourceLabel="Activity feed"
        onEdit={() => {
          const u = profilePreviewUser
          if (!u) return
          setEditUserDialogUser(u)
          setEditUserDialogOpen(true)
          setProfilePreviewOpen(false)
        }}
      />

      <UserDialog
        open={editUserDialogOpen}
        onOpenChange={(open) => {
          setEditUserDialogOpen(open)
          if (!open) setEditUserDialogUser(null)
        }}
        user={editUserDialogUser}
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      )}

      {loading && !data ? (
        <p className="text-sm text-gray-500">Loading latest activity…</p>
      ) : data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Activity categories">
                {ACTIVITY_TABS.map(({ id, label, Icon, count }) => {
                  const n = count(data)
                  const active = tab === id
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-medium transition-colors shrink-0 border border-transparent -mb-px',
                        active
                          ? 'border-gray-200 border-b-white bg-white text-gray-900 z-[1]'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      )}
                      onClick={() => setTab(id)}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      <span className="whitespace-nowrap">{label}</span>
                      <Badge variant="secondary" className="h-5 px-1.5 tabular-nums font-normal">
                        {n}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'shrink-0 -mb-px gap-1.5 rounded-t-md rounded-b-none px-3 font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              onClick={() => load()}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          <div className="min-h-[12rem]">
            {tab === 'connections' && (
              <section className="space-y-3">
                {data.connections.length === 0 ? (
                  <p className="text-sm text-gray-500">No connections yet.</p>
                ) : (
                  <div className={SECTION_CARD}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Users</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 hidden md:table-cell w-36">
                              Via (FR source)
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 w-28">Status</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 hidden sm:table-cell w-40">
                              When
                            </th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700 w-[7.5rem]">Chat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.connections.map((c) => (
                            <tr key={c.id} className="hover:bg-gray-50/80">
                              <td className="px-3 py-2 align-middle">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                  <ProfileCell
                                    profile={c.user_1}
                                    userId={c.user_id_1 || ''}
                                    onAvatarClick={() => openUserProfile(c.user_id_1 || '')}
                                  />
                                  <span className="text-gray-400 shrink-0">&</span>
                                  <ProfileCell
                                    profile={c.user_2}
                                    userId={c.user_id_2 || ''}
                                    onAvatarClick={() => openUserProfile(c.user_id_2 || '')}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2 align-middle hidden md:table-cell">
                                {c.friend_request_source ? (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] font-normal capitalize max-w-[10rem]',
                                      friendRequestSourceBadgeClass(c.friend_request_source)
                                    )}
                                    title={`friend_requests.source (raw): ${c.friend_request_source}`}
                                  >
                                    <span className="truncate">
                                      {friendRequestSourceLabel(c.friend_request_source)}
                                    </span>
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-gray-400" title="No matching friend_requests row">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 align-middle capitalize text-gray-700">{c.status || '—'}</td>
                              <td
                                suppressHydrationWarning
                                className="px-3 py-2 align-middle text-gray-600 text-xs whitespace-nowrap hidden sm:table-cell"
                                title={c.created_at ? new Date(c.created_at).toLocaleString() : undefined}
                              >
                                {c.created_at ? formatRelativeCreated(c.created_at) : '—'}
                              </td>
                              <td className="px-3 py-2 align-middle text-right">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs shrink-0"
                                  onClick={() => openChat(c)}
                                >
                                  <MessagesSquare className="h-3.5 w-3.5 mr-1" aria-hidden />
                                  Open chat
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {tab === 'friend_requests' && (
              <section className="space-y-3">
                {data.friend_requests.length === 0 ? (
                  <p className="text-sm text-gray-500">No friend requests yet.</p>
                ) : (
                  <div className={SECTION_CARD}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">From → To</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 w-24">Status</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 hidden md:table-cell">
                              Source
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 hidden lg:table-cell w-40">
                              When
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.friend_requests.map((fr) => (
                            <tr key={fr.id} className="hover:bg-gray-50/80">
                              <td className="px-3 py-2 align-middle">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  <ProfileCell
                                    profile={fr.from_user}
                                    userId={fr.from_user_id}
                                    onAvatarClick={() => openUserProfile(fr.from_user_id)}
                                  />
                                  <span className="text-gray-400">→</span>
                                  <ProfileCell
                                    profile={fr.to_user}
                                    userId={fr.to_user_id}
                                    onAvatarClick={() => openUserProfile(fr.to_user_id)}
                                  />
                                </div>
                                {fr.message ? (
                                  <p className="mt-1 text-xs text-gray-500 line-clamp-2 pl-10">{fr.message}</p>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 align-middle">
                                <Badge variant="outline" className="text-[10px] font-normal capitalize">
                                  {fr.status}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 align-middle text-gray-600 text-xs hidden md:table-cell truncate max-w-[10rem]">
                                {fr.source || '—'}
                              </td>
                              <td
                                suppressHydrationWarning
                                className="px-3 py-2 align-middle text-gray-600 text-xs whitespace-nowrap hidden lg:table-cell"
                                title={fr.created_at ? new Date(fr.created_at).toLocaleString() : undefined}
                              >
                                {fr.created_at ? formatRelativeCreated(fr.created_at) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {tab === 'messages' && (
              <section className="space-y-3">
                {data.messages.length === 0 ? (
                  <p className="text-sm text-gray-500">No messages yet.</p>
                ) : (
                  <div className={SECTION_CARD}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Preview</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-700 hidden md:table-cell whitespace-nowrap min-w-[15rem]">
                              Chat
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 hidden sm:table-cell w-40">
                              When
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.messages.map((m) => {
                            const imgUrl = activityMessageImageUrl(m)
                            const chatSummary = connectionSummaryFromMessage(m)
                            return (
                            <tr key={m.id} className="hover:bg-gray-50/80">
                              <td className="px-3 py-2 align-middle">
                                <div className="flex items-start gap-2">
                                  <ProfileCell
                                    profile={m.sender}
                                    userId={m.sender_id || ''}
                                    sub={
                                      m.other_user
                                        ? `→ ${displayName(m.other_user, m.other_user.user_id)}`
                                        : undefined
                                    }
                                    onAvatarClick={() => openUserProfile(m.sender_id || '')}
                                  />
                                  <div className="min-w-0 flex-1">
                                    {m.has_image && (
                                      <Badge variant="secondary" className="text-[10px] mb-1">
                                        Image
                                      </Badge>
                                    )}
                                    {m.content_preview ? (
                                      <p className="text-gray-800 break-words">{m.content_preview}</p>
                                    ) : null}
                                    {imgUrl ? (
                                      <img
                                        src={imgUrl}
                                        alt=""
                                        className="mt-2 max-h-40 max-w-[min(100%,18rem)] rounded-md border border-gray-200 object-contain bg-gray-50"
                                      />
                                    ) : null}
                                    {m.has_image && !imgUrl ? (
                                      <p className="text-xs text-amber-800 mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
                                        Image attached — preview unavailable (check storage / refresh the list).
                                      </p>
                                    ) : null}
                                    {!m.content_preview && !m.has_image ? (
                                      <p className="text-gray-400">—</p>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2 align-middle text-right hidden md:table-cell">
                                {chatSummary && m.connection_id ? (
                                  <div className="flex items-center justify-end gap-1 flex-wrap">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 shrink-0 gap-1.5 px-2 text-xs text-gray-600 hover:text-gray-900"
                                      title="Copy connection ID"
                                      aria-label="Copy connection ID"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(m.connection_id!)
                                          toast({
                                            title: 'Copied',
                                            description: 'Connection ID copied to clipboard.',
                                          })
                                        } catch {
                                          toast({
                                            title: 'Copy failed',
                                            description: 'Could not copy to clipboard.',
                                            variant: 'destructive',
                                          })
                                        }
                                      }}
                                    >
                                      <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                      <span>Copy connection ID</span>
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs shrink-0"
                                      onClick={() => openChat(chatSummary)}
                                    >
                                      <MessagesSquare className="h-3.5 w-3.5 mr-1" aria-hidden />
                                      Open chat
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                              <td
                                suppressHydrationWarning
                                className="px-3 py-2 align-middle text-gray-600 text-xs whitespace-nowrap hidden sm:table-cell"
                                title={m.created_at ? new Date(m.created_at).toLocaleString() : undefined}
                              >
                                {m.created_at ? formatRelativeCreated(m.created_at) : '—'}
                              </td>
                            </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {tab === 'uploads' && (
              <section className="space-y-3">
                {data.uploads.length === 0 ? (
                  <p className="text-sm text-gray-500">No uploads yet.</p>
                ) : (
                  <div className={SECTION_CARD}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 w-[4.5rem]">Preview</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">User</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 hidden sm:table-cell w-24">
                              Size
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 w-28">Revealed</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 hidden md:table-cell w-40">
                              When
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 hidden lg:table-cell">
                              Path
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.uploads.map((u) => (
                            <tr key={u.id} className="hover:bg-gray-50/80">
                              <td className="px-3 py-2 align-middle">
                                {u.signed_image_url ? (
                                  <img
                                    src={u.signed_image_url}
                                    alt=""
                                    className="h-14 w-14 rounded-md border border-gray-200 object-cover bg-gray-100"
                                  />
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 align-middle">
                                <ProfileCell
                                  profile={u.user}
                                  userId={u.user_id}
                                  onAvatarClick={() => openUserProfile(u.user_id)}
                                />
                              </td>
                              <td className="px-3 py-2 align-middle text-gray-600 tabular-nums text-xs hidden sm:table-cell">
                                {formatFileSize(u.file_size)}
                              </td>
                              <td className="px-3 py-2 align-middle">
                                {u.is_revealed ? (
                                  <Badge variant="outline" className="text-[10px] font-normal">
                                    Yes
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-gray-500">No</span>
                                )}
                              </td>
                              <td
                                suppressHydrationWarning
                                className="px-3 py-2 align-middle text-gray-600 text-xs whitespace-nowrap hidden md:table-cell"
                                title={u.created_at ? new Date(u.created_at).toLocaleString() : undefined}
                              >
                                {u.created_at ? formatRelativeCreated(u.created_at) : '—'}
                              </td>
                              <td className="px-3 py-2 align-middle text-[11px] font-mono text-gray-500 hidden lg:table-cell max-w-xs truncate">
                                {u.storage_path}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {tab === 'profile_views' && (
              <section className="space-y-3">
                {data.profile_views.length === 0 ? (
                  <p className="text-sm text-gray-500">No profile views yet.</p>
                ) : (
                  <div className={SECTION_CARD}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-700">Viewer → Profile</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 hidden sm:table-cell w-40">
                              When
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.profile_views.map((pv) => (
                            <tr key={pv.id} className="hover:bg-gray-50/80">
                              <td className="px-3 py-2 align-middle">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  <ProfileCell
                                    profile={pv.viewer}
                                    userId={pv.viewer_id}
                                    onAvatarClick={() => openUserProfile(pv.viewer_id)}
                                  />
                                  <span className="text-gray-400">→</span>
                                  <ProfileCell
                                    profile={pv.viewed_user}
                                    userId={pv.viewed_user_id}
                                    onAvatarClick={() => openUserProfile(pv.viewed_user_id)}
                                  />
                                </div>
                              </td>
                              <td
                                suppressHydrationWarning
                                className="px-3 py-2 align-middle text-gray-600 text-xs whitespace-nowrap hidden sm:table-cell"
                                title={new Date(pv.viewed_at).toLocaleString()}
                              >
                                {formatRelativeCreated(pv.viewed_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
            {(() => {
              const total = data.totals[tab]
              const per = data.per_page
              const totalPages = Math.max(1, Math.ceil(total / per) || 1)
              const from = total === 0 ? 0 : (data.page - 1) * per + 1
              const to = Math.min(total, data.page * per)
              return (
                <>
                  <p className="text-sm text-gray-600">
                    Showing{' '}
                    <span className="font-medium tabular-nums">{from}</span>–
                    <span className="font-medium tabular-nums">{to}</span> of{' '}
                    <span className="font-medium tabular-nums">{total}</span>
                    {loading ? <span className="ml-2 text-gray-400">(updating…)</span> : null}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      disabled={loading || data.page <= 1}
                      onClick={() =>
                        setPageByTab((prev) => ({
                          ...prev,
                          [tab]: Math.max(1, prev[tab] - 1),
                        }))
                      }
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4 mr-0.5" />
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600 tabular-nums px-1 min-w-[7rem] text-center">
                      Page {data.page} of {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      disabled={loading || data.page >= totalPages}
                      onClick={() =>
                        setPageByTab((prev) => ({
                          ...prev,
                          [tab]: prev[tab] + 1,
                        }))
                      }
                      aria-label="Next page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-0.5" />
                    </Button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      ) : null}
    </div>
  )
}
