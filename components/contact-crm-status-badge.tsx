import {
  CONTACT_CRM_STATUS_STYLES,
  contactCrmStatusLabel,
} from '@/lib/creator-outreach/crm-status-ui'
import type { ContactCrmStatus } from '@/lib/creator-outreach/types'
import { cn } from '@/lib/utils'

export function ContactCrmStatusBadge({
  status,
  size = 'sm',
  className,
}: {
  status: ContactCrmStatus
  size?: 'sm' | 'md'
  className?: string
}) {
  const { chip, dot } = CONTACT_CRM_STATUS_STYLES[status] ?? CONTACT_CRM_STATUS_STYLES.new

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md font-medium ring-1 ring-inset',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px] leading-tight' : 'px-2.5 py-1 text-xs',
        chip,
        className
      )}
    >
      <span
        className={cn('shrink-0 rounded-full', size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2', dot)}
        aria-hidden
      />
      <span className="truncate">{contactCrmStatusLabel(status)}</span>
    </span>
  )
}
