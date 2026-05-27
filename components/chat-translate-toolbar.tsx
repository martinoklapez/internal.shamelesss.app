'use client'

import { HelpCircle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CHAT_TRANSLATE_TARGETS } from '@/lib/chat-translate-config'
import { cn } from '@/lib/utils'

export function ChatTranslateToolbar({
  targetLang,
  onTargetLangChange,
  configured,
  chatTranslateActive,
  onToggleConversation,
  translatingCount = 0,
  layout = 'default',
  className,
}: {
  targetLang: string
  onTargetLangChange: (code: string) => void
  configured: boolean | null
  /** Whole-chat translation mode (viewport / lazy batches) */
  chatTranslateActive: boolean
  onToggleConversation: () => void
  /** Messages currently translating (shown next to toggle) */
  translatingCount?: number
  /** `toolbar` = single compact row for modals; `default` = stacked (e.g. Support Chat) */
  layout?: 'default' | 'toolbar'
  className?: string
}) {
  const busy = translatingCount > 0
  const isToolbar = layout === 'toolbar'

  const translateHelp = (
    <>
      {chatTranslateActive ? (
        <>
          Visible messages are translated as you scroll (up to 4 requests at a time). Results stay cached until you
          change language or leave the chat.
        </>
      ) : (
        <>Turn on translation to translate only the visible window—long threads are not processed all at once.</>
      )}{' '}
      Powered by Google Translate.
    </>
  )

  return (
    <div
      className={cn(
        isToolbar
          ? 'flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-[#fafafa] px-3 py-2'
          : 'flex flex-col gap-2 text-xs sm:flex-row sm:flex-wrap sm:items-center',
        className
      )}
    >
      <Button
        type="button"
        variant={chatTranslateActive ? 'secondary' : 'outline'}
        size="sm"
        className={cn('h-8 shrink-0 font-medium', isToolbar && 'h-9')}
        disabled={configured === false}
        onClick={onToggleConversation}
      >
        {chatTranslateActive ? 'Original' : 'Translate chat'}
        {busy ? (
          <span className="ml-1.5 rounded-md bg-background/80 px-1.5 py-px text-[10px] font-normal text-muted-foreground tabular-nums">
            {translatingCount}
          </span>
        ) : null}
      </Button>

      {isToolbar ? <span className="hidden h-5 w-px bg-border sm:block" aria-hidden /> : null}

      <div className={cn('flex flex-wrap items-center gap-2 min-w-0', isToolbar && 'flex-1')}>
        {!isToolbar ? <span className="text-muted-foreground shrink-0 text-[11px]">to</span> : null}
        <Select value={targetLang} onValueChange={onTargetLangChange}>
          <SelectTrigger
            className={cn(
              'bg-background text-xs shadow-sm',
              isToolbar ? 'h-9 w-[min(100%,10.5rem)] sm:w-40' : 'h-8 w-[min(100%,11rem)]'
            )}
          >
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            {CHAT_TRANSLATE_TARGETS.map(({ code, label }) => (
              <SelectItem key={code} value={code} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          'flex items-center gap-1.5 text-[11px]',
          isToolbar ? 'ml-auto shrink-0 sm:ml-0' : 'flex-wrap gap-x-2 gap-y-1 sm:min-w-0'
        )}
      >
        {configured === false ? (
          <span className={cn('font-medium text-amber-800', isToolbar && 'max-w-[14rem] leading-snug')}>
            Add GOOGLE_TRANSLATE_API_KEY to enable translation.
          </span>
        ) : configured === true ? (
          isToolbar ? (
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="About chat translation"
                >
                  <HelpCircle className="h-4 w-4" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="max-w-[19rem] text-xs leading-relaxed">
                {translateHelp}
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <span className="text-muted-foreground">
                {chatTranslateActive ? 'Translates visible messages as you scroll (up to ~4 at a time).' : null}
              </span>
              <span className="text-muted-foreground/80 hidden lg:inline whitespace-nowrap">
                Powered by Google Translate
              </span>
            </>
          )
        ) : null}
      </div>
    </div>
  )
}
