'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { notifyError, notifySuccess } from '@/lib/notify'

interface AssigneeOption {
  id: string
  name: string | null
  email: string | null
  profile_picture_url: string | null
}

export interface PhoneNumberAssigneeTarget {
  id: string
  e164: string
  assigned_user_id: string | null
  assigned_user_name?: string | null
  assigned_user_profile_picture?: string | null
}

interface PhoneNumberAssigneeDialogProps {
  phone: PhoneNumberAssigneeTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function PhoneNumberAssigneeDialog({
  phone,
  open,
  onOpenChange,
  onSaved,
}: PhoneNumberAssigneeDialogProps) {
  const [users, setUsers] = useState<AssigneeOption[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [saving, setSaving] = useState(false)
  const [value, setValue] = useState('unassigned')

  useEffect(() => {
    if (!open || !phone) return
    setValue(phone.assigned_user_id ?? 'unassigned')
  }, [open, phone])

  useEffect(() => {
    if (!open) {
      setUsers([])
      return
    }

    setLoadingUsers(true)
    void fetch('/api/users/list')
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data.users)) return

        const assignable: AssigneeOption[] = data.users
          .filter(
            (u: { role?: string }) =>
              u.role === 'promoter' ||
              u.role === 'admin' ||
              u.role === 'developer' ||
              u.role === 'dev'
          )
          .map(
            (u: {
              id: string
              name?: string | null
              email?: string | null
              profile_picture_url?: string | null
            }) => ({
              id: u.id,
              name: u.name ?? null,
              email: u.email ?? null,
              profile_picture_url: u.profile_picture_url ?? null,
            })
          )

        if (
          phone?.assigned_user_id &&
          !assignable.some((u) => u.id === phone.assigned_user_id)
        ) {
          assignable.unshift({
            id: phone.assigned_user_id,
            name: phone.assigned_user_name ?? null,
            email: null,
            profile_picture_url: phone.assigned_user_profile_picture ?? null,
          })
        }

        setUsers(assignable)
      })
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false))
  }, [open, phone])

  const handleSave = async () => {
    if (!phone) return

    setSaving(true)
    try {
      const res = await fetch(`/api/phone-numbers/${phone.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_user_id: value === 'unassigned' ? null : value,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update assignee')
      }
      notifySuccess('Assignee updated')
      onSaved()
      onOpenChange(false)
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Failed to update assignee')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement
          if (target.closest('[data-radix-select-content]')) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Assign user</DialogTitle>
          <DialogDescription>
            Choose who manages{' '}
            <span className="font-mono font-medium text-gray-900">{phone?.e164}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="assignee-select">Assigned to</Label>
          <Select value={value} onValueChange={setValue} disabled={loadingUsers || saving}>
            <SelectTrigger id="assignee-select" className="h-10 w-full">
              <SelectValue placeholder={loadingUsers ? 'Loading users…' : 'Select user'} />
            </SelectTrigger>
            <SelectContent className="z-[100] max-h-72" position="popper">
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.email || user.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={loadingUsers || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
