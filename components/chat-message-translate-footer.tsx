'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ChatMessageTranslateFooterMode = 'idle' | 'conversation'

export function ChatMessageTranslateFooter({
  mode = 'conversation',
  rawText,
  targetLang,
  translatedText,
  isTranslating,
  onHide,
  bubbleVariant,
}: {
  mode: ChatMessageTranslateFooterMode
  rawText: string | null | undefined
  targetLang: string
  translatedText?: string | null
  isTranslating: boolean
  onHide: () => void
  bubbleVariant: 'gradient' | 'white'
}) {
  if (mode !== 'conversation') return null

  const t = rawText?.trim()
  if (!t) return null

  if (!translatedText && !isTranslating) return null

  const linkCls =
    bubbleVariant === 'gradient'
      ? 'inline-flex items-center gap-1 text-[10px] font-medium text-white/85 hover:text-white underline underline-offset-2'
      : 'inline-flex items-center gap-1 text-[10px] font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2'

  const blockCls =
    bubbleVariant === 'gradient'
      ? 'mt-1.5 border-t border-white/25 pt-1.5 text-xs text-white/95 italic whitespace-pre-wrap break-words'
      : 'mt-1.5 border-t border-gray-100 pt-1.5 text-xs text-gray-700 italic whitespace-pre-wrap break-words'

  return (
    <div className="mt-1">
      {translatedText ? (
        <>
          <p className={blockCls}>{translatedText}</p>
          <button type="button" className={linkCls} onClick={onHide}>
            Hide translation
          </button>
        </>
      ) : (
        <div
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-medium',
            bubbleVariant === 'gradient' ? 'text-white/75' : 'text-gray-500'
          )}
          aria-busy={isTranslating}
        >
          <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
          Translating ({targetLang})…
        </div>
      )}
    </div>
  )
}
