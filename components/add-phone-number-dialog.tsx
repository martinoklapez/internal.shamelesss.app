'use client'

import { useEffect, useState } from 'react'
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
import { notifyError } from '@/lib/notify'

interface PhoneNumberForm {
  id?: string
  e164: string
  twilio_sid: string
  friendly_name: string
  country: string
  purpose: 'tiktok_signup' | 'instagram_signup' | 'general'
  notes: string
}

interface AddPhoneNumberDialogProps {
  phoneNumber?: PhoneNumberForm | null
  onSaved?: () => void
  children?: React.ReactNode
}

export function AddPhoneNumberDialog({
  phoneNumber,
  onSaved,
  children,
}: AddPhoneNumberDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const isEditing = !!phoneNumber?.id
  const router = useRouter()

  const [formData, setFormData] = useState<PhoneNumberForm>({
    e164: '',
    twilio_sid: '',
    friendly_name: '',
    country: '',
    purpose: 'general',
    notes: '',
  })

  useEffect(() => {
    if (open && phoneNumber) {
      setFormData({
        id: phoneNumber.id,
        e164: phoneNumber.e164,
        twilio_sid: phoneNumber.twilio_sid ?? '',
        friendly_name: phoneNumber.friendly_name ?? '',
        country: phoneNumber.country ?? '',
        purpose: phoneNumber.purpose ?? 'general',
        notes: phoneNumber.notes ?? '',
      })
    } else if (open && !phoneNumber) {
      setFormData({
        e164: '',
        twilio_sid: '',
        friendly_name: '',
        country: '',
        purpose: 'general',
        notes: '',
      })
    }
  }, [open, phoneNumber])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isEditing && phoneNumber?.id) {
        const res = await fetch(`/api/phone-numbers/${phoneNumber.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            friendly_name: formData.friendly_name,
            country: formData.country,
            purpose: formData.purpose,
            notes: formData.notes,
            twilio_sid: formData.twilio_sid,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to update phone number')
        }
      } else {
        const res = await fetch('/api/phone-numbers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            e164: formData.e164,
            twilio_sid: formData.twilio_sid || undefined,
            friendly_name: formData.friendly_name || undefined,
            country: formData.country || undefined,
            purpose: formData.purpose,
            notes: formData.notes || undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to add phone number')
        }
      }

      setOpen(false)
      onSaved?.()
      router.refresh()
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline">
            Add phone number
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit phone number' : 'Add phone number'}</DialogTitle>
          <DialogDescription>
            Register a Twilio number in inventory. Link it to an iCloud profile or social account
            from the device page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="e164">Phone number (E.164)</Label>
              <Input
                id="e164"
                placeholder="+15058869199"
                value={formData.e164}
                onChange={(e) => setFormData({ ...formData, e164: e.target.value })}
                required={!isEditing}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="twilio_sid">Twilio SID (optional)</Label>
            <Input
              id="twilio_sid"
              placeholder="PN…"
              value={formData.twilio_sid}
              onChange={(e) => setFormData({ ...formData, twilio_sid: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="friendly_name">Label</Label>
              <Input
                id="friendly_name"
                placeholder="DE IG batch 12"
                value={formData.friendly_name}
                onChange={(e) => setFormData({ ...formData, friendly_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="US"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Purpose</Label>
            <Select
              value={formData.purpose}
              onValueChange={(v) =>
                setFormData({
                  ...formData,
                  purpose: v as PhoneNumberForm['purpose'],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="tiktok_signup">TikTok signup</SelectItem>
                <SelectItem value="instagram_signup">Instagram signup</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving…' : isEditing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
