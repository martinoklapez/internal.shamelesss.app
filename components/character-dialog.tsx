'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AICharacter } from '@/types/database'

interface CharacterDialogProps {
  character?: AICharacter
  onCharacterCreated?: (character: AICharacter) => void
  onCharacterUpdated?: (character: AICharacter) => void
  onCharacterDeleted?: (characterId: string) => void
  children?: React.ReactNode
}

export function CharacterDialog({
  character,
  onCharacterCreated,
  onCharacterUpdated,
  onCharacterDeleted,
  children,
}: CharacterDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(character?.name || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const isEditing = !!character

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      return
    }

    setIsLoading(true)

    try {
      const url = isEditing
        ? '/api/characters/update'
        : '/api/characters/create'

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(isEditing && { id: character.id }),
          name: name.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save character')
      }

      const savedCharacter = await response.json()

      if (isEditing && onCharacterUpdated) {
        onCharacterUpdated(savedCharacter)
      } else if (!isEditing && onCharacterCreated) {
        onCharacterCreated(savedCharacter)
      }

      setOpen(false)
      setName('')
      router.refresh()
    } catch (error) {
      console.error('Error saving character:', error)
      alert(error instanceof Error ? error.message : 'Failed to save character')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!character || !confirm(`Are you sure you want to delete "${character.name}"? This will also delete all reference and generated images.`)) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch('/api/characters/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: character.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete character')
      }

      if (onCharacterDeleted) {
        onCharacterDeleted(character.id)
      }

      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error deleting character:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete character')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant="outline">
            {isEditing ? 'Edit' : 'Add Character'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Character' : 'Create Character'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the character name.'
                : 'Create a new character. You can add reference images after creation.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Character Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Alice, Bob, Character 1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            <div>
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting || isLoading}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading || isDeleting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || isDeleting || !name.trim()}>
                {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Character'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

