'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
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
import { useToast } from '@/hooks/use-toast'

interface EditUserDialogProps {
  userId: string
  initialName: string | null
  initialEmail: string | null
}

export function EditUserDialog({ userId, initialName, initialEmail }: EditUserDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(initialEmail || '')
  const [name, setName] = useState(initialName || '')
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const response = await fetch('/api/users/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          email: email.trim() || null,
          name: name.trim() || null,
          password: password.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user')
      }

      toast({
        title: 'User updated',
        description: 'The user details have been updated successfully.',
      })

      setOpen(false)
      setPassword('')
      router.refresh()
    } catch (error: any) {
      console.error('Error updating user:', error)
      toast({
        title: 'Update failed',
        description: error.message || 'An error occurred while updating the user.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Edit user</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Change the user&apos;s name, email, or password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={`name-${userId}`}>Name</Label>
              <Input
                id={`name-${userId}`}
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`email-${userId}`}>Email</Label>
              <Input
                id={`email-${userId}`}
                type="email"
                placeholder="Leave empty to keep current"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`password-${userId}`}>Password</Label>
              <Input
                id={`password-${userId}`}
                type="text"
                placeholder="Leave empty to keep current"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


