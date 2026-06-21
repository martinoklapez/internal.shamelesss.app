'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SmsMessage } from '@/lib/database/phone-numbers'

export function useSmsMessages(phoneNumberId: string | null) {
  const [messages, setMessages] = useState<SmsMessage[]>([])
  const [loading, setLoading] = useState(false)
  const phoneIdRef = useRef(phoneNumberId)
  const messagesRef = useRef(messages)

  phoneIdRef.current = phoneNumberId
  messagesRef.current = messages

  const refreshMessages = useCallback(async () => {
    if (!phoneNumberId) {
      setMessages([])
      return []
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/phone-numbers/${phoneNumberId}/messages`)
      if (!res.ok) throw new Error('Failed to load messages')
      const data = (await res.json()) as SmsMessage[]
      setMessages(data)
      return data
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [phoneNumberId])

  useEffect(() => {
    void refreshMessages()
  }, [refreshMessages])

  useEffect(() => {
    if (!phoneNumberId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`sms-messages-${phoneNumberId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sms_messages',
          filter: `phone_number_id=eq.${phoneNumberId}`,
        },
        (payload) => {
          const row = payload.new as SmsMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [...prev, row].sort((a, b) =>
              a.created_at.localeCompare(b.created_at)
            )
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [phoneNumberId])

  const markRead = useCallback(async () => {
    const id = phoneIdRef.current
    if (!id) return

    const hasUnread = messagesRef.current.some(
      (m) => m.direction === 'inbound' && !m.read_at
    )
    if (!hasUnread) return

    await fetch(`/api/phone-numbers/${id}/messages`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_read: true }),
    })

    setMessages((prev) =>
      prev.map((m) =>
        m.direction === 'inbound' && !m.read_at
          ? { ...m, read_at: new Date().toISOString() }
          : m
      )
    )
  }, [])

  return { messages, loading, refreshMessages, markRead }
}
