'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  fetchMissiveEmailDetail,
  fetchMissiveSentEmails,
} from '@/lib/creator-outreach/client-api'
import type { MissiveEmailDetail, MissiveSentEmail } from '@/lib/creator-outreach/fetch-missive-sent-emails'
import type { EmailTemplate, OutreachSend } from '@/lib/creator-outreach/types'
import { cn } from '@/lib/utils'
import { formatDate, formatRelativeCreated } from '@/lib/utils/date'

type PreviewItem =
  | { kind: 'missive'; email: MissiveSentEmail }
  | { kind: 'pipeline'; send: OutreachSend }

function previewItemId(item: PreviewItem): string {
  return item.kind === 'missive' ? `m:${item.email.messageId}` : `p:${item.send.id}`
}

function pipelineSendsForContact(
  sends: OutreachSend[],
  contactId: string
): OutreachSend[] {
  return sends
    .filter((s) => s.contactId === contactId)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
}

function formatBytes(size: number | null): string {
  if (size == null || size <= 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function SentEmailPreviewRow({
  subject,
  recipientLine,
  preview,
  timeLabel,
  statusLabel,
  missiveWebUrl,
  onView,
}: {
  subject: string
  recipientLine?: string
  preview: string
  timeLabel: string
  statusLabel?: string
  missiveWebUrl?: string | null
  onView?: () => void
}) {
  const body = (
    <>
      <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-900 min-w-0">
        <span className="min-w-0 flex-1 truncate" title={subject}>
          {subject}
        </span>
        {statusLabel ? (
          <span className="text-[10px] font-normal text-amber-700 uppercase shrink-0">
            {statusLabel}
          </span>
        ) : null}
      </span>
      {recipientLine ? (
        <p className="font-mono text-xs text-gray-500 mt-0.5 truncate" title={recipientLine}>
          {recipientLine}
        </p>
      ) : null}
      {preview ? (
        <p className="text-xs text-gray-500 mt-0.5 truncate" title={preview}>
          {preview}
        </p>
      ) : null}
      <p className="text-[11px] text-gray-400 mt-0.5">{timeLabel}</p>
    </>
  )
  return (
    <li className="flex items-start gap-2 rounded-md border border-gray-100 px-2 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
        <Mail className="h-3.5 w-3.5 text-gray-600" aria-hidden />
      </span>
      {onView ? (
        <button
          type="button"
          className="min-w-0 flex-1 text-left hover:text-gray-600"
          onClick={onView}
        >
          {body}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
      {missiveWebUrl ? (
        <a
          href={missiveWebUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-gray-700 p-1 shrink-0"
          title="Open in Missive"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </li>
  )
}

function EmailNavCard({
  item,
  selected,
  onSelect,
}: {
  item: PreviewItem
  selected: boolean
  onSelect: () => void
}) {
  const subject =
    item.kind === 'missive' ? item.email.subject : item.send.templateName
  const recipientLine =
    item.kind === 'missive' ? item.email.toLabel : item.send.email
  const preview = item.kind === 'missive' ? item.email.preview : ''
  const timeLabel = formatRelativeCreated(
    item.kind === 'missive' ? item.email.deliveredAt : item.send.sentAt
  )
  const statusLabel =
    item.kind === 'pipeline' && item.send.status === 'queued' ? 'Queued' : undefined

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full min-w-0 text-left rounded-md border px-2 py-2 transition-colors',
        selected
          ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/80'
      )}
    >
      <p className="text-sm font-medium text-gray-900 truncate" title={subject}>
        {subject}
      </p>
      {statusLabel ? (
        <span className="text-[10px] font-normal text-amber-700 uppercase">
          {statusLabel}
        </span>
      ) : null}
      {recipientLine ? (
        <p className="font-mono text-[11px] text-gray-500 mt-0.5 truncate">{recipientLine}</p>
      ) : null}
      {preview ? (
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{preview}</p>
      ) : null}
      <p className="text-[10px] text-gray-400 mt-1">{timeLabel}</p>
    </button>
  )
}

/** Single-line email header field (Gmail-style). */
function EmailHeaderLine({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  if (!value.trim()) return null
  return (
    <p className="text-[13px] leading-snug text-gray-800 min-w-0">
      <span className="text-gray-400 select-none">{label}</span>
      <span className={cn('break-words', mono && 'font-mono text-[12px]')}> {value}</span>
    </p>
  )
}

function EmailMessageHeader({
  subject,
  deliveredAt,
  lines,
  messageId,
}: {
  subject: string
  deliveredAt: string
  lines: { label: string; value: string; mono?: boolean }[]
  messageId?: string | null
}) {
  const dateStr = formatDate(deliveredAt)
  const relative = formatRelativeCreated(deliveredAt)

  return (
    <header className="shrink-0 border-b border-gray-100 pb-4 mb-4">
      <h2 className="text-xl font-semibold text-gray-900 leading-tight pr-8">{subject}</h2>
      <p className="text-xs text-gray-400 mt-1">
        {dateStr}
        <span className="mx-1.5 text-gray-300">·</span>
        {relative}
      </p>
      <div className="mt-3 space-y-0.5">
        {lines.map((line) => (
          <EmailHeaderLine key={line.label} {...line} />
        ))}
      </div>
      {messageId ? (
        <p className="mt-2 font-mono text-[10px] text-gray-400 break-all leading-relaxed">
          {messageId}
        </p>
      ) : null}
    </header>
  )
}

function MissiveEmailBody({
  detail,
  loading,
  error,
}: {
  detail: MissiveEmailDetail | null
  loading: boolean
  error: string | null
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-16">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading email…
      </div>
    )
  }
  if (error) {
    return <p className="text-sm text-red-600 py-8">{error}</p>
  }
  if (!detail) return null

  const headerLines = [
    { label: 'From: ', value: detail.fromLabel },
    { label: 'To: ', value: detail.toLabel },
    { label: 'Cc: ', value: detail.ccLabel },
    { label: 'Bcc: ', value: detail.bccLabel },
    { label: 'Reply-To: ', value: detail.replyToLabel },
    { label: 'Author: ', value: detail.authorLabel ?? '' },
  ].filter((l) => l.value.trim())

  return (
    <>
      <EmailMessageHeader
        subject={detail.subject}
        deliveredAt={detail.deliveredAt}
        lines={headerLines}
        messageId={detail.emailMessageId}
      />

      {detail.bodyHtml ? (
        <div
          className="text-[15px] leading-relaxed text-gray-800 prose prose-sm max-w-none [&_img]:max-w-full [&_a]:text-gray-900"
          dangerouslySetInnerHTML={{ __html: detail.bodyHtml }}
        />
      ) : (
        <p className="text-[15px] text-gray-600 whitespace-pre-wrap">
          {detail.preview || 'No body content.'}
        </p>
      )}

      {detail.attachments.length > 0 ? (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">
            {detail.attachments.length} attachment
            {detail.attachments.length !== 1 ? 's' : ''}
          </p>
          <ul className="flex flex-wrap gap-2">
            {detail.attachments.map((a) =>
              a.url ? (
                <li key={a.id}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    {a.filename}
                    {a.size != null ? ` · ${formatBytes(a.size)}` : ''}
                  </a>
                </li>
              ) : (
                <li
                  key={a.id}
                  className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700"
                >
                  {a.filename}
                </li>
              )
            )}
          </ul>
        </div>
      ) : null}
    </>
  )
}

function PipelineEmailBody({
  send,
  template,
}: {
  send: OutreachSend
  template: EmailTemplate | undefined
}) {
  const statusLabel =
    send.status === 'queued' ? 'Queued' : send.status === 'sent' ? 'Sent' : 'Skipped'

  const headerLines = [
    { label: 'To: ', value: send.email, mono: true },
    { label: 'Status: ', value: statusLabel },
  ]

  return (
    <>
      <EmailMessageHeader
        subject={template?.subject ?? send.templateName}
        deliveredAt={send.sentAt}
        lines={headerLines}
      />

      {template ? (
        <p className="text-[15px] text-gray-700 whitespace-pre-wrap leading-relaxed">
          {template.bodyPreview}
        </p>
      ) : (
        <p className="text-sm text-gray-500">No template content available.</p>
      )}

      {send.status === 'queued' ? (
        <p className="mt-4 text-xs text-gray-500 border-t border-gray-100 pt-4">
          Queued in the pipeline — not sent via Missive yet.
        </p>
      ) : null}
    </>
  )
}

function SentEmailsDialog({
  open,
  onOpenChange,
  items,
  selectedId,
  onSelectId,
  missiveDetails,
  detailLoading,
  detailError,
  templateById,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: PreviewItem[]
  selectedId: string | null
  onSelectId: (id: string) => void
  missiveDetails: Map<string, MissiveEmailDetail>
  detailLoading: boolean
  detailError: string | null
  templateById: Map<string, EmailTemplate>
}) {
  const selected = items.find((item) => previewItemId(item) === selectedId) ?? items[0]
  const selectedMissive =
    selected?.kind === 'missive' ? missiveDetails.get(selected.email.messageId) : null
  const missiveWebUrl =
    selected?.kind === 'missive' ? selected.email.missiveWebUrl : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 gap-0 flex flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader className="shrink-0 px-4 py-3 border-b border-gray-100 pr-12">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold">Sent emails</DialogTitle>
            {missiveWebUrl ? (
              <Button variant="outline" size="sm" className="h-8" asChild>
                <a href={missiveWebUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open in Missive
                </a>
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <aside className="w-56 shrink-0 border-r border-gray-100 bg-gray-50/40 overflow-y-auto p-2 space-y-2 sm:w-64">
            {items.map((item) => (
              <EmailNavCard
                key={previewItemId(item)}
                item={item}
                selected={previewItemId(item) === (selectedId ?? previewItemId(items[0]))}
                onSelect={() => onSelectId(previewItemId(item))}
              />
            ))}
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
            {selected ? (
              selected.kind === 'missive' ? (
                <MissiveEmailBody
                  detail={selectedMissive ?? null}
                  loading={detailLoading}
                  error={detailError}
                />
              ) : (
                <PipelineEmailBody
                  send={selected.send}
                  template={templateById.get(selected.send.templateId)}
                />
              )
            ) : (
              <p className="text-sm text-gray-500 py-8">Select an email.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ContactMissiveSentEmails({
  contactId,
  conversationIds,
  outreachSends,
  templates,
}: {
  contactId: string
  conversationIds: string[]
  outreachSends: OutreachSend[]
  templates: EmailTemplate[]
}) {
  const [missiveEmails, setMissiveEmails] = useState<MissiveSentEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [missiveDetails, setMissiveDetails] = useState<Map<string, MissiveEmailDetail>>(
    () => new Map()
  )
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const templateById = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates]
  )

  const pipelineRows = useMemo(
    () => pipelineSendsForContact(outreachSends, contactId),
    [outreachSends, contactId]
  )

  const previewItems = useMemo((): PreviewItem[] => {
    const items: PreviewItem[] = missiveEmails.map((email) => ({ kind: 'missive', email }))
    for (const send of pipelineRows) {
      if (send.status === 'queued') {
        items.push({ kind: 'pipeline', send })
        continue
      }
      if (conversationIds.length === 0) {
        items.push({ kind: 'pipeline', send })
      }
    }
    return items.sort((a, b) => {
      const at = a.kind === 'missive' ? a.email.deliveredAt : a.send.sentAt
      const bt = b.kind === 'missive' ? b.email.deliveredAt : b.send.sentAt
      return bt.localeCompare(at)
    })
  }, [missiveEmails, pipelineRows, conversationIds.length])

  const loadMissiveDetail = useCallback(async (email: MissiveSentEmail) => {
    let alreadyLoaded = false
    setMissiveDetails((prev) => {
      alreadyLoaded = prev.has(email.messageId)
      return prev
    })
    if (alreadyLoaded) {
      setDetailError(null)
      setDetailLoading(false)
      return
    }

    setDetailLoading(true)
    setDetailError(null)
    try {
      const detail = await fetchMissiveEmailDetail(
        email.messageId,
        email.conversationId,
        email.missiveWebUrl
      )
      setMissiveDetails((prev) => {
        const next = new Map(prev)
        next.set(email.messageId, detail)
        return next
      })
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load email')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const openModal = (item: PreviewItem) => {
    setSelectedId(previewItemId(item))
    setModalOpen(true)
  }

  useEffect(() => {
    if (!modalOpen || !selectedId) return
    const item = previewItems.find((i) => previewItemId(i) === selectedId)
    if (item?.kind === 'missive') {
      void loadMissiveDetail(item.email)
    } else {
      setDetailLoading(false)
      setDetailError(null)
    }
  }, [selectedId, modalOpen, previewItems, loadMissiveDetail])

  useEffect(() => {
    if (conversationIds.length === 0) {
      setMissiveEmails([])
      setFetchError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setFetchError(null)

    fetchMissiveSentEmails(conversationIds)
      .then(({ emails, error }) => {
        if (cancelled) return
        setMissiveEmails(emails)
        if (error) setFetchError(error)
      })
      .catch((err) => {
        if (cancelled) return
        setMissiveEmails([])
        setFetchError(err instanceof Error ? err.message : 'Failed to load Missive emails')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [conversationIds.join(',')])

  if (conversationIds.length === 0 && pipelineRows.length === 0) return null

  return (
    <>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Sent emails</p>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading…
          </div>
        ) : null}

        {fetchError && !loading ? (
          <p className="text-xs text-amber-700 mb-1">{fetchError}</p>
        ) : null}

        {!loading && previewItems.length === 0 ? (
          <p className="text-xs text-gray-400 py-1">No sent emails yet.</p>
        ) : (
          <ul className="space-y-2">
            {previewItems.map((item) =>
              item.kind === 'missive' ? (
                <SentEmailPreviewRow
                  key={`m-${item.email.messageId}`}
                  subject={item.email.subject}
                  recipientLine={item.email.toLabel}
                  preview={item.email.preview}
                  timeLabel={formatRelativeCreated(item.email.deliveredAt)}
                  missiveWebUrl={item.email.missiveWebUrl}
                  onView={() => openModal(item)}
                />
              ) : (
                <SentEmailPreviewRow
                  key={`p-${item.send.id}`}
                  subject={item.send.templateName}
                  recipientLine={item.send.email}
                  preview=""
                  timeLabel={formatRelativeCreated(item.send.sentAt)}
                  statusLabel={item.send.status === 'queued' ? 'Queued' : undefined}
                  onView={() => openModal(item)}
                />
              )
            )}
          </ul>
        )}
      </div>

      <SentEmailsDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        items={previewItems}
        selectedId={selectedId}
        onSelectId={setSelectedId}
        missiveDetails={missiveDetails}
        detailLoading={detailLoading}
        detailError={detailError}
        templateById={templateById}
      />
    </>
  )
}
