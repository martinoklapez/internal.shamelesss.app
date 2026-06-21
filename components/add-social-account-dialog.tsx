'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { notifyError } from '@/lib/notify'
import { getSocialPlatformImage } from '@/lib/social-platform-images'
import {
  SOCIAL_ACCOUNT_STATUS_OPTIONS,
  formatSocialStatusLabel,
  type SocialAccountSelectableStatus,
} from '@/lib/social-account-status'
import { SocialAccountStatusBadge } from '@/components/social-account-status-badge'
import { cn } from '@/lib/utils'

const PLATFORMS = ['TikTok', 'Instagram', 'Snapchat', 'Pinterest'] as const
type Platform = (typeof PLATFORMS)[number]

type SocialAccountStatus = SocialAccountSelectableStatus

interface SocialAccount {
  id?: string
  platform: 'TikTok' | 'Instagram' | 'Snapchat' | 'Pinterest'
  username: string
  credentials: string
  status?: SocialAccountStatus | 'archived'
}

interface AddSocialAccountDialogProps {
  deviceId: string
  socialAccount?: SocialAccount | null
  children?: React.ReactNode
}

function PlatformField({
  platform,
  onPlatformChange,
  required,
}: {
  platform: Platform | ''
  onPlatformChange: (platform: Platform) => void
  required?: boolean
}) {
  return (
    <FormField label="Platform" required={required}>
      <div className="flex h-9 items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-2.5 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-0"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                {platform ? (
                  <>
                    <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-[22%]">
                      <Image
                        src={getSocialPlatformImage(platform)}
                        alt=""
                        fill
                        className="object-contain rounded-[22%]"
                        sizes="20px"
                        unoptimized
                      />
                    </span>
                    <span className="truncate text-sm font-medium text-gray-900">{platform}</span>
                  </>
                ) : (
                  <span className="text-sm text-gray-500">Select platform</span>
                )}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="border border-gray-200 bg-white shadow-lg">
            {PLATFORMS.map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => onPlatformChange(option)}
                className={cn(
                  'flex items-center gap-2 focus:bg-gray-100',
                  option === platform && 'bg-gray-50'
                )}
              >
                <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-[22%]">
                  <Image
                    src={getSocialPlatformImage(option)}
                    alt=""
                    fill
                    className="object-contain rounded-[22%]"
                    sizes="20px"
                    unoptimized
                  />
                </span>
                <span className="text-sm">{option}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </FormField>
  )
}

function StatusField({
  status,
  onStatusChange,
}: {
  status: SocialAccountStatus
  onStatusChange: (status: SocialAccountStatus) => void
}) {
  return (
    <FormField label="Status" htmlFor="status">
      <div className="flex h-9 items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              id="status"
              type="button"
              className="inline-flex items-center rounded-md focus:outline-none focus:ring-0"
            >
              <SocialAccountStatusBadge status={status} variant="header" showChevron />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="border border-gray-200 bg-white shadow-lg">
            {SOCIAL_ACCOUNT_STATUS_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => onStatusChange(option)}
                className="flex items-center gap-2 focus:bg-gray-100"
              >
                <SocialAccountStatusBadge status={option} variant="menu" />
                <span className="min-w-[4.5rem] text-sm">{formatSocialStatusLabel(option)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </FormField>
  )
}

function FormField({
  label,
  htmlFor,
  required,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-gray-500">
        {label}
        {required ? ' *' : ''}
      </Label>
      {children}
    </div>
  )
}

export function AddSocialAccountDialog({ deviceId, socialAccount, children }: AddSocialAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(true)
  const isEditing = !!socialAccount
  const [formData, setFormData] = useState({
    platform: '' as 'TikTok' | 'Instagram' | 'Snapchat' | 'Pinterest' | '',
    username: '',
    credentials: '',
    status: 'planned' as SocialAccountStatus,
  })
  const router = useRouter()

  // Populate form when editing
  useEffect(() => {
    if (open && socialAccount) {
      setFormData({
        platform: socialAccount.platform || '',
        username: socialAccount.username || '',
        credentials: socialAccount.credentials || '',
        status: (socialAccount.status === 'archived' ? 'planned' : (socialAccount.status ?? 'planned')) as SocialAccountStatus,
      })
    } else if (open && !socialAccount) {
      // Reset form when creating new
      setFormData({
        platform: '',
        username: '',
        credentials: '',
        status: 'planned',
      })
    }
    if (open) {
      setShowPassword(true)
    }
  }, [open, socialAccount])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.platform || !formData.username || !formData.credentials) {
      return
    }

    setIsLoading(true)

    try {
      const url = isEditing ? '/api/social-accounts/update' : '/api/social-accounts/create'
      const body = isEditing
        ? {
            accountId: socialAccount!.id,
            platform: formData.platform,
            username: formData.username,
            credentials: formData.credentials,
            status: formData.status,
          }
        : {
            device_id: parseInt(deviceId, 10),
            platform: formData.platform,
            username: formData.username,
            credentials: formData.credentials,
            status: formData.status,
          }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${isEditing ? 'update' : 'create'} social account`)
      }

      // Close dialog and refresh
      setOpen(false)
      setFormData({
        platform: '',
        username: '',
        credentials: '',
        status: 'planned',
      })
      router.refresh()
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} social account:`, error)
      notifyError(error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} social account`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button>Add Social Account</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Social Account' : 'Add Social Account'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the social media account for this device.' : 'Add a social media account for this device.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Account details
              </p>
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                  <StatusField
                    status={formData.status}
                    onStatusChange={(status) => setFormData({ ...formData, status })}
                  />
                  <PlatformField
                    platform={formData.platform}
                    onPlatformChange={(platform) => setFormData({ ...formData, platform })}
                    required={!isEditing}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Login credentials
              </p>
              <div className="grid gap-4">
                <FormField label="Username" htmlFor="username" required>
                  <Input
                    id="username"
                    placeholder="e.g., @shamelesss_official"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Password" htmlFor="credentials" required>
                  <div className="relative flex items-center">
                    <Input
                      id="credentials"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.credentials}
                      onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                      className="pr-9"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 h-8 w-8 p-0"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5 text-gray-500" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-gray-500" />
                      )}
                    </Button>
                  </div>
                </FormField>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.platform}>
              {isLoading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Social Account' : 'Create Social Account')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

