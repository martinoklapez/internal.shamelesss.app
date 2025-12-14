'use client'

import { useState, useEffect } from 'react'
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
import { Trash2 } from 'lucide-react'

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameId: string
  category?: Category | null
  categories?: Category[] // Pass existing categories to calculate next sort_order
  onSuccess: () => void
}

export default function CategoryDialog({
  open,
  onOpenChange,
  gameId,
  category,
  categories = [],
  onSuccess,
}: CategoryDialogProps) {
  const isEditing = !!category
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('')
  const [sortOrder, setSortOrder] = useState(1)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens/closes or category changes
  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name)
        setDescription(category.description)
        setEmoji(category.emoji)
        setSortOrder(category.sort_order)
      } else {
        setName('')
        setDescription('')
        setEmoji('')
        // Calculate next sort_order based on existing categories
        const maxSortOrder = categories.length > 0
          ? Math.max(...categories.map(c => c.sort_order))
          : 0
        setSortOrder(maxSortOrder + 1)
      }
      setError(null)
      setDeleting(false)
    }
  }, [open, category, categories])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isEditing && category) {
        // Update existing category
        const response = await fetch('/api/categories/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            categoryId: category.id,
            updates: {
              name,
              description,
              emoji,
            },
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to update category')
        }
      } else {
        // Create new category (sort_order will be calculated automatically)
        const response = await fetch('/api/categories/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            gameId,
            name,
            description,
            emoji,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to create category')
        }
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!category || !confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const response = await fetch('/api/categories/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId: category.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete category')
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Category' : 'Add New Category'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the category information below.'
              : 'Create a new category. It will be created as inactive by default.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Basic, Spicy, Dirty"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emoji">Emoji *</Label>
                <Input
                  id="emoji"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  placeholder="🌱"
                  required
                  maxLength={10}
                  className="w-24"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Category description"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={sortOrder}
                readOnly
                disabled
                className="bg-gray-50 cursor-not-allowed"
              />
            </div>
            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading || deleting}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || deleting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || deleting}>
                {loading
                  ? isEditing
                    ? 'Updating...'
                    : 'Creating...'
                  : isEditing
                  ? 'Update'
                  : 'Create'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

