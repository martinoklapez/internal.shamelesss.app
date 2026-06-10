'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  type CalBookingMeetingDetails,
  hostInitials,
  resolveCalBookingMeetingDetails,
} from '@/lib/creator-outreach/cal-booking'
import { cn } from '@/lib/utils'

type CalBookingWidgetProps = {
  details?: Partial<CalBookingMeetingDetails>
  className?: string
  compact?: boolean
}

export function CalBookingWidget({ details, className, compact = false }: CalBookingWidgetProps) {
  const meeting = resolveCalBookingMeetingDetails(details)

  if (!meeting.url) {
    return (
      <div
        className={cn(
          compact
            ? 'rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2 text-[10px] text-gray-400'
            : 'max-w-sm rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-3 text-xs text-gray-500',
          className
        )}
      >
        {compact ? 'Add a booking URL' : (
          <>
            Add a booking URL on Pipeline → Senders to enable the{' '}
            <code className="font-mono text-[10px]">{'{{book_meeting}}'}</code> card.
          </>
        )}
      </div>
    )
  }

  const displayHost = meeting.hostName?.trim()
  const initials = hostInitials(displayHost || meeting.meetingName)

  const CardBody = compact ? (
    <div className="rounded-lg border border-gray-200/90 bg-white px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-8 w-8 border border-gray-200 bg-gray-100">
          {meeting.hostAvatarUrl ? (
            <AvatarImage src={meeting.hostAvatarUrl} alt={displayHost || 'Host'} />
          ) : null}
          <AvatarFallback className="bg-gray-100 text-[10px] font-medium text-gray-600">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-gray-900">{meeting.meetingName}</p>
          <p className="truncate text-[10px] text-gray-400">
            {meeting.meetingType} · {meeting.duration}
          </p>
        </div>
      </div>
      <span className="mt-2.5 block w-full rounded-lg bg-[#ff5352] px-3 py-2 text-center text-[11px] font-semibold text-black">
        {meeting.actionLabel}
      </span>
    </div>
  ) : (
    <div className="rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 border border-gray-200 bg-gray-100">
          {meeting.hostAvatarUrl ? (
            <AvatarImage src={meeting.hostAvatarUrl} alt={displayHost || 'Host'} />
          ) : null}
          <AvatarFallback className="bg-gray-100 text-[11px] font-medium text-gray-600">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 pt-0.5">
          <p className="text-[11px] text-gray-500">
            {displayHost ? `Call with ${displayHost}` : 'Schedule a call'}
          </p>
          <p className="mt-0.5 text-sm font-medium text-gray-900">{meeting.meetingName}</p>
          <p className="mt-1 text-xs text-gray-400">
            {meeting.meetingType} · {meeting.duration}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <span className="block w-full rounded-lg bg-[#ff5352] px-4 py-2.5 text-center text-sm font-semibold text-black shadow-sm">
          {meeting.actionLabel}
        </span>
      </div>
    </div>
  )

  return (
    <a
      href={meeting.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'block no-underline transition-colors hover:opacity-95',
        compact ? 'max-w-[17rem]' : 'max-w-sm',
        className
      )}
    >
      {CardBody}
    </a>
  )
}
