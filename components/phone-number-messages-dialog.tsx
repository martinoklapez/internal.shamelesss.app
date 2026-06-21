'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSmsMessages } from '@/hooks/use-sms-messages'
import { cn } from '@/lib/utils'

export type PhoneNumberMessagesTarget = {
  id: string
  e164: string
  friendly_name?: string | null
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function PhoneNumberMessagesDialog({
  phone,
  open,
  onOpenChange,
  onUpdated,
}: {
  phone: PhoneNumberMessagesTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}) {
  const phoneId = open && phone ? phone.id : null
  const { messages, loading: loadingMessages, markRead } = useSmsMessages(phoneId)
  const onUpdatedRef = useRef(onUpdated)

  onUpdatedRef.current = onUpdated

  const unreadCount = useMemo(
    () => messages.filter((m) => m.direction === 'inbound' && !m.read_at).length,
    [messages]
  )

  useEffect(() => {
    if (!open || !phoneId || unreadCount === 0) return

    void markRead().then(() => {
      onUpdatedRef.current?.()
    })
  }, [open, phoneId, unreadCount, markRead])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-gray-100 px-6 py-4">
          <DialogTitle className="font-mono text-base">{phone?.e164 ?? 'Messages'}</DialogTitle>
          <DialogDescription>
            {phone?.friendly_name && phone.friendly_name !== phone.e164
              ? phone.friendly_name
              : 'Received SMS for this number'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loadingMessages && messages.length === 0 ? (
            <p className="text-sm text-gray-500">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-gray-500">No messages yet.</p>
          ) : (
            <ul className="space-y-3">
              {[...messages].reverse().map((m) => {
                const inbound = m.direction === 'inbound'
                return (
                  <li
                    key={m.id}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-sm',
                      inbound
                        ? 'border-blue-100 bg-blue-50/40'
                        : 'border-gray-100 bg-gray-50/50'
                    )}
                  >
                    <p className="text-xs text-gray-500">
                      {formatTime(m.created_at)} ·{' '}
                      {inbound ? `From ${m.from_e164}` : `To ${m.to_e164}`}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-gray-900">{m.body}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
