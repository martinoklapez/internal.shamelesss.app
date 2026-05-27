'use client'

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/hooks/use-toast'

/** Max simultaneous Translation API requests while scrolling */
const TRANSLATE_CONCURRENCY = 4

/** Translate rows shortly before they enter the viewport */
const OBSERVER_ROOT_MARGIN = '220px'

export type ChatTranslationHookOpts = {
  scrollRootRef: RefObject<HTMLElement | null>
  /**
   * Change when rows mount / conversation switches so IntersectionObserver rebinds once the scroll root exists.
   */
  observeKey?: string | number
}

type TranslateInternalsOpts = {
  quiet?: boolean
}

export function useChatTranslation({
  scrollRootRef,
  observeKey = 0,
}: ChatTranslationHookOpts) {
  const { toast } = useToast()

  const [configured, setConfigured] = useState<boolean | null>(null)
  const [targetLang, setTargetLang] = useState('en')
  const [byMessageId, setByMessageId] = useState<Record<string, string>>({})
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({})
  const [chatTranslateActive, setChatTranslateActive] = useState(false)

  const byMessageIdRef = useRef(byMessageId)
  const pendingIdsRef = useRef(pendingIds)
  const chatTranslateActiveRef = useRef(chatTranslateActive)
  useEffect(() => {
    byMessageIdRef.current = byMessageId
  }, [byMessageId])
  useEffect(() => {
    pendingIdsRef.current = pendingIds
  }, [pendingIds])
  useEffect(() => {
    chatTranslateActiveRef.current = chatTranslateActive
  }, [chatTranslateActive])

  const observerRef = useRef<IntersectionObserver | null>(null)
  const rowRegistryRef = useRef<Map<string, { el: Element; text: string }>>(new Map())
  const queueRef = useRef<string[]>([])
  const queuedSetRef = useRef(new Set<string>())
  const inFlightRef = useRef(0)
  /** Bumped with `targetLang` / `observeKey` so stale HTTP responses cannot apply to the wrong chat */
  const translateEpochRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/translate')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        setConfigured(Boolean(j?.configured))
      })
      .catch(() => {
        if (!cancelled) setConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Language or inbox changed: drop caches, ignore in-flight completions for the previous epoch */
  useEffect(() => {
    translateEpochRef.current += 1
    setByMessageId({})
    setPendingIds({})
    queuedSetRef.current.clear()
    queueRef.current = []
  }, [targetLang, observeKey])

  const translateInternal = useCallback(
    async (messageId: string, text: string, tOpts: TranslateInternalsOpts = {}) => {
      const trimmed = text.trim()
      if (!trimmed) return

      const epochStart = translateEpochRef.current

      setPendingIds((p) => ({ ...p, [messageId]: true }))
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed, target: targetLang }),
        })
        const j = await res.json()
        if (translateEpochRef.current !== epochStart) return
        if (!res.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Translation failed')
        const translated = typeof j?.translatedText === 'string' ? j.translatedText : ''
        if (!translated) throw new Error('Empty translation')
        if (translateEpochRef.current !== epochStart) return
        setByMessageId((prev) => ({ ...prev, [messageId]: translated }))
      } catch (e) {
        if (translateEpochRef.current !== epochStart) return
        if (!tOpts.quiet) {
          toast({
            title: 'Translation failed',
            description: e instanceof Error ? e.message : 'Unknown error',
            variant: 'destructive',
          })
        }
      } finally {
        if (translateEpochRef.current === epochStart) {
          setPendingIds((p) => {
            const next = { ...p }
            delete next[messageId]
            return next
          })
        }
        queuedSetRef.current.delete(messageId)
        queueRef.current = queueRef.current.filter((id) => id !== messageId)
      }
    },
    [targetLang, toast]
  )

  const pumpQueue = useCallback(() => {
    while (inFlightRef.current < TRANSLATE_CONCURRENCY && queueRef.current.length > 0) {
      const id = queueRef.current.shift()
      if (!id) break
      const row = rowRegistryRef.current.get(id)
      const text = row?.text ?? ''
      if (!text.trim()) {
        queuedSetRef.current.delete(id)
        continue
      }
      if (byMessageIdRef.current[id] || pendingIdsRef.current[id]) {
        queuedSetRef.current.delete(id)
        continue
      }
      if (!chatTranslateActiveRef.current) {
        queuedSetRef.current.delete(id)
        continue
      }
      inFlightRef.current += 1
      queuedSetRef.current.delete(id)
      void translateInternal(id, text, { quiet: true }).finally(() => {
        inFlightRef.current = Math.max(0, inFlightRef.current - 1)
        pumpQueue()
      })
    }
  }, [translateInternal])

  const requestTranslateVisible = useCallback(
    (messageId: string) => {
      if (!chatTranslateActiveRef.current) return
      const row = rowRegistryRef.current.get(messageId)
      const text = row?.text ?? ''
      if (!text.trim()) return
      if (byMessageIdRef.current[messageId] || pendingIdsRef.current[messageId]) return
      if (queuedSetRef.current.has(messageId)) return

      queuedSetRef.current.add(messageId)
      queueRef.current.push(messageId)
      pumpQueue()
    },
    [pumpQueue]
  )

  const disconnectObserver = useCallback(() => {
    observerRef.current?.disconnect()
    observerRef.current = null
  }, [])

  /** Bind IntersectionObserver to scroll root whenever layout or translation mode changes */
  useEffect(() => {
    disconnectObserver()
    const root = scrollRootRef.current
    if (!root || !chatTranslateActive) return

    const io = new IntersectionObserver(
      (entries) => {
        if (!chatTranslateActiveRef.current) return
        for (const en of entries) {
          const id = (en.target as HTMLElement).dataset.translateRow
          if (!id) continue
          if (en.isIntersecting) {
            requestTranslateVisible(id)
          }
        }
      },
      { root, rootMargin: OBSERVER_ROOT_MARGIN, threshold: 0 }
    )
    observerRef.current = io

    for (const [id, { el }] of rowRegistryRef.current.entries()) {
      const text = rowRegistryRef.current.get(id)?.text?.trim()
      if (!text) continue
      io.observe(el)
    }

    return () => {
      io.disconnect()
      if (observerRef.current === io) observerRef.current = null
    }
  }, [
    observeKey,
    chatTranslateActive,
    targetLang,
    scrollRootRef,
    disconnectObserver,
    requestTranslateVisible,
  ])

  /** Programmatic translate (shows toast on error) */
  const translate = useCallback(
    async (messageId: string, text: string) => translateInternal(messageId, text),
    [translateInternal]
  )

  const hideTranslation = useCallback((messageId: string) => {
    setByMessageId((prev) => {
      const next = { ...prev }
      delete next[messageId]
      return next
    })
  }, [])

  const observeMessageRow = useCallback(
    (messageId: string, rawText: string | null | undefined) => {
      return (rowEl: HTMLDivElement | null) => {
        const trimmed = typeof rawText === 'string' ? rawText.trim() : ''

        const prevEntry = rowRegistryRef.current.get(messageId)
        const prevEl = prevEntry?.el
        const io = observerRef.current

        if (prevEl && prevEl !== rowEl) {
          try {
            io?.unobserve(prevEl)
          } catch {
            /* ignore */
          }
        }

        if (!rowEl || !trimmed) {
          rowRegistryRef.current.delete(messageId)
          return
        }

        rowRegistryRef.current.set(messageId, { el: rowEl, text: trimmed })

        if (trimmed && io && chatTranslateActiveRef.current && scrollRootRef.current) {
          io.observe(rowEl)
        }
      }
    },
    [scrollRootRef]
  )

  const stopChatTranslate = useCallback(() => {
    setChatTranslateActive(false)
    setByMessageId({})
    setPendingIds({})
    queuedSetRef.current.clear()
    queueRef.current = []
    inFlightRef.current = 0
    disconnectObserver()
  }, [disconnectObserver])

  const startChatTranslate = useCallback(() => {
    if (configured === false) {
      toast({
        title: 'Translation unavailable',
        description: 'Configure GOOGLE_TRANSLATE_API_KEY on the server.',
        variant: 'destructive',
      })
      return
    }
    setChatTranslateActive(true)
  }, [configured, toast])

  const toggleChatTranslate = useCallback(() => {
    setChatTranslateActive((active) => {
      if (active) {
        setByMessageId({})
        setPendingIds({})
        queuedSetRef.current.clear()
        queueRef.current = []
        inFlightRef.current = 0
        disconnectObserver()
        return false
      }
      if (configured === false) {
        toast({
          title: 'Translation unavailable',
          description: 'Configure GOOGLE_TRANSLATE_API_KEY on the server.',
          variant: 'destructive',
        })
        return false
      }
      return true
    })
  }, [configured, disconnectObserver, toast])

  return {
    configured,
    targetLang,
    setTargetLang,
    byMessageId,
    pendingIds,
    translate,
    hideTranslation,

    chatTranslateActive,
    startChatTranslate,
    stopChatTranslate,
    toggleChatTranslate,

    observeMessageRow,
  }
}
