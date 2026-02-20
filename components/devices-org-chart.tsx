'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Smartphone, Tablet, User, Mail, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getSocialPlatformImage } from '@/lib/social-platform-images'

interface SocialAccount {
  id: string
  platform: 'TikTok' | 'Instagram' | 'Snapchat'
  username: string
  name: string | null
  credentials: string
}

interface iCloudProfile {
  email: string
  credentials: string
  alias: string
  birthDate: string
  country: string
  zipCode: string
  city: string
  street: string
}

interface Proxy {
  country: string | null
}

interface Device {
  id: string
  name: string
  deviceType: 'iPhone' | 'iPad'
  managerId: string | null
  managerName: string | null
  managerProfilePicture: string | null
  owner: string | null
  iCloudProfile: iCloudProfile | null
  proxy: Proxy | null
  socialAccounts: SocialAccount[]
}

interface DevicesOrgChartProps {
  devices: Device[]
  currentUserId: string
  userRole: 'admin' | 'dev' | 'developer' | 'promoter' | 'user' | 'demo' | null
}

type ManagerKey = string

interface Tree {
  managers: Map<ManagerKey, { name: string; picture: string | null; devices: Device[] }>
  unassigned: Device[]
}

function buildTree(devices: Device[]): Tree {
  const managers = new Map<ManagerKey, { name: string; picture: string | null; devices: Device[] }>()
  const unassigned: Device[] = []

  for (const device of devices) {
    if (device.managerId) {
      let manager = managers.get(device.managerId)
      if (!manager) {
        manager = {
          name: device.managerName || 'Manager',
          picture: device.managerProfilePicture || null,
          devices: [],
        }
        managers.set(device.managerId, manager)
      }
      manager.devices.push(device)
    } else {
      unassigned.push(device)
    }
  }

  return { managers, unassigned }
}

export default function DevicesOrgChart({ devices, currentUserId, userRole }: DevicesOrgChartProps) {
  const canOpenAllDevices = userRole === 'admin' || userRole === 'dev' || userRole === 'developer'
  const tree = buildTree(devices)

  const totalManagers = tree.managers.size + (tree.unassigned.length > 0 ? 1 : 0)
  if (totalManagers === 0 && tree.unassigned.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600 dark:text-gray-400">
        No devices to display in org chart.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-full flex-nowrap gap-8 pb-2">
      {/* Managers side by side */}
      {Array.from(tree.managers.entries()).map(([managerId, { name, picture, devices }]) => (
        <div key={managerId} className={`flex flex-col items-center shrink-0 ${devices.length >= 3 ? 'min-w-[632px]' : ''}`}>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                {picture ? (
                  <AvatarImage src={picture} alt={name} />
                ) : (
                  <AvatarFallback className="text-sm">{(name || 'M')[0].toUpperCase()}</AvatarFallback>
                )}
              </Avatar>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Manager</span>
                <p className="font-semibold text-gray-900 dark:text-white">{name}</p>
              </div>
            </div>
          </div>
          <div className="mt-2 h-4 w-px bg-gray-200" />
          <div className={`mt-2 ${devices.length >= 3 ? 'flex gap-4' : 'flex flex-wrap justify-center gap-4 [&>*]:w-[200px] [&>*]:max-w-[200px]'}`}>
            {devices.length >= 3 ? (
              [0, 1, 2].map((colIndex) => (
                <div key={colIndex} className="flex flex-col gap-4 min-w-0 flex-1">
                  {devices
                    .filter((_, i) => i % 3 === colIndex)
                    .map((device) => (
                      <DeviceNode
                        key={device.id}
                        device={device}
                        canOpen={canOpenAllDevices || device.managerId === currentUserId}
                      />
                    ))}
                </div>
              ))
            ) : (
              devices.map((device) => (
                <DeviceNode
                  key={device.id}
                  device={device}
                  canOpen={canOpenAllDevices || device.managerId === currentUserId}
                />
              ))
            )}
          </div>
        </div>
      ))}

      {/* Unassigned (no manager) */}
      {tree.unassigned.length > 0 && (
        <div className={`flex flex-col items-center shrink-0 ${tree.unassigned.length >= 3 ? 'min-w-[632px]' : ''}`}>
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <User className="h-9 w-9 text-gray-400" />
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Manager</span>
                <p className="font-semibold text-gray-600 dark:text-gray-400">Unassigned</p>
              </div>
            </div>
          </div>
          <div className="mt-2 h-4 w-px bg-gray-200" />
          <div className={`mt-2 ${tree.unassigned.length >= 3 ? 'flex gap-4' : 'flex flex-wrap justify-center gap-4 [&>*]:w-[200px] [&>*]:max-w-[200px]'}`}>
            {tree.unassigned.length >= 3 ? (
              [0, 1, 2].map((colIndex) => (
                <div key={colIndex} className="flex flex-col gap-4 min-w-0 flex-1">
                  {tree.unassigned
                    .filter((_, i) => i % 3 === colIndex)
                    .map((device) => (
                      <DeviceNode
                        key={device.id}
                        device={device}
                        canOpen={canOpenAllDevices || device.managerId === currentUserId}
                      />
                    ))}
                </div>
              ))
            ) : (
              tree.unassigned.map((device) => (
                <DeviceNode
                  key={device.id}
                  device={device}
                  canOpen={canOpenAllDevices || device.managerId === currentUserId}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DeviceNode({
  device,
  canOpen,
}: {
  device: Device
  canOpen: boolean
}) {
  const Icon = device.deviceType === 'iPhone' ? Smartphone : Tablet

  const cardContent = (
    <>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-400 shrink-0" />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            Device {device.id}
            {device.owner && <span className="text-gray-400 font-normal"> · {device.owner}</span>}
          </p>
          {device.iCloudProfile && (
            <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              <Mail className="h-3 w-3 shrink-0" />
              {device.iCloudProfile.alias || device.iCloudProfile.email}
            </p>
          )}
        </div>
        {canOpen && <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
      </div>
      {device.socialAccounts.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-1.5 w-full">
          {device.socialAccounts.map((account) => (
            <SocialAccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </>
  )

  const cardClass = 'rounded-md border border-gray-200 bg-white p-2.5'

  if (canOpen) {
    return (
      <div className="w-full min-w-0">
        <Link href={`/devices/${device.id}`} className={`block w-full ${cardClass} transition-colors hover:bg-gray-50/80 cursor-pointer`}>
          {cardContent}
        </Link>
      </div>
    )
  }

  return (
    <div className={`w-full min-w-0 ${cardClass}`}>
      {cardContent}
    </div>
  )
}

function SocialAccountCard({ account }: { account: SocialAccount }) {
  return (
    <div className="flex items-center gap-1.5 w-full min-w-0 rounded border border-gray-100 bg-gray-50/80 px-2 py-1.5">
      <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded">
        <Image
          src={getSocialPlatformImage(account.platform)}
          alt={account.platform}
          fill
          className="object-contain"
          sizes="20px"
        />
      </div>
      <p className="text-xs text-gray-700 dark:text-gray-300 min-w-0 flex-1 break-all">@{account.username}</p>
    </div>
  )
}
