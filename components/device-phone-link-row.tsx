'use client'

import { forwardRef, useState } from 'react'
import { Check, Copy, Phone } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { LinkPhoneNumberDialog } from '@/components/link-phone-number-dialog'
import {
  PhoneNumberMessagesDialog,
  type PhoneNumberMessagesTarget,
} from '@/components/phone-number-messages-dialog'
import { cn } from '@/lib/utils'

export interface DevicePhoneSummary {
  id: string
  e164: string
  friendly_name?: string | null
}

interface DevicePhoneLinkRowProps {
  phone?: DevicePhoneSummary | null
  linkType: 'icloud' | 'social'
  targetId: string
  targetLabel: string
  variant?: 'boxed' | 'credentials'
  className?: string
  onCopyPhone?: () => void
  copiedPhone?: boolean
}

const LinkNumberButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & { label?: string }
>(({ label = 'Link number', className, ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    variant="outline"
    size="sm"
    className={cn(
      'h-7 gap-1.5 px-2.5 text-xs font-normal text-gray-600 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50',
      className
    )}
    {...props}
  >
    <Phone className="h-3 w-3 text-gray-400" />
    {label}
  </Button>
))
LinkNumberButton.displayName = 'LinkNumberButton'

function toMessagesTarget(phone: DevicePhoneSummary): PhoneNumberMessagesTarget {
  return {
    id: phone.id,
    e164: phone.e164,
    friendly_name: phone.friendly_name,
  }
}

export function DevicePhoneLinkRow({
  phone,
  linkType,
  targetId,
  targetLabel,
  variant = 'boxed',
  className,
  onCopyPhone,
  copiedPhone,
}: DevicePhoneLinkRowProps) {
  const [messagesOpen, setMessagesOpen] = useState(false)

  if (variant === 'credentials') {
    return (
      <>
        <div
          className={cn(
            'flex items-center min-w-0',
            phone ? 'justify-between gap-3' : 'justify-end',
            className
          )}
        >
          {phone && (
            <div className="flex items-center gap-2 shrink-0">
              <Phone className="h-4 w-4 text-gray-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Phone:</span>
            </div>
          )}
          {phone ? (
            <div className="flex items-center gap-2 min-w-0 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs shrink-0"
                onClick={() => setMessagesOpen(true)}
              >
                SMS
              </Button>
              <LinkPhoneNumberDialog
                linkType={linkType}
                targetId={targetId}
                targetLabel={targetLabel}
                currentPhone={{ id: phone.id, e164: phone.e164 }}
              >
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs shrink-0">
                  Change
                </Button>
              </LinkPhoneNumberDialog>
              <span className="text-sm font-medium font-mono text-gray-900 dark:text-white truncate">
                {phone.e164}
              </span>
              {onCopyPhone && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={onCopyPhone}
                >
                  {copiedPhone ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          ) : (
            <LinkPhoneNumberDialog
              linkType={linkType}
              targetId={targetId}
              targetLabel={targetLabel}
              currentPhone={null}
            >
              <LinkNumberButton />
            </LinkPhoneNumberDialog>
          )}
        </div>
        {phone && (
          <PhoneNumberMessagesDialog
            phone={toMessagesTarget(phone)}
            open={messagesOpen}
            onOpenChange={setMessagesOpen}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50/80 px-3 py-2',
          phone ? 'justify-between' : 'justify-end',
          className
        )}
      >
        {phone ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-mono text-gray-900 truncate">{phone.e164}</p>
                {phone.friendly_name && (
                  <p className="text-[10px] text-gray-500 truncate">{phone.friendly_name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setMessagesOpen(true)}
              >
                SMS
              </Button>
              <LinkPhoneNumberDialog
                linkType={linkType}
                targetId={targetId}
                targetLabel={targetLabel}
                currentPhone={{ id: phone.id, e164: phone.e164 }}
              >
                <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                  Change
                </Button>
              </LinkPhoneNumberDialog>
            </div>
          </>
        ) : (
          <LinkPhoneNumberDialog
            linkType={linkType}
            targetId={targetId}
            targetLabel={targetLabel}
            currentPhone={null}
          >
            <LinkNumberButton />
          </LinkPhoneNumberDialog>
        )}
      </div>
      {phone && (
        <PhoneNumberMessagesDialog
          phone={toMessagesTarget(phone)}
          open={messagesOpen}
          onOpenChange={setMessagesOpen}
        />
      )}
    </>
  )
}
