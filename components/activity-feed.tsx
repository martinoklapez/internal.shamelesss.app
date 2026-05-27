'use client'

import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react'
import {
  RefreshCw,
  MessageCircle,
  UserPlus,
  Link2,
  Eye,
  MessagesSquare,
  ImageUp,
  NotebookPen,
  ChevronLeft,
  ChevronRight,
  Copy,
  HelpCircle,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type {
  ActivityConnectionRow,
  ActivityConnectionChatMessageRow,
  ActivityConnectionChatPayload,
  ActivityDiaryMemoryImageRow,
  ActivityFriendRequestRow,
  ActivityMessageRow,
  ActivityPositionDiaryRow,
  ActivityProfileMini,
  ActivityProfileViewRow,
  ActivityUploadRow,
} from '@/lib/activity-feed-types'
import { UserDialog, type UserDialogUser } from '@/components/edit-user-dialog'
import { ShamelessProfileModal } from '@/components/shameless-profile-modal'
import { ChatMessageTranslateFooter } from '@/components/chat-message-translate-footer'
import { ChatTranslateToolbar } from '@/components/chat-translate-toolbar'
import { useChatTranslation } from '@/hooks/use-chat-translation'

type ActivityTabId =
  | 'connections'
  | 'friend_requests'
  | 'messages'
  | 'uploads'
  | 'diary'
  | 'profile_views'

const PAGE_SIZE = 25

type ActivityTotals = {
  connections: number
  friend_requests: number
  messages: number
  uploads: number
  position_diary: number
  diary_memory_images: number
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
  position_diary: ActivityPositionDiaryRow[]
  diary_memory_images: ActivityDiaryMemoryImageRow[]
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

/** Second line under display name when both name and username exist (chat modal header pattern). */
function profileSubtitleUsername(p: ActivityProfileMini | null | undefined) {
  const name = p?.name?.trim()
  const un = p?.username?.trim()
  if (name && un) return `@${un}`
  return undefined
}

/** Same typography as connection chat header: peer peers vs direction. */
function ActivityRelationSeparator({ variant }: { variant: 'pair' | 'directed' }) {
  return (
    <span
      className="shrink-0 select-none px-0.5 font-mono text-xs font-semibold text-gray-400 sm:text-sm"
      aria-hidden
    >
      {variant === 'pair' ? '<>' : '→'}
    </span>
  )
}

/** Two-line block: display name → @username / id (chat modal header). */
function ConnectionChatHeaderParticipant({
  profile,
  userId,
  onOpenUserProfile,
}: {
  profile: ActivityProfileMini | null | undefined
  userId: string
  onOpenUserProfile?: (userId: string) => void
}) {
  const uid = userId.trim()
  const name = profile?.name?.trim()
  const un = profile?.username?.trim()
  const headline = name || (un ? `@${un}` : uid ? `${uid.slice(0, 8)}…` : 'Unknown')
  const subtitle =
    name && un
      ? `@${un}`
      : uid.length > 0
        ? uid.length > 18
          ? `${uid.slice(0, 17)}…`
          : uid
        : null

  const labelForA11y = displayName(profile, uid || 'unknown')
  const avatar = (
    <Avatar className="h-11 w-11 shrink-0 border border-gray-200">
      <AvatarImage src={profile?.profile_picture_url || undefined} alt="" />
      <AvatarFallback className="bg-[#eef2f7] text-xs font-medium text-gray-700">
        {(headline.slice(0, 2) || '?').toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )

  const textBlock = (
    <div className="min-w-0 flex-1 text-left">
      <div className="truncate font-semibold text-gray-900">{headline}</div>
      {subtitle ? (
        <div className={`truncate ${name && un ? 'text-[12px] text-gray-600' : 'font-mono text-[11px] text-gray-500'}`}>
          {subtitle}
        </div>
      ) : null}
    </div>
  )

  if (onOpenUserProfile && uid) {
    return (
      <button
        type="button"
        className={cn(
          'inline-flex min-h-[48px] max-w-full min-w-0 items-center gap-2 rounded-lg border border-transparent p-1 text-left transition-colors hover:border-gray-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 sm:gap-2.5'
        )}
        onClick={() => onOpenUserProfile(uid)}
        aria-label={`Open profile: ${labelForA11y}`}
      >
        {avatar}
        {textBlock}
      </button>
    )
  }

  return (
    <div className="inline-flex min-h-[48px] max-w-full min-w-0 items-center gap-2 rounded-lg border border-transparent p-1 sm:gap-2.5">
      {avatar}
      {textBlock}
    </div>
  )
}

/** Matches Support Chat message timestamps (short month/day + time). */
function formatChatBubbleTime(iso: string | null): string {
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

/** Resolved URL for diary memory images (signed URL, direct https path in DB, or public URL). */
function diaryMemoryDisplayUrl(im: ActivityDiaryMemoryImageRow): string | null {
  const u = im.signed_image_url?.trim()
  if (u) return u
  const p = im.memory_image_path?.trim()
  if (p && /^https?:\/\//i.test(p)) return p
  return null
}

/** Resolved URL for position diary primary memory image. */
function positionDiaryMemoryDisplayUrl(d: ActivityPositionDiaryRow): string | null {
  const u = d.signed_memory_image_url?.trim()
  if (u) return u
  const p = d.memory_image_path?.trim()
  if (p && /^https?:\/\//i.test(p)) return p
  return null
}

/** Resolved thumbnail for a diary entry row: legacy upload → gallery memory (`diary_memory_images`) → position catalog image. */
function positionDiaryRowDisplayImage(d: ActivityPositionDiaryRow): string | null {
  const legacy = positionDiaryMemoryDisplayUrl(d)
  if (legacy) return legacy
  const g = d.entry_memory_preview_url?.trim()
  if (g) return g
  const c = d.position_image_url?.trim()
  if (c && /^https?:\/\//i.test(c)) return c
  return c || null
}

/** Resolved URL for message image in activity list (signed private URL or public http `image_url`). */
function activityMessageImageUrl(m: ActivityMessageRow): string | null {
  const s = m.signed_image_url?.trim()
  if (s) return s
  const u = m.image_url?.trim()
  if (u && /^https?:\/\//i.test(u)) return u
  return null
}

/** Profile for a connection slot using message row sender / other_user only. */
function profileForMessageConnectionSlot(
  m: ActivityMessageRow,
  slotUserId: string | null | undefined
): ActivityProfileMini | null {
  const id = slotUserId?.trim()
  if (!id) return null
  if (m.sender_id?.trim() === id) return m.sender ?? null
  if (m.other_user?.user_id?.trim() === id) return m.other_user ?? null
  return null
}

/** Build a minimal connection row for the chat dialog from a messages-tab row (uses `connection_id` + participant profiles). */
function connectionSummaryFromMessage(m: ActivityMessageRow): ActivityConnectionRow | null {
  const id = m.connection_id?.trim()
  if (!id) return null
  const u1 = m.connection_user_id_1
  const u2 = m.connection_user_id_2
  if (u1 && u2) {
    return {
      id,
      user_id_1: u1,
      user_id_2: u2,
      status: null,
      created_at: null,
      user_1: profileForMessageConnectionSlot(m, u1),
      user_2: profileForMessageConnectionSlot(m, u2),
      friend_request_source: null,
    }
  }
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

/** Chat-style message bubble for the Messages activity tab (matches modal / Support physics). */
function ActivityMessagesTabPreviewBubble({ m, imgUrl }: { m: ActivityMessageRow; imgUrl: string | null }) {
  const uid2 = m.connection_user_id_2?.trim().toLowerCase() ?? ''
  const sid = m.sender_id?.trim().toLowerCase() ?? ''
  const fromRight = Boolean(uid2 && sid === uid2)
  const when = m.created_at ? formatChatBubbleTime(m.created_at) : ''

  return (
    <div className={cn('flex w-full min-w-0', fromRight ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[min(100%,22rem)] rounded-2xl px-3 py-2 shadow-sm',
          fromRight
            ? 'rounded-br-md bg-gradient-to-br from-sky-400 to-blue-500 text-white'
            : 'rounded-bl-md border border-gray-200 bg-white text-gray-900'
        )}
      >
        {m.has_image ? (
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px]',
              fromRight && 'border-white/35 bg-white/15 text-white hover:bg-white/20'
            )}
          >
            Image
          </Badge>
        ) : null}
        {m.content_preview?.trim() ? (
          <p
            className={cn(
              'break-words text-sm whitespace-pre-wrap',
              m.has_image ? 'mt-1.5' : '',
              fromRight ? 'text-white' : 'text-gray-800'
            )}
          >
            {m.content_preview}
          </p>
        ) : null}
        {imgUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- signed/external URLs */
          <img
            src={imgUrl}
            alt=""
            className={cn(
              'mt-2 max-h-40 w-full max-w-full rounded-md object-contain',
              fromRight ? 'border border-white/25' : 'border border-gray-200'
            )}
          />
        ) : null}
        {m.has_image && !imgUrl ? (
          <p
            className={cn(
              'mt-2 rounded border px-2 py-1.5 text-xs',
              fromRight
                ? 'border-amber-200/50 bg-amber-950/25 text-amber-50'
                : 'border border-amber-200 bg-amber-50 text-amber-900'
            )}
          >
            Image attached — preview unavailable (check storage / refresh the list).
          </p>
        ) : null}
        {!m.content_preview?.trim() && !m.has_image ? (
          <p className={cn('text-sm', fromRight ? 'text-white/75' : 'text-gray-400')}>—</p>
        ) : null}
        {when ? (
          <p className={cn('mt-1.5 text-right text-[10px]', fromRight ? 'text-white/80' : 'text-gray-400')}>
            {when}
          </p>
        ) : null}
      </div>
    </div>
  )
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
  {
    id: 'diary',
    label: 'Diary',
    Icon: NotebookPen,
    count: (d) => d.totals.position_diary + d.totals.diary_memory_images,
  },
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
  const { toast } = useToast()
  const [detail, setDetail] = useState<ActivityConnectionChatPayload | null>(null)
  const [loadingChat, setLoadingChat] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const connectionId = connectionSummary?.id

  const chatTranslation = useChatTranslation({
    scrollRootRef: chatScrollRef,
    observeKey: `${open ? '1' : '0'}:${connectionId ?? ''}`,
  })
  const { stopChatTranslate } = chatTranslation

  useEffect(() => {
    if (!open) stopChatTranslate()
  }, [open, stopChatTranslate])

  /** Open scrolled to newest messages (bottom); API returns oldest-first. */
  useEffect(() => {
    if (!open || loadingChat || !detail?.messages.length) return
    const el = chatScrollRef.current
    if (!el) return

    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight
    }

    scrollToBottom()
    requestAnimationFrame(() => {
      scrollToBottom()
      requestAnimationFrame(scrollToBottom)
    })
    const timeoutId = window.setTimeout(scrollToBottom, 120)
    return () => window.clearTimeout(timeoutId)
  }, [open, loadingChat, detail])

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

  const resolvedUser1Profile =
    detail?.connection?.user_1 ?? connectionSummary?.user_1 ?? null
  const resolvedUser2Profile =
    detail?.connection?.user_2 ?? connectionSummary?.user_2 ?? null
  const resolvedUserId1 =
    detail?.connection?.user_id_1 ?? connectionSummary?.user_id_1 ?? ''
  const resolvedUserId2 =
    detail?.connection?.user_id_2 ?? connectionSummary?.user_id_2 ?? ''

  const participantPairVoice = `${displayName(resolvedUser1Profile, resolvedUserId1)} <> ${displayName(
    resolvedUser2Profile,
    resolvedUserId2
  )}`

  const headerDescription = (() => {
    if (!connectionSummary && !connectionId) {
      return 'Chat dialog. Open a connection from the activity table.'
    }
    const idPart = connectionId ? ` Connection identifier ${connectionId}.` : ''
    const countPart =
      !loadingChat && detail ? ` ${detail.messages.length} message${detail.messages.length === 1 ? '' : 's'}.` : ''
    return `Conversation ${participantPairVoice}.${idPart}${countPart}`
  })()

  const copyConnectionId = useCallback(async () => {
    if (!connectionId?.trim()) return
    try {
      await navigator.clipboard.writeText(connectionId)
      toast({ title: 'Copied', description: 'Connection ID copied to clipboard.' })
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' })
    }
  }, [connectionId, toast])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] h-[min(640px,calc(100vh-3rem))] flex flex-col p-0 gap-0 overflow-hidden">
        <TooltipProvider delayDuration={200}>
          <DialogHeader className="shrink-0 space-y-0 border-b border-gray-100 bg-white p-0 text-left">
            <div className="relative px-4 pb-3 pt-4 sm:px-5 sm:pb-4">
              <DialogTitle className="sr-only">{headerDescription}</DialogTitle>
              {!connectionId ? (
                <p className="pr-8 text-sm text-gray-500 sm:pr-10">Open a connection from the table.</p>
              ) : (
                <div className="flex flex-col gap-3 pr-8 sm:pr-10">
                  <div className="flex min-w-0 flex-nowrap items-center justify-start gap-x-1 sm:gap-x-1.5">
                    <div className="min-w-0 max-w-[min(12rem,calc(50%-2rem))] shrink sm:max-w-[13rem]">
                      <ConnectionChatHeaderParticipant
                        profile={resolvedUser1Profile}
                        userId={resolvedUserId1}
                        onOpenUserProfile={onOpenUserProfile}
                      />
                    </div>
                    <span
                      className="shrink-0 self-center select-none px-0.5 font-mono text-xs font-semibold text-gray-400 sm:text-sm"
                      aria-hidden
                    >
                      &lt;&gt;
                    </span>
                    <div className="min-w-0 max-w-[min(12rem,calc(50%-2rem))] shrink sm:max-w-[13rem]">
                      <ConnectionChatHeaderParticipant
                        profile={resolvedUser2Profile}
                        userId={resolvedUserId2}
                        onOpenUserProfile={onOpenUserProfile}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <div className="flex max-w-full min-w-0 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50/80 px-1.5 py-0.5 pr-2">
                      <code
                        className="max-w-[min(18rem,calc(100vw-8rem))] truncate font-mono text-[11px] leading-none text-gray-600"
                        title={connectionId}
                      >
                        {connectionId}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-gray-500 hover:text-gray-900"
                        onClick={() => void copyConnectionId()}
                        aria-label="Copy connection ID"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {!loadingChat && detail ? (
                      <Badge variant="secondary" className="border border-gray-200 bg-gray-100 font-medium text-gray-700">
                        {detail.messages.length === 1 ? '1 message' : `${detail.messages.length} messages`}
                      </Badge>
                    ) : loadingChat ? (
                      <Badge variant="secondary" className="border border-gray-200 bg-gray-100 font-medium text-gray-600">
                        Loading…
                      </Badge>
                    ) : null}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-gray-700"
                          aria-label="About images and signed URLs"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="max-w-[18rem] text-xs leading-relaxed">
                        Attachments from <span className="font-mono">chat-images</span> and{' '}
                        <span className="font-mono">explicit-photos</span> load via short-lived signed URLs (about 1
                        hour). Reopen this dialog to refresh links.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}

              <ChatTranslateToolbar
                layout="toolbar"
                className="mt-3 sm:mt-4"
                targetLang={chatTranslation.targetLang}
                onTargetLangChange={chatTranslation.setTargetLang}
                configured={chatTranslation.configured}
                chatTranslateActive={chatTranslation.chatTranslateActive}
                onToggleConversation={chatTranslation.toggleChatTranslate}
                translatingCount={Object.keys(chatTranslation.pendingIds).length}
              />
            </div>
          </DialogHeader>
        </TooltipProvider>

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
            <div
              ref={chatScrollRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain bg-[#f5f5f7] p-4 space-y-3"
            >
              {detail.messages.map((m) => (
                <ChatMessageItem
                  key={m.id}
                  observeRowRef={chatTranslation.observeMessageRow(m.id, m.content)}
                  msg={m}
                  connection={detail.connection}
                  onOpenUserProfile={onOpenUserProfile}
                  translation={{
                    mode: chatTranslation.chatTranslateActive ? 'conversation' : 'idle',
                    targetLang: chatTranslation.targetLang,
                    translatedText: chatTranslation.byMessageId[m.id],
                    isTranslating: Boolean(chatTranslation.pendingIds[m.id]),
                    onHide: () => chatTranslation.hideTranslation(m.id),
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChatMessageItem({
  msg,
  connection,
  onOpenUserProfile,
  translation,
  observeRowRef,
}: {
  msg: ActivityConnectionChatMessageRow
  connection: ActivityConnectionChatPayload['connection']
  onOpenUserProfile?: (userId: string) => void
  observeRowRef?: RefCallback<HTMLDivElement>
  translation?: {
    mode: 'idle' | 'conversation'
    targetLang: string
    translatedText?: string
    isTranslating: boolean
    onHide: () => void
  }
}) {
  const sid = msg.sender_id?.trim().toLowerCase() ?? ''
  const uid2 = connection.user_id_2?.trim().toLowerCase() ?? ''
  /** Same bubble physics as Support Chat: one participant right-aligned gradient, the other left white. */
  const fromRight = Boolean(uid2 && sid === uid2)

  const when = formatChatBubbleTime(msg.created_at)

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

  const nameBtnClass = fromRight
    ? 'text-left text-xs font-semibold text-white hover:underline decoration-white/70'
    : 'text-left text-xs font-semibold text-gray-900 hover:underline decoration-gray-400'

  return (
    <div ref={observeRowRef} data-translate-row={msg.id} className={cn('flex', fromRight ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 shadow-sm',
          fromRight
            ? 'rounded-br-md bg-gradient-to-br from-sky-400 to-blue-500 text-white'
            : 'rounded-bl-md border border-gray-200 bg-white text-gray-900'
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {onOpenUserProfile && senderId ? (
            <button
              type="button"
              className={cn(nameBtnClass, 'min-w-0 truncate')}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onOpenUserProfile(senderId)
              }}
            >
              {senderLabel}
            </button>
          ) : (
            <span
              className={cn(
                'min-w-0 truncate text-xs font-semibold',
                fromRight ? 'text-white' : 'text-gray-900'
              )}
            >
              {senderLabel}
            </span>
          )}
          {msg.is_read === true ? (
            <span
              className={cn(
                'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px]',
                fromRight
                  ? 'border-white/35 text-white/85'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
              )}
            >
              Read
            </span>
          ) : msg.is_read === false ? (
            <span
              className={cn(
                'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px]',
                fromRight ? 'border-white/35 bg-white/10 text-white/85' : 'border-gray-200 bg-gray-50 text-gray-600'
              )}
            >
              Unread
            </span>
          ) : null}
        </div>

        {msg.content?.trim() ? (
          <p
            className={cn(
              'mt-1 break-words text-sm whitespace-pre-wrap',
              fromRight ? 'text-white' : 'text-gray-800'
            )}
          >
            {msg.content}
          </p>
        ) : null}

        {displayImageUrl ? (
          <div className={cn('mt-2 space-y-1', msg.content?.trim() ? '' : 'mt-1')}>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed/external URLs */}
            <img
              src={displayImageUrl}
              alt="Chat attachment"
              className={cn(
                'max-h-64 max-w-full rounded-md object-contain',
                fromRight ? 'border border-white/25' : 'border border-gray-200'
              )}
            />
            {hasPrivateStorage && msg.storage_bucket ? (
              <p className={cn('text-[10px]', fromRight ? 'text-white/75' : 'text-gray-500')}>
                Bucket: <span className="font-mono">{msg.storage_bucket}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {signFailedPrivate ? (
          <p
            className={cn(
              'mt-2 rounded border px-2 py-1.5 text-xs',
              fromRight
                ? 'border-amber-200/60 bg-amber-950/30 text-amber-50'
                : 'border border-amber-200 bg-amber-50 text-amber-900'
            )}
          >
            Could not sign image URL (check storage policies / path).{' '}
            <span className="mt-0.5 block font-mono text-[11px]">
              {msg.storage_bucket} / {msg.storage_path}
            </span>
          </p>
        ) : null}

        {!displayImageUrl && !signFailedPrivate && trimmedLegacyUrl && !legacyHttpUrl ? (
          <p className={cn('mt-2 text-xs', fromRight ? 'text-white/80' : 'text-gray-500')}>
            {trimmedLegacyUrl}
          </p>
        ) : null}

        {translation ? (
          <ChatMessageTranslateFooter
            mode={translation.mode}
            rawText={msg.content}
            targetLang={translation.targetLang}
            translatedText={translation.translatedText}
            isTranslating={translation.isTranslating}
            onHide={translation.onHide}
            bubbleVariant={fromRight ? 'gradient' : 'white'}
          />
        ) : null}

        <p className={cn('mt-1 text-right text-[10px]', fromRight ? 'text-white/80' : 'text-gray-400')}>
          {when || '—'}
        </p>
      </div>
    </div>
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
    diary: 1,
    profile_views: 1,
  })

  const currentPage = pageByTab[tab]

  const [chatOpen, setChatOpen] = useState(false)
  const [chatConnection, setChatConnection] = useState<ActivityConnectionRow | null>(null)

  const [profilePreviewOpen, setProfilePreviewOpen] = useState(false)
  const [profilePreviewUser, setProfilePreviewUser] = useState<UserDialogUser | null>(null)
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false)
  const [editUserDialogUser, setEditUserDialogUser] = useState<UserDialogUser | null>(null)

  const [diaryImageLightboxUrl, setDiaryImageLightboxUrl] = useState<string | null>(null)

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
        position_diary: 0,
        diary_memory_images: 0,
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
        position_diary: Array.isArray(j.position_diary) ? j.position_diary : [],
        diary_memory_images: Array.isArray(j.diary_memory_images) ? j.diary_memory_images : [],
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

      <Dialog open={diaryImageLightboxUrl !== null} onOpenChange={(open) => !open && setDiaryImageLightboxUrl(null)}>
        <DialogContent className="max-w-[min(96vw,52rem)] max-h-[min(92vh,900px)] overflow-hidden flex flex-col gap-3 p-4 sm:p-6">
          <DialogHeader className="shrink-0 space-y-1">
            <DialogTitle className="text-base">Diary image</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Full-size preview. Signed URLs expire after about an hour — refresh the list if this stops loading.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 flex items-center justify-center overflow-auto rounded-md bg-gray-50 border border-gray-100">
            {diaryImageLightboxUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- signed/external URLs */
              <img
                src={diaryImageLightboxUrl}
                alt=""
                className="max-h-[min(78vh,820px)] w-full max-w-full object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      )}

      {loading && !data ? (
        <p className="text-sm text-gray-500">Loading latest activity…</p>
      ) : data ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-[#fafafa] p-1.5 shadow-sm sm:flex-row sm:items-center sm:gap-2">
            <div
              className="flex min-w-0 flex-1 flex-wrap gap-1 sm:gap-1.5"
              role="tablist"
              aria-label="Activity categories"
            >
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
                      'inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors shrink-0',
                      active
                        ? 'border border-gray-200 bg-white text-gray-900 shadow-sm'
                        : 'border border-transparent text-gray-600 hover:border-gray-200/80 hover:bg-white/80 hover:text-gray-900'
                    )}
                    onClick={() => setTab(id)}
                  >
                    <Icon
                      className={cn('h-4 w-4 shrink-0', active ? 'text-gray-700' : 'text-gray-500')}
                      aria-hidden
                    />
                    <span className="whitespace-nowrap">{label}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'h-5 border-0 px-1.5 tabular-nums font-normal',
                        active ? 'bg-gray-100 text-gray-800' : 'bg-gray-200/60 text-gray-600'
                      )}
                    >
                      {n}
                    </Badge>
                  </button>
                )
              })}
            </div>
            <div className="flex shrink-0 justify-stretch border-t border-gray-200 pt-2 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full gap-1.5 border-gray-200 bg-white font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:w-auto"
                onClick={() => load()}
                disabled={loading}
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
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
                            <th className="px-3 py-2 text-left font-medium text-gray-700">
                              Participants <span className="font-normal text-gray-500">&lt;&gt;</span>
                            </th>
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
                                <div className="flex flex-wrap items-center gap-x-1 gap-y-2 sm:gap-x-2">
                                  <ProfileCell
                                    profile={c.user_1}
                                    userId={c.user_id_1 || ''}
                                    sub={profileSubtitleUsername(c.user_1)}
                                    onAvatarClick={() => openUserProfile(c.user_id_1 || '')}
                                  />
                                  <ActivityRelationSeparator variant="pair" />
                                  <ProfileCell
                                    profile={c.user_2}
                                    userId={c.user_id_2 || ''}
                                    sub={profileSubtitleUsername(c.user_2)}
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
                            <th className="px-3 py-2 text-left font-medium text-gray-700">
                              From <span className="font-normal text-gray-500">→</span> To
                            </th>
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
                                <div className="flex flex-wrap items-center gap-x-1 gap-y-2 min-w-0 sm:gap-x-2">
                                  <ProfileCell
                                    profile={fr.from_user}
                                    userId={fr.from_user_id}
                                    sub={profileSubtitleUsername(fr.from_user)}
                                    onAvatarClick={() => openUserProfile(fr.from_user_id)}
                                  />
                                  <ActivityRelationSeparator variant="directed" />
                                  <ProfileCell
                                    profile={fr.to_user}
                                    userId={fr.to_user_id}
                                    sub={profileSubtitleUsername(fr.to_user)}
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
                                <div className="flex flex-col gap-2">
                                  {m.sender_id && m.other_user ? (
                                    <div className="flex flex-wrap items-center gap-x-1 gap-y-2 sm:gap-x-2">
                                      <ProfileCell
                                        profile={m.sender}
                                        userId={m.sender_id || ''}
                                        sub={profileSubtitleUsername(m.sender)}
                                        onAvatarClick={() => openUserProfile(m.sender_id || '')}
                                      />
                                      <ActivityRelationSeparator variant="pair" />
                                      <ProfileCell
                                        profile={m.other_user}
                                        userId={m.other_user.user_id}
                                        sub={profileSubtitleUsername(m.other_user)}
                                        onAvatarClick={() => openUserProfile(m.other_user!.user_id)}
                                      />
                                    </div>
                                  ) : (
                                    <ProfileCell
                                      profile={m.sender}
                                      userId={m.sender_id || ''}
                                      sub={profileSubtitleUsername(m.sender)}
                                      onAvatarClick={() => openUserProfile(m.sender_id || '')}
                                    />
                                  )}
                                  <ActivityMessagesTabPreviewBubble m={m} imgUrl={imgUrl} />
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
                                  sub={profileSubtitleUsername(u.user)}
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

            {tab === 'diary' && (
              <div className="space-y-10">
                {data.page === 1 &&
                data.totals.position_diary === 0 &&
                data.totals.diary_memory_images === 0 ? (
                  <p className="text-sm text-gray-500">No diary entries or memory photos yet.</p>
                ) : null}

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">Position diary entries</h3>
                  {data.position_diary.length === 0 ? (
                    <p className="text-sm text-gray-500">No diary entries on this page.</p>
                  ) : (
                    <div className={SECTION_CARD}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-700 w-[4.5rem]">Image</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700">User</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700">Position</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700 w-14">★</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700 w-24">Repeat</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700 hidden lg:table-cell max-w-[14rem]">
                                Notes
                              </th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700 hidden md:table-cell max-w-[12rem]">
                                Feelings
                              </th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700 hidden sm:table-cell w-40">
                                When
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {data.position_diary.map((d: ActivityPositionDiaryRow) => (
                              <tr key={d.id} className="hover:bg-gray-50/80">
                                <td className="px-3 py-2 align-middle">
                                  {(() => {
                                    const src = positionDiaryRowDisplayImage(d)
                                    return src ? (
                                      <button
                                        type="button"
                                        className="rounded-md border border-transparent p-0 cursor-zoom-in hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400"
                                        aria-label="View diary image full size"
                                        onClick={() => setDiaryImageLightboxUrl(src)}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element -- signed/external URLs */}
                                        <img
                                          src={src}
                                          alt=""
                                          className="max-h-36 max-w-[min(100%,14rem)] rounded-md border border-gray-200 object-contain bg-gray-50"
                                        />
                                      </button>
                                    ) : (
                                      <span className="text-xs text-gray-400">—</span>
                                    )
                                  })()}
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  <ProfileCell
                                    profile={d.user}
                                    userId={d.user_id}
                                    sub={profileSubtitleUsername(d.user)}
                                    onAvatarClick={() => openUserProfile(d.user_id)}
                                  />
                                </td>
                                <td className="px-3 py-2 align-middle font-mono text-xs text-gray-700">
                                  {d.position_id}
                                </td>
                                <td className="px-3 py-2 align-middle tabular-nums text-gray-700">
                                  {d.rating != null ? d.rating : '—'}
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  {d.worth_repeat == null ? (
                                    <span className="text-xs text-gray-400">—</span>
                                  ) : d.worth_repeat ? (
                                    <Badge variant="outline" className="text-[10px] font-normal">
                                      Yes
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-gray-500">No</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-middle text-gray-600 text-xs hidden lg:table-cell max-w-[14rem]">
                                  <p className="line-clamp-2">{d.notes?.trim() || '—'}</p>
                                </td>
                                <td className="px-3 py-2 align-middle text-gray-600 text-[11px] hidden md:table-cell max-w-[12rem] space-y-0.5">
                                  <p className="line-clamp-1" title={d.feeling_for_her ?? undefined}>
                                    <span className="text-gray-400">Her:</span>{' '}
                                    {d.feeling_for_her?.trim() || '—'}
                                  </p>
                                  <p className="line-clamp-1" title={d.feeling_for_him ?? undefined}>
                                    <span className="text-gray-400">Him:</span>{' '}
                                    {d.feeling_for_him?.trim() || '—'}
                                  </p>
                                </td>
                                <td
                                  suppressHydrationWarning
                                  className="px-3 py-2 align-middle text-gray-600 text-xs whitespace-nowrap hidden sm:table-cell"
                                  title={d.created_at ? new Date(d.created_at).toLocaleString() : undefined}
                                >
                                  {d.created_at ? formatRelativeCreated(d.created_at) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">Memory photos</h3>
                  {data.diary_memory_images.length === 0 ? (
                    <p className="text-sm text-gray-500">No memory photos on this page.</p>
                  ) : (
                    <div className={SECTION_CARD}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-700 w-[4.5rem]">Preview</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700">User</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700">Position</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700 hidden lg:table-cell">
                                Diary entry
                              </th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700 w-24">Visible</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700 hidden md:table-cell w-40">
                                When
                              </th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700 hidden xl:table-cell">
                                Path
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {data.diary_memory_images.map((im: ActivityDiaryMemoryImageRow) => (
                              <tr key={im.id} className="hover:bg-gray-50/80">
                                <td className="px-3 py-2 align-middle">
                                  {(() => {
                                    const src = diaryMemoryDisplayUrl(im)
                                    return src ? (
                                      <button
                                        type="button"
                                        className="inline-block max-w-[min(100%,18rem)] rounded-md border border-transparent p-0 cursor-zoom-in hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400"
                                        aria-label="View memory photo full size"
                                        onClick={() => setDiaryImageLightboxUrl(src)}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element -- signed/external URLs */}
                                        <img
                                          src={src}
                                          alt=""
                                          className="max-h-48 max-w-full rounded-md border border-gray-200 object-contain bg-gray-50"
                                        />
                                      </button>
                                    ) : (
                                      <span
                                        className="text-[10px] text-amber-800 block max-w-[14rem]"
                                        title={im.memory_image_path}
                                      >
                                        No preview — stored path:{' '}
                                        <span className="font-mono break-all opacity-90">
                                          {im.memory_image_path.length > 72
                                            ? `${im.memory_image_path.slice(0, 72)}…`
                                            : im.memory_image_path}
                                        </span>
                                      </span>
                                    )
                                  })()}
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  <ProfileCell
                                    profile={im.user}
                                    userId={im.user_id}
                                    sub={profileSubtitleUsername(im.user)}
                                    onAvatarClick={() => openUserProfile(im.user_id)}
                                  />
                                </td>
                                <td className="px-3 py-2 align-middle font-mono text-xs text-gray-700">
                                  {im.position_id ?? '—'}
                                </td>
                                <td className="px-3 py-2 align-middle font-mono text-[11px] text-gray-500 hidden lg:table-cell max-w-[12rem] truncate">
                                  {im.diary_entry_id}
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  {im.is_visible ? (
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
                                  title={im.created_at ? new Date(im.created_at).toLocaleString() : undefined}
                                >
                                  {im.created_at ? formatRelativeCreated(im.created_at) : '—'}
                                </td>
                                <td className="px-3 py-2 align-middle text-[11px] font-mono text-gray-500 hidden xl:table-cell max-w-xs truncate">
                                  {im.memory_image_path}
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
                            <th className="px-3 py-2 text-left font-medium text-gray-700">
                              Viewer <span className="font-normal text-gray-500">→</span> Profile
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-gray-700 hidden sm:table-cell w-40">
                              When
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.profile_views.map((pv) => (
                            <tr key={pv.id} className="hover:bg-gray-50/80">
                              <td className="px-3 py-2 align-middle">
                                <div className="flex flex-wrap items-center gap-x-1 gap-y-2 min-w-0 sm:gap-x-2">
                                  <ProfileCell
                                    profile={pv.viewer}
                                    userId={pv.viewer_id}
                                    sub={profileSubtitleUsername(pv.viewer)}
                                    onAvatarClick={() => openUserProfile(pv.viewer_id)}
                                  />
                                  <ActivityRelationSeparator variant="directed" />
                                  <ProfileCell
                                    profile={pv.viewed_user}
                                    userId={pv.viewed_user_id}
                                    sub={profileSubtitleUsername(pv.viewed_user)}
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
              const per = data.per_page

              if (tab === 'diary') {
                const page = data.page
                const te = data.totals.position_diary
                const tp = data.totals.diary_memory_images
                const entryPages = Math.max(1, Math.ceil(te / per) || 1)
                const photoPages = Math.max(1, Math.ceil(tp / per) || 1)
                const totalPages = Math.max(entryPages, photoPages)
                const fromE = te === 0 ? 0 : (page - 1) * per + 1
                const toE = Math.min(te, page * per)
                const fromP = tp === 0 ? 0 : (page - 1) * per + 1
                const toP = Math.min(tp, page * per)
                return (
                  <>
                    <p className="text-sm text-gray-600">
                      Entries{' '}
                      <span className="font-medium tabular-nums">{fromE}</span>–
                      <span className="font-medium tabular-nums">{toE}</span> of{' '}
                      <span className="font-medium tabular-nums">{te}</span>
                      <span className="mx-2 text-gray-300">·</span>
                      Photos{' '}
                      <span className="font-medium tabular-nums">{fromP}</span>–
                      <span className="font-medium tabular-nums">{toP}</span> of{' '}
                      <span className="font-medium tabular-nums">{tp}</span>
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
                            diary: Math.max(1, prev.diary - 1),
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
                            diary: prev.diary + 1,
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
              }

              const total = data.totals[tab]
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
