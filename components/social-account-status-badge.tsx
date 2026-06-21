import { Badge } from '@/components/ui/badge'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSocialStatusChipStyle } from '@/lib/social-account-status'

interface SocialAccountStatusBadgeProps {
  status: string
  /** Card trigger on device page; header = larger badge in edit modal */
  variant?: 'card' | 'menu' | 'header'
  showChevron?: boolean
  className?: string
}

export function SocialAccountStatusBadge({
  status,
  variant = 'menu',
  showChevron = false,
  className,
}: SocialAccountStatusBadgeProps) {
  const style = getSocialStatusChipStyle(status)

  return (
    <Badge
      className={cn(
        'shrink-0 font-medium capitalize tabular-nums border-0 inline-flex items-center justify-center',
        variant === 'header'
          ? 'h-7 pl-2.5 pr-1.5 gap-1 text-xs'
          : variant === 'card'
            ? 'h-5 pl-1.5 pr-1 gap-0.5 text-[10px]'
            : 'h-4 w-14 px-1.5 text-[9px]',
        className
      )}
      style={{
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      <span>{status}</span>
      {showChevron && (
        <ChevronDown
          className={cn(
            'shrink-0 opacity-80',
            variant === 'header' ? 'h-3.5 w-3.5' : 'h-3 w-3'
          )}
        />
      )}
    </Badge>
  )
}
