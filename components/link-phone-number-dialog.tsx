'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PhoneNumberAssignmentSummary } from '@/components/phone-number-assignment-summary'
import { cn } from '@/lib/utils'
import { notifyError } from '@/lib/notify'
import type { PhoneNumberWithMeta } from '@/lib/database/phone-numbers'

function purposeLabel(purpose: string): string {
  switch (purpose) {
    case 'tiktok_signup':
      return 'TikTok signup'
    case 'instagram_signup':
      return 'Instagram signup'
    default:
      return 'General'
  }
}

interface LinkPhoneNumberDialogProps {
  linkType: 'icloud' | 'social'
  targetId: string
  targetLabel: string
  currentPhone?: { id: string; e164: string } | null
  onSaved?: () => void
  children?: React.ReactNode
}

export function LinkPhoneNumberDialog({
  linkType,
  targetId,
  targetLabel,
  currentPhone,
  onSaved,
  children,
}: LinkPhoneNumberDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingPhones, setLoadingPhones] = useState(false)
  const [phones, setPhones] = useState<PhoneNumberWithMeta[]>([])
  const [selectedPhoneId, setSelectedPhoneId] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (!open) return

    setLoadingPhones(true)
    void fetch('/api/phone-numbers')
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return
        const options = (data as PhoneNumberWithMeta[]).filter((n) => n.status !== 'released')
        setPhones(options)
        const preferred =
          currentPhone?.id ??
          options.find((p) => p.id === currentPhone?.id)?.id ??
          options[0]?.id ??
          ''
        setSelectedPhoneId(preferred)
      })
      .catch(() => setPhones([]))
      .finally(() => setLoadingPhones(false))
  }, [open, currentPhone?.id])

  const sortedPhones = useMemo(() => {
    return [...phones].sort((a, b) => {
      if (currentPhone?.id === a.id) return -1
      if (currentPhone?.id === b.id) return 1

      const aUnassigned =
        !a.assignment.icloud && a.assignment.social_accounts.length === 0
      const bUnassigned =
        !b.assignment.icloud && b.assignment.social_accounts.length === 0
      if (aUnassigned !== bUnassigned) return aUnassigned ? -1 : 1

      return a.e164.localeCompare(b.e164)
    })
  }, [phones, currentPhone?.id])

  const handleLink = async () => {
    if (!selectedPhoneId) {
      notifyError('Select a phone number')
      return
    }

    setIsLoading(true)
    try {
      if (linkType === 'icloud') {
        if (currentPhone && currentPhone.id !== selectedPhoneId) {
          await fetch(`/api/phone-numbers/${currentPhone.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ icloud_profile_id: null }),
          })
        }

        const res = await fetch(`/api/phone-numbers/${selectedPhoneId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icloud_profile_id: targetId }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to link phone to iCloud')
        }
      } else {
        const res = await fetch('/api/social-accounts/link-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: targetId,
            phone_number_id: selectedPhoneId,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to link phone to social account')
        }
      }

      setOpen(false)
      onSaved?.()
      router.refresh()
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Failed to link phone')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnlink = async () => {
    setIsLoading(true)
    try {
      if (linkType === 'icloud' && currentPhone) {
        const res = await fetch(`/api/phone-numbers/${currentPhone.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icloud_profile_id: null }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to unlink')
        }
      } else if (linkType === 'social') {
        const res = await fetch('/api/social-accounts/link-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: targetId, phone_number_id: null }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to unlink')
        }
      }

      setOpen(false)
      onSaved?.()
      router.refresh()
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Failed to unlink')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline">
            Link phone
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {currentPhone ? 'Change linked phone' : 'Link phone number'}
          </DialogTitle>
          <DialogDescription>
            {linkType === 'icloud'
              ? `Link a Twilio number to iCloud profile “${targetLabel}”.`
              : `Link the phone number used to create ${targetLabel}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Phone number</Label>
          <div className="max-h-64 overflow-y-auto rounded-md border border-gray-100 bg-gray-50/30 p-2 space-y-2">
            {loadingPhones ? (
              <p className="text-sm text-gray-500 text-center py-6">Loading numbers…</p>
            ) : sortedPhones.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                No numbers in inventory.{' '}
                <Link href="/phone-numbers" className="text-blue-600 hover:underline">
                  Sync from Twilio
                </Link>
              </p>
            ) : (
              sortedPhones.map((phone) => {
                const selected = phone.id === selectedPhoneId
                const isCurrent = currentPhone?.id === phone.id
                const icloudConflict =
                  linkType === 'icloud' &&
                  phone.assignment.icloud &&
                  phone.assignment.icloud.id !== targetId

                return (
                  <button
                    key={phone.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedPhoneId(phone.id)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      selected
                        ? 'border-gray-900 bg-white ring-1 ring-gray-900 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {phone.friendly_name || phone.e164}
                          </span>
                          {isCurrent && (
                            <span className="text-[11px] text-gray-500">Current</span>
                          )}
                        </div>
                        {phone.friendly_name && (
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{phone.e164}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-xs text-gray-500">
                        {phone.unread_count > 0 && (
                          <span className="text-red-600">{phone.unread_count} unread</span>
                        )}
                        {phone.unread_count > 0 && <span className="mx-1 text-gray-300">·</span>}
                        <span className="capitalize">{phone.status}</span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <PhoneNumberAssignmentSummary assignment={phone.assignment} compact />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                      <span>{purposeLabel(phone.purpose)}</span>
                      {phone.country && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span>{phone.country}</span>
                        </>
                      )}
                    </div>

                    {phone.notes && (
                      <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{phone.notes}</p>
                    )}

                    {phone.last_message_preview && (
                      <p className="mt-1.5 text-xs text-gray-600 line-clamp-1">
                        {phone.last_message_preview}
                      </p>
                    )}

                    {icloudConflict && (
                      <p className="mt-2 text-xs text-amber-700">
                        Currently linked to iCloud {phone.assignment.icloud!.alias}. Saving will move
                        it here.
                      </p>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {currentPhone && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleUnlink()}
              disabled={isLoading}
              className="mr-auto"
            >
              Unlink
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleLink()} disabled={isLoading || !selectedPhoneId}>
            {isLoading ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
