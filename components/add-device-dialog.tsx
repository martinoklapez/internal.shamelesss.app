'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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

interface AddDeviceDialogProps {
  children?: React.ReactNode
}

interface User {
  id: string
  name?: string | null
  profile_picture_url?: string | null
  email?: string | null
}

export function AddDeviceDialog({ children }: AddDeviceDialogProps) {
  const [open, setOpen] = useState(false)
  const [deviceModel, setDeviceModel] = useState<string>('')
  const [managerId, setManagerId] = useState<string>('')
  const [owner, setOwner] = useState<string>('')
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Fetch users when dialog opens
  useEffect(() => {
    if (open) {
      fetchUsers()
    }
  }, [open])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      // Fetch users with emails from API route
      const response = await fetch('/api/users/list')
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error fetching users:', response.statusText, errorData)
        return
      }

      const data = await response.json()
      console.log('Fetched users data:', data) // Debug log
      console.log('Number of users:', data.users?.length || 0) // Debug log
      
      if (data.users && Array.isArray(data.users)) {
        console.log('Setting users:', data.users) // Debug log
        setUsers(data.users)
      } else {
        console.warn('Invalid users data format:', data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!deviceModel || !managerId || !owner) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/devices/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_model: deviceModel,
          manager_id: managerId,
          owner: owner,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create device')
      }

      // Close dialog and refresh
      setOpen(false)
      setDeviceModel('')
      setManagerId('')
      setOwner('')
      router.refresh()
    } catch (error) {
      console.error('Error creating device:', error)
      alert(error instanceof Error ? error.message : 'Failed to create device')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Device</DialogTitle>
            <DialogDescription>
              Create a new device. You&apos;ll be able to add iCloud profile and social accounts later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="device_model">Device Model *</Label>
              <Input
                id="device_model"
                placeholder="e.g., iPhone 14 Pro, iPad Pro"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manager">Manager *</Label>
              <Select
                value={managerId || undefined}
                onValueChange={(value) => setManagerId(value)}
                disabled={loadingUsers}
                required
              >
                <SelectTrigger className="flex items-center gap-2">
                  {managerId ? (() => {
                    const selectedUser = users.find(u => u.id === managerId)
                    if (!selectedUser) return <SelectValue placeholder="Select a manager" />
                    return (
                      <>
                        <Avatar className="h-5 w-5">
                          {selectedUser.profile_picture_url ? (
                            <AvatarImage
                              src={selectedUser.profile_picture_url}
                              alt={selectedUser.name || selectedUser.email || 'User'}
                            />
                          ) : (
                            <AvatarFallback className="text-xs">
                              {(selectedUser.name || selectedUser.email || 'U')[0].toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <SelectValue>
                          {selectedUser.name || selectedUser.email || `User ${selectedUser.id.substring(0, 8)}...`}
                        </SelectValue>
                      </>
                    )
                  })() : (
                    <SelectValue placeholder="Select a manager" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {users.length === 0 && !loadingUsers ? (
                    <div className="px-2 py-1.5 text-sm text-gray-500">
                      No users found
                    </div>
                  ) : (
                    (() => {
                      console.log('Rendering users in Select:', users)
                      return users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              {user.profile_picture_url ? (
                                <AvatarImage
                                  src={user.profile_picture_url}
                                  alt={user.name || user.email || 'User'}
                                />
                              ) : (
                                <AvatarFallback className="text-xs">
                                  {(user.name || user.email || 'U')[0].toUpperCase()}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <span>{user.name || user.email || `User ${user.id.substring(0, 8)}...`}</span>
                          </div>
                        </SelectItem>
                      ))
                    })()
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="owner">Owner *</Label>
              <Input
                id="owner"
                placeholder="e.g., John Doe, Company Name"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
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
            <Button type="submit" disabled={isLoading || !deviceModel || !managerId || !owner}>
              {isLoading ? 'Creating...' : 'Create Device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

