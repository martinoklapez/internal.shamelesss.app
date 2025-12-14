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
}

interface AddICloudProfileDialogProps {
  deviceId: string
  iCloudProfile?: iCloudProfile | null
  children?: React.ReactNode
}

export function AddICloudProfileDialog({ deviceId, iCloudProfile, children }: AddICloudProfileDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const isEditing = !!iCloudProfile
  const [formData, setFormData] = useState({
    email: '',
    credentials: '',
    alias: '',
    birthDate: '',
    country: '',
    street: '',
    city: '',
    zipCode: '',
  })
  const router = useRouter()

  // Populate form when editing
  useEffect(() => {
    if (open && iCloudProfile) {
      setFormData({
        email: iCloudProfile.email || '',
        credentials: iCloudProfile.credentials || '',
        alias: iCloudProfile.alias || '',
        birthDate: iCloudProfile.birthDate || '',
        country: iCloudProfile.country || '',
        street: iCloudProfile.street || '',
        city: iCloudProfile.city || '',
        zipCode: iCloudProfile.zipCode || '',
      })
    } else if (open && !iCloudProfile) {
      // Reset form when creating new
      setFormData({
        email: '',
        credentials: '',
        alias: '',
        birthDate: '',
        country: '',
        street: '',
        city: '',
        zipCode: '',
      })
    }
  }, [open, iCloudProfile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.email || !formData.credentials || !formData.alias || !formData.birthDate || !formData.country || !formData.street || !formData.city || !formData.zipCode) {
      return
    }

    setIsLoading(true)

    try {
      const url = isEditing 
        ? '/api/icloud-profiles/update'
        : '/api/icloud-profiles/create'
      
      const body = isEditing
        ? {
            profileId: iCloudProfile?.id,
            ...formData,
          }
        : {
            device_id: parseInt(deviceId, 10),
            ...formData,
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
        throw new Error(error.error || `Failed to ${isEditing ? 'update' : 'create'} iCloud profile`)
      }

      // Close dialog and refresh
      setOpen(false)
      if (!isEditing) {
        setFormData({
          email: '',
          credentials: '',
          alias: '',
          birthDate: '',
          country: '',
          street: '',
          city: '',
          zipCode: '',
        })
      }
      router.refresh()
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} iCloud profile:`, error)
      alert(error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} iCloud profile`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button>Add iCloud Profile</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit iCloud Profile' : 'Add iCloud Profile'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the iCloud profile for this device.' : 'Add an iCloud profile for this device.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="alias">Alias *</Label>
                <Input
                  id="alias"
                  placeholder="e.g., Peter Thiel"
                  value={formData.alias}
                  onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="birthDate">Birth Date *</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                placeholder="e.g., United States"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="street">Street *</Label>
              <Input
                id="street"
                placeholder="e.g., 123 Main Street"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  placeholder="e.g., San Francisco, CA"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zipCode">Zip Code *</Label>
                <Input
                  id="zipCode"
                  placeholder="e.g., 94102"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  required
                />
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Profile' : 'Create iCloud Profile')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

