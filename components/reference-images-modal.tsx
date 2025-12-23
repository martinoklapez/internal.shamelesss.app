'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ReferenceImagesManager } from '@/components/reference-images-manager'
import { Image } from 'lucide-react'
import type { CharacterReferenceImage } from '@/types/database'

interface ReferenceImagesModalProps {
  characterId: string
  initialImages: CharacterReferenceImage[]
  children?: React.ReactNode
}

export function ReferenceImagesModal({
  characterId,
  initialImages,
  children,
}: ReferenceImagesModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant="outline">
            <Image className="h-4 w-4 mr-2" />
            Manage Reference Images
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Reference Images</DialogTitle>
          <DialogDescription>
            Upload, delete, and set default reference images for this character.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ReferenceImagesManager
            characterId={characterId}
            initialImages={initialImages}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

