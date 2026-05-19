'use client'

import type { UserDialogUser } from '@/components/edit-user-dialog'
import {
  ShamelessProfileAvatarChrome,
  ShamelessProfileReadOnlyDetails,
} from '@/components/shameless-profile-blocks'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ShamelessProfileModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserDialogUser | null
  /** Opens full edit dialog (admin). */
  onEdit?: () => void
  /** Optional tertiary line under @username (e.g. source context). */
  sourceLabel?: string | null
}

export function ShamelessProfileModal({
  open,
  onOpenChange,
  user,
  onEdit,
  sourceLabel,
}: ShamelessProfileModalProps) {
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg gap-0 overflow-y-auto p-4 sm:p-5">
        <DialogHeader className="space-y-1 pb-3">
          <DialogTitle className="text-base">Profile</DialogTitle>
          <DialogDescription className="text-xs">Shamelesss profile preview (read-only).</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 sm:flex-row sm:gap-5">
          <ShamelessProfileAvatarChrome
            profile_picture_url={user.profile_picture_url}
            name={user.name}
            username={user.username}
            userId={user.id}
            age={user.age}
            country_code={user.country_code}
            connection_count={user.connection_count ?? 0}
          />
          <ShamelessProfileReadOnlyDetails profile={user} sourceLabel={sourceLabel} />
        </div>

        {onEdit ? (
          <DialogFooter className="pt-3 sm:justify-start">
            <Button type="button" onClick={onEdit}>
              Edit user
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
