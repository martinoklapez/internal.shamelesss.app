'use client'

import { useEffect, useRef } from 'react'
import { ChevronLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Matches app sidebar width (16rem); panel is slightly wider for forms. */
export const OUTREACH_PANEL_WIDTH_CLASS = 'w-80'

type OutreachPushPanelProps = {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  headerActions?: React.ReactNode
  /** When true, the close (X) control is hidden — use with headerActions e.g. Save/Cancel. */
  hideClose?: boolean
  /** Navigate to the previous panel in the stack (e.g. creator before profile). */
  onBack?: () => void
  children: React.ReactNode
}

export function OutreachPushPanel({
  open,
  onClose,
  title,
  headerActions,
  hideClose = false,
  onBack,
  children,
}: OutreachPushPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [open, title])

  return (
    <aside
      className={cn(
        'relative flex h-full min-h-0 shrink-0 flex-col bg-white transition-[width] duration-300 ease-in-out',
        open ? cn(OUTREACH_PANEL_WIDTH_CLASS, 'border-l border-gray-200') : 'w-0 overflow-hidden'
      )}
    >
      <div
        ref={scrollRef}
        className={cn(
          'flex h-full min-h-0 flex-col overflow-y-auto p-6',
          OUTREACH_PANEL_WIDTH_CLASS
        )}
      >
        <div className="flex items-start justify-between gap-2 shrink-0 mb-6">
          <div className="flex min-w-0 flex-1 items-start gap-1">
            {onBack ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-gray-500 -ml-1"
                onClick={onBack}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
            ) : null}
            <div className="min-w-0 flex-1 text-base font-semibold text-gray-900 leading-tight pt-1">
              {title}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {headerActions}
            {!hideClose && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close panel</span>
              </Button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 text-sm">{children}</div>
      </div>
    </aside>
  )
}
