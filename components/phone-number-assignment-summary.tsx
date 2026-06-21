'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Mail, Smartphone, User } from 'lucide-react'
import { getSocialPlatformImage } from '@/lib/social-platform-images'
import type { PhoneNumberAssignmentContext } from '@/lib/database/phone-numbers'

interface PhoneNumberAssignmentSummaryProps {
  assignment: PhoneNumberAssignmentContext
  compact?: boolean
  onLinkClick?: (e: React.MouseEvent) => void
}

export function PhoneNumberAssignmentSummary({
  assignment,
  compact = false,
  onLinkClick,
}: PhoneNumberAssignmentSummaryProps) {
  const unassigned =
    !assignment.icloud &&
    assignment.social_accounts.length === 0 &&
    assignment.devices.length === 0

  if (unassigned) {
    return (
      <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
        Not linked to iCloud or social
      </span>
    )
  }

  if (compact) {
    return (
      <div className="mt-1.5 space-y-1">
        {assignment.icloud && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-600 min-w-0">
            <Mail className="h-3 w-3 shrink-0 text-gray-400" />
            <Link
              href={`/devices/${assignment.icloud.device_id}`}
              className="text-blue-600 hover:underline truncate"
              onClick={onLinkClick}
            >
              iCloud {assignment.icloud.alias}
            </Link>
          </div>
        )}
        {assignment.social_accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center gap-1.5 text-[11px] text-gray-600 min-w-0"
          >
            <Image
              src={getSocialPlatformImage(account.platform)}
              alt=""
              width={12}
              height={12}
              className="shrink-0"
            />
            <Link
              href={`/devices/${account.device_id}`}
              className="text-blue-600 hover:underline truncate"
              onClick={onLinkClick}
            >
              {account.platform} @{account.username}
            </Link>
          </div>
        ))}
        {assignment.devices.map((device) => (
          <div key={device.id} className="flex items-center gap-1.5 text-[11px] text-gray-500 min-w-0">
            <Smartphone className="h-3 w-3 shrink-0 text-gray-400" />
            <span className="truncate">
              Device {device.id}
              {device.manager_name ? ` · ${device.manager_name}` : ''}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-2 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Linked to</p>

      {assignment.icloud && (
        <div className="flex items-start gap-2 text-gray-700">
          <Mail className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">iCloud · {assignment.icloud.alias}</p>
            <p className="text-xs text-gray-500">{assignment.icloud.email}</p>
            <Link
              href={`/devices/${assignment.icloud.device_id}`}
              className="text-xs text-blue-600 hover:underline"
            >
              Device {assignment.icloud.device_id}
            </Link>
          </div>
        </div>
      )}

      {assignment.social_accounts.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Social accounts (signup number)</p>
          <div className="flex flex-wrap gap-2">
            {assignment.social_accounts.map((account) => (
              <Link
                key={account.id}
                href={`/devices/${account.device_id}`}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-white border border-gray-200 text-gray-800 hover:bg-gray-50"
              >
                <Image
                  src={getSocialPlatformImage(account.platform)}
                  alt=""
                  width={14}
                  height={14}
                />
                <span>{account.platform}</span>
                <span className="font-medium">@{account.username}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {assignment.devices.map((device) => (
        <div key={device.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-700">
          <Link
            href={`/devices/${device.id}`}
            className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
          >
            <Smartphone className="h-4 w-4" />
            Device {device.id}
            {device.device_model ? ` (${device.device_model})` : ''}
          </Link>
          {device.manager_name && (
            <span className="inline-flex items-center gap-1.5 text-sm">
              {device.manager_profile_picture ? (
                <Image
                  src={device.manager_profile_picture}
                  alt=""
                  width={18}
                  height={18}
                  className="rounded-full"
                />
              ) : (
                <User className="h-4 w-4 text-gray-400" />
              )}
              {device.manager_name}
            </span>
          )}
          {device.owner && <span className="text-xs text-gray-500">Owner: {device.owner}</span>}
        </div>
      ))}

      {!assignment.icloud && assignment.social_accounts.length === 0 && (
        <p className="text-xs text-gray-500">
          Link this number from a device&apos;s iCloud profile or social account.
        </p>
      )}
    </div>
  )
}
