'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

interface SocialAccount {
  id?: string
  platform: 'TikTok' | 'Instagram' | 'Snapchat'
  username: string
  credentials: string
}

interface AddSocialAccountDialogProps {
  deviceId: string
  socialAccount?: SocialAccount | null
  children?: React.ReactNode
}

export function AddSocialAccountDialog({ deviceId, socialAccount, children }: AddSocialAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const isEditing = !!socialAccount
  const [formData, setFormData] = useState({
    platform: '' as 'TikTok' | 'Instagram' | 'Snapchat' | '',
    username: '',
    credentials: '',
  })
  const router = useRouter()

  // Populate form when editing
  useEffect(() => {
    if (open && socialAccount) {
      setFormData({
        platform: socialAccount.platform || '',
        username: socialAccount.username || '',
        credentials: socialAccount.credentials || '',
      })
    } else if (open && !socialAccount) {
      // Reset form when creating new
      setFormData({
        platform: '',
        username: '',
        credentials: '',
      })
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
              <Label htmlFor="platform">Platform *</Label>
              <Select
                value={formData.platform}
                onValueChange={(value) => setFormData({ ...formData, platform: value as 'TikTok' | 'Instagram' | 'Snapchat' })}
                required
              >
                <SelectTrigger id="platform">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Snapchat">Snapchat</SelectItem>
                </SelectContent>
              </Select>
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
              <Input
                id="credentials"
                type="password"
                placeholder="••••••••"
                value={formData.credentials}
                onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                required
              />
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

