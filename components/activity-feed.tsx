'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, MessageCircle, UserPlus, Link2, Eye, MessagesSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatRelativeCreated } from '@/lib/utils/date'
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
} from '@/lib/activity-feed-types'

type ActivityPayload = {
  limit: number
  connections: ActivityConnectionRow[]
  friend_requests: ActivityFriendRequestRow[]
  messages: ActivityMessageRow[]
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
}: {
  profile: ActivityProfileMini | null | undefined
  userId: string
  sub?: string | null
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={profile?.profile_picture_url || undefined} alt="" />
        <AvatarFallback className="text-[10px]">
          {(displayName(profile, userId).slice(0, 2) || '?').toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="font-medium text-gray-900 truncate">{displayName(profile, userId)}</div>
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

function ConnectionChatMessagesDialog({
  open,
  onOpenChange,
  connectionSummary,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  connectionSummary: ActivityConnectionRow | null
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
                    : `${detail.messages.length} messages.`}
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
                <ChatMessageItem key={m.id} msg={m} />
              ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChatMessageItem({ msg }: { msg: ActivityConnectionChatMessageRow }) {
  const when = msg.created_at
    ? new Date(msg.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  const hasHttpsImage =
    typeof msg.image_url === 'string' && /^https:\/\//i.test(msg.image_url.trim())
  const storageNote =
    !hasHttpsImage &&
    typeof msg.storage_path === 'string' &&
    msg.storage_path.trim().length > 0
      ? `[Image: ${msg.storage_bucket ?? 'bucket'} / ${msg.storage_path}]`
      : null

  return (
    <li className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 text-sm">
      <div className="flex gap-3">
        <Avatar className="h-9 w-9 shrink-0 mt-0.5">
          <AvatarImage src={msg.sender?.profile_picture_url || undefined} alt="" />
          <AvatarFallback className="text-[10px]">
            {(displayName(msg.sender, msg.sender_id || '?').slice(0, 2) || '?').toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span className="font-medium text-gray-900">
              {displayName(msg.sender, msg.sender_id || 'unknown')}
            </span>
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
          {hasHttpsImage ? (
            <img
              src={msg.image_url!.trim()}
              alt="Chat attachment"
              className="max-h-48 rounded-md border border-gray-200 object-contain mt-1"
            />
          ) : null}
          {!msg.content?.trim() && !hasHttpsImage && storageNote ? (
            <p className="text-xs text-gray-500 font-mono break-all">{storageNote}</p>
          ) : null}
          {!msg.content?.trim() && !hasHttpsImage && !storageNote && msg.image_url?.trim() ? (
            <p className="text-xs text-gray-500">{msg.image_url}</p>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export default function ActivityFeed() {
  const [data, setData] = useState<ActivityPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(40)

  const [chatOpen, setChatOpen] = useState(false)
  const [chatConnection, setChatConnection] = useState<ActivityConnectionRow | null>(null)

  const openChat = (row: ActivityConnectionRow) => {
    setChatConnection(row)
    setChatOpen(true)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/activity?limit=${limit}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load activity')
      setData(json as ActivityPayload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [limit])

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
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span>Rows per section</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"
          >
            {[20, 40, 60, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => load()} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      )}

      {loading && !data ? (
        <p className="text-sm text-gray-500">Loading latest activity…</p>
      ) : data ? (
        <div className="space-y-10">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-5 w-5 text-gray-600" aria-hidden />
              <h2 className="text-lg font-semibold text-gray-900">New chat connections</h2>
              <Badge variant="secondary" className="tabular-nums">
                {data.connections.length}
              </Badge>
            </div>
            <p className="text-xs text-gray-600 mb-2 max-w-prose">
              <strong className="font-medium text-gray-800">Via</strong> shows where the initiating friend request
              came from when we can resolve it (<code className="text-[11px] bg-gray-100 px-1 rounded">explore</code>,{' '}
              <code className="text-[11px] bg-gray-100 px-1 rounded">search</code>, etc.).
            </p>
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
                              <ProfileCell profile={c.user_1} userId={c.user_id_1 || ''} />
                              <span className="text-gray-400 shrink-0">&amp;</span>
                              <ProfileCell profile={c.user_2} userId={c.user_id_2 || ''} />
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
                                <span className="truncate">{friendRequestSourceLabel(c.friend_request_source)}</span>
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

          <section>
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="h-5 w-5 text-gray-600" aria-hidden />
              <h2 className="text-lg font-semibold text-gray-900">Friend requests</h2>
              <Badge variant="secondary" className="tabular-nums">
                {data.friend_requests.length}
              </Badge>
            </div>
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
                              <ProfileCell profile={fr.from_user} userId={fr.from_user_id} />
                              <span className="text-gray-400">→</span>
                              <ProfileCell profile={fr.to_user} userId={fr.to_user_id} />
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

          <section>
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-5 w-5 text-gray-600" aria-hidden />
              <h2 className="text-lg font-semibold text-gray-900">Chat messages</h2>
              <Badge variant="secondary" className="tabular-nums">
                {data.messages.length}
              </Badge>
            </div>
            {data.messages.length === 0 ? (
              <p className="text-sm text-gray-500">No messages yet.</p>
            ) : (
              <div className={SECTION_CARD}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Preview</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 hidden md:table-cell">
                          Chat
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 hidden sm:table-cell w-40">
                          When
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.messages.map((m) => (
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
                              />
                              <div className="min-w-0 flex-1">
                                {m.has_image && (
                                  <Badge variant="secondary" className="text-[10px] mb-1">
                                    Image
                                  </Badge>
                                )}
                                <p className="text-gray-800 break-words">
                                  {m.content_preview || (m.has_image ? '[image]' : '—')}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 align-middle text-gray-500 text-xs font-mono hidden md:table-cell truncate max-w-xs">
                            {m.connection_id ? m.connection_id.slice(0, 8) + '…' : '—'}
                          </td>
                          <td
                            suppressHydrationWarning
                            className="px-3 py-2 align-middle text-gray-600 text-xs whitespace-nowrap hidden sm:table-cell"
                            title={m.created_at ? new Date(m.created_at).toLocaleString() : undefined}
                          >
                            {m.created_at ? formatRelativeCreated(m.created_at) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-5 w-5 text-gray-600" aria-hidden />
              <h2 className="text-lg font-semibold text-gray-900">Profile views</h2>
              <Badge variant="secondary" className="tabular-nums">
                {data.profile_views.length}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Latest recorded views (deduplicated within 24h in the app; each row is a view event window).
            </p>
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
                              <ProfileCell profile={pv.viewer} userId={pv.viewer_id} />
                              <span className="text-gray-400">→</span>
                              <ProfileCell profile={pv.viewed_user} userId={pv.viewed_user_id} />
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
        </div>
      ) : null}
    </div>
  )
}
