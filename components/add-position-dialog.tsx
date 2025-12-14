'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Category } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

interface AddPositionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameId: string
  categoryId?: string
  categories?: Category[]
  onSuccess: () => void
}

export default function AddPositionDialog({
  open,
  onOpenChange,
  gameId,
  categoryId,
  categories = [],
  onSuccess,
}: AddPositionDialogProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categoryId || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedCategoryId(categoryId || '')
      setName('')
      setImageUrl('')
      setError(null)
    }
  }, [open, categoryId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/content/positions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          image_url: imageUrl,
          category_id: selectedCategoryId || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create position')
      }

      onSuccess()
      router.refresh()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create position')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Position</DialogTitle>
          <DialogDescription>
            Create a new position for this game.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Position name"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                required
                className="mt-1"
              />
            </div>
            {categories.length > 0 && (
              <div>
                <Label htmlFor="category">Category (optional)</Label>
                <Select
                  value={selectedCategoryId || undefined}
                  onValueChange={(value) => setSelectedCategoryId(value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.emoji} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCategoryId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCategoryId('')}
                    className="mt-1 text-xs"
                  >
                    Clear selection
                  </Button>
                )}
              </div>
            )}
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Position'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

