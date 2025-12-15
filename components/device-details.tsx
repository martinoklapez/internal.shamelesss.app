'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Mail, Lock, Eye, EyeOff, Smartphone, Tablet, Calendar, MapPin, Globe, Copy, Check, Network, Plus, Archive, ChevronDown, ChevronUp, FileText, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSocialPlatformImage } from '@/lib/social-platform-images'
import { AddICloudProfileDialog } from './add-icloud-profile-dialog'
import { AddSocialAccountDialog } from './add-social-account-dialog'
import { AddProxyDialog } from './add-proxy-dialog'

interface SocialAccount {
  id: string
  platform: 'TikTok' | 'Instagram' | 'Snapchat'
  username: string
  name: string | null
  credentials: string
  batchId?: string | null
}

interface iCloudProfile {
  id?: string
  email: string
  credentials: string
  alias: string
  birthDate: string
  country: string
  zipCode: string
  city: string
  street: string
  batchId?: string | null
}

interface Proxy {
  id?: string
  type: 'HTTP' | 'SOCKS5' | 'SOCKS4'
  host: string
  port: number
  username?: string | null
  password?: string | null
  api_address?: string | null
  country?: string | null
  city?: string | null
  fraud_score?: number | null
  asn?: string | null
  batch_id?: string | null
  status?: 'active' | 'archived'
  method?: string
  plugin?: string
  tcpFastOpen?: boolean
  udpRelay?: boolean
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
  archivedICloudProfiles: iCloudProfile[]
  socialAccounts: SocialAccount[]
  archivedSocialAccounts: SocialAccount[]
  proxy?: Proxy
  archivedProxies?: Proxy[]
}

interface DeviceDetailsProps {
  device: Device
  currentUserId: string
}


export default function DeviceDetails({ device, currentUserId }: DeviceDetailsProps) {
  const router = useRouter()
  const [visibleCredentials, setVisibleCredentials] = useState<Set<string>>(new Set())
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [expandedArchivedProfiles, setExpandedArchivedProfiles] = useState<Set<string>>(new Set())

  const toggleCredentials = (id: string) => {
    const newVisible = new Set(visibleCredentials)
    if (newVisible.has(id)) {
      newVisible.delete(id)
    } else {
      newVisible.add(id)
    }
    setVisibleCredentials(newVisible)
  }

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldId)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const toggleArchivedProfile = (profileId: string) => {
    const newExpanded = new Set(expandedArchivedProfiles)
    if (newExpanded.has(profileId)) {
      newExpanded.delete(profileId)
    } else {
      newExpanded.add(profileId)
    }
    setExpandedArchivedProfiles(newExpanded)
  }

  const handleArchiveProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to archive this iCloud profile?')) {
      return
    }

    try {
      const response = await fetch('/api/icloud-profiles/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profileId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to archive iCloud profile')
      }

      router.refresh()
    } catch (error) {
      console.error('Error archiving iCloud profile:', error)
      alert(error instanceof Error ? error.message : 'Failed to archive iCloud profile')
    }
  }

  const handleArchiveProxy = async (proxyId: string) => {
    if (!confirm('Are you sure you want to archive this proxy?')) {
      return
    }

    try {
      const response = await fetch('/api/proxies/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proxyId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to archive proxy')
      }

      router.refresh()
    } catch (error) {
      console.error('Error archiving proxy:', error)
      alert(error instanceof Error ? error.message : 'Failed to archive proxy')
    }
  }

  const handleArchiveSocialAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to archive this social account?')) {
      return
    }

    try {
      const response = await fetch('/api/social-accounts/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to archive social account')
      }

      router.refresh()
    } catch (error) {
      console.error('Error archiving social account:', error)
      alert(error instanceof Error ? error.message : 'Failed to archive social account')
    }
  }

  const DeviceIcon = device.deviceType === 'iPhone' ? Smartphone : Tablet

  const renderICloudProfileDetails = (profile: iCloudProfile, profileKey: string) => (
    <div className="space-y-4">
      {/* Login Credentials Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Login Credentials</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Email:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {profile.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => copyToClipboard(profile.email, `email-${profileKey}`)}
            >
              {copiedField === `email-${profileKey}` ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Password:</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => toggleCredentials(`icloud-${profileKey}`)}
            >
              {visibleCredentials.has(`icloud-${profileKey}`) ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>
            <span className="text-sm font-mono">
              {visibleCredentials.has(`icloud-${profileKey}`)
                ? profile.credentials
                : '••••••••••••'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => copyToClipboard(profile.credentials, `password-${profileKey}`)}
            >
              {copiedField === `password-${profileKey}` ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Profile Information Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Profile Information</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Alias:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {profile.alias}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => copyToClipboard(profile.alias, `alias-${profileKey}`)}
            >
              {copiedField === `alias-${profileKey}` ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Birth Date:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {new Date(profile.birthDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => copyToClipboard(new Date(profile.birthDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), `birthDate-${profileKey}`)}
            >
              {copiedField === `birthDate-${profileKey}` ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Country:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {profile.country}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => copyToClipboard(profile.country, `country-${profileKey}`)}
            >
              {copiedField === `country-${profileKey}` ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Street:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {profile.street}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => copyToClipboard(profile.street, `street-${profileKey}`)}
            >
              {copiedField === `street-${profileKey}` ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">City:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {profile.city}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => copyToClipboard(profile.city, `city-${profileKey}`)}
            >
              {copiedField === `city-${profileKey}` ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Zip Code:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {profile.zipCode}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => copyToClipboard(profile.zipCode, `zipCode-${profileKey}`)}
            >
              {copiedField === `zipCode-${profileKey}` ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: iCloud Profile and Proxy */}
      <div className="space-y-6">
        {/* iCloud Profile Section */}
        <div className="bg-white rounded-lg py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DeviceIcon className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                iCloud Profile
              </h2>
            </div>
            {device.iCloudProfile ? (
              <div className="flex items-center gap-2">
                <AddICloudProfileDialog deviceId={device.id} iCloudProfile={device.iCloudProfile}>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </AddICloudProfileDialog>
                {device.iCloudProfile?.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handleArchiveProfile(device.iCloudProfile!.id!)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <AddICloudProfileDialog deviceId={device.id}>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </AddICloudProfileDialog>
            )}
          </div>

          {device.iCloudProfile ? (
            renderICloudProfileDetails(device.iCloudProfile, device.id)
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                No iCloud profile configured
              </p>
            </div>
          )}
        </div>

        {/* Proxy Section */}
        <div className="bg-white rounded-lg py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Proxy
              </h2>
            </div>
            {device.proxy ? (
              <div className="flex items-center gap-2">
                <AddProxyDialog deviceId={device.id} proxy={device.proxy}>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </AddProxyDialog>
                {device.proxy?.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handleArchiveProxy(device.proxy!.id!)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <AddProxyDialog deviceId={device.id}>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </AddProxyDialog>
            )}
          </div>
          
          {/* Proxy Information */}
          {device.proxy ? (
            <>
              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Proxy Information</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">API Address:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                      {device.proxy.api_address || '-'}
                    </span>
                    {device.proxy.api_address && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(device.proxy!.api_address!)
                          setCopiedField('proxy-api-address')
                          setTimeout(() => setCopiedField(null), 2000)
                        }}
                      >
                        {copiedField === 'proxy-api-address' ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-400" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Country:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {device.proxy.country || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">City:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {device.proxy.city || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Fraud Score:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {device.proxy.fraud_score !== null && device.proxy.fraud_score !== undefined
                      ? device.proxy.fraud_score.toString()
                      : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">ASN:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {device.proxy.asn || '-'}
                  </span>
                </div>
              </div>

              {/* Shadowrocket Setup */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Shadowrocket Setup
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Type:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{device.proxy.type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Address:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">{device.proxy.host}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(device.proxy!.host)
                        setCopiedField('proxy-address')
                        setTimeout(() => setCopiedField(null), 2000)
                      }}
                    >
                      {copiedField === 'proxy-address' ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-gray-400" />
                      )}
                    </Button>
                  </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Port:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">{device.proxy.port}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(device.proxy!.port.toString())
                        setCopiedField('proxy-port')
                        setTimeout(() => setCopiedField(null), 2000)
                      }}
                    >
                      {copiedField === 'proxy-port' ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-gray-400" />
                      )}
                    </Button>
                  </div>
                  </div>
                  {device.proxy.username && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">User:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">{device.proxy.username}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(device.proxy!.username!)
                          setCopiedField('proxy-user')
                          setTimeout(() => setCopiedField(null), 2000)
                        }}
                      >
                        {copiedField === 'proxy-user' ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-400" />
                        )}
                      </Button>
                    </div>
                    </div>
                  )}
                  {device.proxy.password && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Password:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                        {visibleCredentials.has('proxy-password')
                          ? device.proxy.password
                          : '••••••••••••'}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleCredentials('proxy-password')}
                        >
                          {visibleCredentials.has('proxy-password') ? (
                            <EyeOff className="h-3 w-3 text-gray-400" />
                          ) : (
                            <Eye className="h-3 w-3 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            navigator.clipboard.writeText(device.proxy!.password!)
                            setCopiedField('proxy-password')
                            setTimeout(() => setCopiedField(null), 2000)
                          }}
                        >
                          {copiedField === 'proxy-password' ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Method:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{device.proxy.method || 'auto'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Plugin:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{device.proxy.plugin || 'none'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">TCP Fast Open:</span>
                    <span className="text-sm font-medium text-red-600">
                      {device.proxy.tcpFastOpen ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">UDP Relay:</span>
                    <span className="text-sm font-medium text-green-600">
                      {device.proxy.udpRelay ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                No proxy configured
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Right Column: Social Accounts */}
      {/* Social Accounts Section */}
      <div className="bg-white rounded-lg py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Social Accounts ({device.socialAccounts.length})
          </h2>
          <AddSocialAccountDialog deviceId={device.id}>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </AddSocialAccountDialog>
        </div>
        <div className="space-y-3">
          {device.socialAccounts.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                No social accounts configured
              </p>
            </div>
          ) : (
            device.socialAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {account.name || account.username}
                      </span>
                      {account.name && account.name !== account.username && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          (@{account.username})
                        </span>
                      )}
                      <div className="relative h-5 w-5 shrink-0">
                        <Image
                          src={getSocialPlatformImage(account.platform)}
                          alt={account.platform}
                          width={20}
                          height={20}
                          className="object-contain rounded-[22%]"
                          unoptimized
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3 w-3 text-gray-400" />
                    <span className="text-xs font-mono text-gray-600">
                      {visibleCredentials.has(account.id)
                        ? account.credentials
                        : '••••••••••••'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => toggleCredentials(account.id)}
                  >
                    {visibleCredentials.has(account.id) ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </Button>
                  <AddSocialAccountDialog deviceId={device.id} socialAccount={account}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </AddSocialAccountDialog>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleArchiveSocialAccount(account.id)}
                  >
                    <Archive className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </div>

      {/* Burned Accounts Documentation Section - Full Width */}
      {(device.archivedICloudProfiles.length > 0 || device.archivedSocialAccounts.length > 0 || (device.archivedProxies && device.archivedProxies.length > 0)) && (
      <div className="bg-white rounded-lg py-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Burned Accounts Documentation
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Historical record of archived accounts grouped by batch (which accounts worked together).
        </p>
        <div className="space-y-4">
          {(() => {
            // Group archived items by batch_id
            const batches = new Map<string, {
              iCloudProfile: iCloudProfile | null
              socialAccounts: SocialAccount[]
              proxy: Proxy | null
            }>()
            
            // Add iCloud profiles to batches
            device.archivedICloudProfiles.forEach(profile => {
              const batchId = profile.batchId || 'no-batch'
              if (!batches.has(batchId)) {
                batches.set(batchId, { iCloudProfile: null, socialAccounts: [], proxy: null })
              }
              batches.get(batchId)!.iCloudProfile = profile
            })
            
            // Add social accounts to batches
            device.archivedSocialAccounts.forEach(account => {
              const batchId = account.batchId || 'no-batch'
              if (!batches.has(batchId)) {
                batches.set(batchId, { iCloudProfile: null, socialAccounts: [], proxy: null })
              }
              batches.get(batchId)!.socialAccounts.push(account)
            })
            
            // Add proxies to batches
            if (device.archivedProxies) {
              device.archivedProxies.forEach(proxy => {
                const batchId = proxy.batch_id || 'no-batch'
                if (!batches.has(batchId)) {
                  batches.set(batchId, { iCloudProfile: null, socialAccounts: [], proxy: null })
                }
                batches.get(batchId)!.proxy = proxy
              })
            }
            
            return Array.from(batches.entries()).map(([batchId, batch]) => {
              const isExpanded = expandedArchivedProfiles.has(batchId)
              const hasContent = batch.iCloudProfile || batch.socialAccounts.length > 0 || batch.proxy
              
              if (!hasContent) return null
              
              return (
                <div
                  key={batchId}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleArchivedProfile(batchId)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          Batch {batchId === 'no-batch' ? '(No batch ID)' : batchId.substring(0, 8) + '...'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {batch.iCloudProfile ? batch.iCloudProfile.alias : 'No iCloud Profile'} • {batch.socialAccounts.length} social account{batch.socialAccounts.length !== 1 ? 's' : ''} • {batch.proxy ? 'Proxy' : 'No Proxy'}
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${
                        isExpanded ? 'transform rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="p-4 bg-gray-50 border-t border-gray-200">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left Column: iCloud Profile */}
                        <div className="space-y-4">
                          {batch.iCloudProfile && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                iCloud Profile
                              </h4>
                              {renderICloudProfileDetails(batch.iCloudProfile, batch.iCloudProfile.id || '')}
                            </div>
                          )}
                          
                          {/* Associated Proxy */}
                          {batch.proxy && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Proxy
                              </h4>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-600">IP Address:</span>
                                  <span className="text-xs font-medium text-gray-900 font-mono">
                                    {batch.proxy.host}
                                  </span>
                                </div>
                                {batch.proxy.country && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-600">Country:</span>
                                    <span className="text-xs font-medium text-gray-900">{batch.proxy.country}</span>
                                  </div>
                                )}
                                {batch.proxy.api_address && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-600">API Address:</span>
                                    <span className="text-xs font-medium text-gray-900 font-mono">{batch.proxy.api_address}</span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-600">Type:</span>
                                  <span className="text-xs font-medium text-gray-900">{batch.proxy.type}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-600">Port:</span>
                                  <span className="text-xs font-medium text-gray-900">{batch.proxy.port}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Right Column: Social Accounts */}
                        <div>
                          {batch.socialAccounts.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Social Accounts ({batch.socialAccounts.length})
                              </h4>
                              <div className="space-y-2">
                                {batch.socialAccounts.map((account) => (
                                  <div
                                    key={account.id}
                                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="relative h-6 w-6 shrink-0">
                                        <Image
                                          src={getSocialPlatformImage(account.platform)}
                                          alt={account.platform}
                                          width={24}
                                          height={24}
                                          className="object-contain rounded-[22%]"
                                          unoptimized
                                        />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                          {account.name || account.username}
                                        </div>
                                        {account.name && account.name !== account.username && (
                                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            @{account.username}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <Lock className="h-3 w-3 text-gray-400" />
                                      <span className="text-xs font-mono text-gray-600">
                                        {visibleCredentials.has(account.id)
                                          ? account.credentials
                                          : '••••••••••••'}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => toggleCredentials(account.id)}
                                      >
                                        {visibleCredentials.has(account.id) ? (
                                          <EyeOff className="h-3 w-3 text-gray-400" />
                                        ) : (
                                          <Eye className="h-3 w-3 text-gray-400" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          })()}
          
          {/* Fallback: Show items without batch_id */}
          {device.archivedICloudProfiles.filter(p => !p.batchId).length > 0 && (
            <div className="text-xs text-gray-500 italic">
              Note: Some archived items don&apos;t have a batch_id assigned. They are shown above.
            </div>
          )}
        </div>
      </div>
    )}
  </div>
  )
}

