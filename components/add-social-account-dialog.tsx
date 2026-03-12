'use client'

import { useState, useEffect } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Eye, EyeOff } from 'lucide-react'
import { getSocialPlatformImage } from '@/lib/social-platform-images'

const PLATFORMS = ['TikTok', 'Instagram', 'Snapchat', 'Pinterest'] as const
type Platform = (typeof PLATFORMS)[number]

type SocialAccountStatus = 'planned' | 'warmup' | 'active' | 'paused'

interface SocialAccount {
  id?: string
  platform: 'TikTok' | 'Instagram' | 'Snapchat' | 'Pinterest'
  username: string
  credentials: string
  status?: SocialAccountStatus
}

interface AddSocialAccountDialogProps {
  deviceId: string
  socialAccount?: SocialAccount | null
  children?: React.ReactNode
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
        status: (socialAccount.status ?? 'planned') as SocialAccountStatus,
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
    if (open) setShowPassword(true)
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
      })
      router.refresh()
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} social account:`, error)
      alert(error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} social account`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button>Add Social Account</Button>}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Social Account' : 'Add Social Account'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the social media account for this device.' : 'Add a social media account for this device.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Platform *</Label>
              <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Choose platform">
                {PLATFORMS.map((platform) => {
                  const isSelected = formData.platform === platform
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => setFormData({ ...formData, platform })}
                      className={`flex flex-col items-center gap-1 rounded-md border-2 p-2 transition-colors hover:bg-gray-50 ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 bg-white'
                      }`}
                      aria-pressed={isSelected}
                      aria-label={`${platform}`}
                    >
                      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-[22%]">
                        <Image
                          src={getSocialPlatformImage(platform)}
                          alt=""
                          fill
                          className="object-contain rounded-[22%]"
                          sizes="28px"
                          unoptimized
                        />
                      </div>
                      <span className="text-[10px] font-medium text-gray-700 leading-tight">{platform}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                placeholder="e.g., @shamelesss_official"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="credentials">Password *</Label>
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
            </div>
            {isEditing && (
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as SocialAccountStatus })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="warmup">Warmup</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
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

