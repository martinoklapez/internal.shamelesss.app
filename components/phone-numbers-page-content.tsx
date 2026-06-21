'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MessageSquare, MoreVertical, Phone, RefreshCw, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  PhoneNumberMessagesDialog,
  type PhoneNumberMessagesTarget,
} from '@/components/phone-number-messages-dialog'
import { getCountryName, getFlagEmoji } from '@/lib/countries'
import { countryCodeFromE164 } from '@/lib/normalize-phone'
import {
  PhoneNumberAssigneeDialog,
  type PhoneNumberAssigneeTarget,
} from '@/components/phone-number-assignee-dialog'
import { notifyError } from '@/lib/notify'
import { cn } from '@/lib/utils'
import type {
  PhoneNumberAssignmentContext,
  PhoneNumberWithMeta,
} from '@/lib/database/phone-numbers'

function assignmentLinkLabel(assignment: PhoneNumberAssignmentContext): {
  text: string
  unlinked: boolean
} {
  if (assignment.icloud) {
    return { text: `iCloud · ${assignment.icloud.alias}`, unlinked: false }
  }
  if (assignment.social_accounts.length > 0) {
    const first = assignment.social_accounts[0]!
    const extra =
      assignment.social_accounts.length > 1
        ? ` +${assignment.social_accounts.length - 1}`
        : ''
    return { text: `${first.platform} @${first.username}${extra}`, unlinked: false }
  }
  if (assignment.devices.length > 0) {
    return { text: `Device ${assignment.devices[0]!.id}`, unlinked: false }
  }
  return { text: 'Not linked', unlinked: true }
}

function formatPhoneCountry(country: string | null, e164: string): string | null {
  const code = country ?? countryCodeFromE164(e164)
  if (!code) return null
  const name = getCountryName(code)
  const flag = getFlagEmoji(code)
  return flag ? `${flag} ${name}` : name
}

function AssigneeCell({
  name,
  profilePicture,
}: {
  name: string | null
  profilePicture: string | null
}) {
  if (!name) {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 bg-gray-50">
          <User className="h-4 w-4 text-gray-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">Unassigned</p>
          <p className="text-xs text-gray-400">No assignee</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className="h-9 w-9 shrink-0 border border-gray-200">
        {profilePicture ? (
          <AvatarImage src={profilePicture} alt={name} />
        ) : null}
        <AvatarFallback className="bg-gray-100 text-xs font-medium text-gray-600">
          {name[0]?.toUpperCase() ?? 'U'}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{name}</p>
        <p className="text-xs text-gray-500">Assignee</p>
      </div>
    </div>
  )
}

export default function PhoneNumbersPageContent({
  isPhoneAdmin,
  currentUserId,
}: {
  isPhoneAdmin: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const phoneFromQuery = searchParams.get('phone')
  const [numbers, setNumbers] = useState<PhoneNumberWithMeta[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showMyNumbers, setShowMyNumbers] = useState(false)
  const [messagesPhone, setMessagesPhone] = useState<PhoneNumberMessagesTarget | null>(null)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [assignPhone, setAssignPhone] = useState<PhoneNumberAssigneeTarget | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)

  const refreshNumbers = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/api/phone-numbers')
      if (!res.ok) throw new Error('Failed to load phone numbers')
      const data = (await res.json()) as PhoneNumberWithMeta[]
      setNumbers(data)
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Failed to load numbers')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void refreshNumbers()
  }, [refreshNumbers])

  useEffect(() => {
    if (!phoneFromQuery || loadingList) return
    const match = numbers.find((n) => n.id === phoneFromQuery)
    if (match) {
      setMessagesPhone({
        id: match.id,
        e164: match.e164,
        friendly_name: match.friendly_name,
      })
      setMessagesOpen(true)
      router.replace('/phone-numbers', { scroll: false })
    }
  }, [phoneFromQuery, loadingList, numbers, router])

  const openMessages = (n: PhoneNumberWithMeta) => {
    setMessagesPhone({
      id: n.id,
      e164: n.e164,
      friendly_name: n.friendly_name,
    })
    setMessagesOpen(true)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/phone-numbers/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Sync failed')
      }
      await refreshNumbers()
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const openAssignDialog = (n: PhoneNumberWithMeta) => {
    setAssignPhone({
      id: n.id,
      e164: n.e164,
      assigned_user_id: n.assigned_user_id,
      assigned_user_name: n.assigned_user_name,
      assigned_user_profile_picture: n.assigned_user_profile_picture,
    })
    setAssignOpen(true)
  }

  const handleMessagesUpdated = useCallback(() => {
    void refreshNumbers()
  }, [refreshNumbers])

  const filteredNumbers =
    isPhoneAdmin && showMyNumbers
      ? numbers.filter((n) => n.assigned_user_id === currentUserId)
      : numbers

  const numbersFilter = (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowMyNumbers(false)}
        className={`h-8 px-4 transition-all ${
          !showMyNumbers
            ? 'border border-gray-200 bg-white font-semibold text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        All Numbers
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowMyNumbers(true)}
        className={`h-8 px-4 transition-all ${
          showMyNumbers
            ? 'border border-gray-200 bg-white font-semibold text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        My Numbers
      </Button>
    </div>
  )

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {isPhoneAdmin ? numbersFilter : <div />}
        {isPhoneAdmin && (
          <Button variant="outline" size="sm" onClick={() => void handleSync()} disabled={syncing}>
            <RefreshCw className={cn('mr-2 h-4 w-4', syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync from Twilio'}
          </Button>
        )}
      </div>

      {loadingList ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-gray-200 bg-gray-50" />
          ))}
        </div>
      ) : numbers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-6 py-16 text-center">
          <Phone className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {isPhoneAdmin ? 'No phone numbers yet.' : 'No numbers assigned to you.'}
            {isPhoneAdmin && ' Sync from Twilio to populate your directory.'}
          </p>
        </div>
      ) : filteredNumbers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-6 py-16 text-center">
          <Phone className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {isPhoneAdmin && showMyNumbers
              ? 'No numbers assigned to you.'
              : 'No phone numbers yet.'}
            {isPhoneAdmin && !showMyNumbers && ' Sync from Twilio to populate your directory.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNumbers.map((n) => {
            const link = assignmentLinkLabel(n.assignment)
            const countryLabel = formatPhoneCountry(n.country, n.e164)
            return (
              <div
                key={n.id}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white transition-colors hover:border-gray-300 sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Phone className="h-4 w-4 text-gray-600" />
                  </div>

                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-4 sm:items-center sm:gap-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-mono text-base font-semibold text-gray-900">
                          {n.e164}
                        </h2>
                      </div>
                      {n.friendly_name && n.friendly_name !== n.e164 && (
                        <p className="mt-0.5 truncate text-sm text-gray-500">{n.friendly_name}</p>
                      )}
                    </div>

                    <div className="min-w-0">
                      {countryLabel ? (
                        <p className="text-sm text-gray-700">{countryLabel}</p>
                      ) : (
                        <p className="text-sm text-gray-400">—</p>
                      )}
                    </div>

                    <div className="min-w-0">
                      {isPhoneAdmin ? (
                        <button
                          type="button"
                          onClick={() => openAssignDialog(n)}
                          className="w-full rounded-md px-1 py-0.5 text-left transition-colors hover:bg-gray-50"
                        >
                          <AssigneeCell
                            name={n.assigned_user_name}
                            profilePicture={n.assigned_user_profile_picture}
                          />
                        </button>
                      ) : (
                        <AssigneeCell
                          name={n.assigned_user_name}
                          profilePicture={n.assigned_user_profile_picture}
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      {link.unlinked ? (
                        <span className="inline-block rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                          {link.text}
                        </span>
                      ) : (
                        <span className="truncate text-sm text-gray-600">{link.text}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mr-2 flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 px-3 text-xs"
                    onClick={() => openMessages(n)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Inbox
                    {n.unread_count > 0 && (
                      <Badge variant="destructive" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                        {n.unread_count}
                      </Badge>
                    )}
                  </Button>

                  {isPhoneAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-gray-500 hover:text-gray-900"
                      onClick={() => openAssignDialog(n)}
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Assign user</span>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PhoneNumberAssigneeDialog
        phone={assignPhone}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onSaved={handleMessagesUpdated}
      />

      <PhoneNumberMessagesDialog
        phone={messagesPhone}
        open={messagesOpen}
        onOpenChange={setMessagesOpen}
        onUpdated={handleMessagesUpdated}
      />
    </div>
  )
}
