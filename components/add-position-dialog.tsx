'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Category } from '@/types/database'
import { Upload } from 'lucide-react'
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
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSelectedCategoryId(categoryId || '')
      setName('')
      setImageUrl('')
      setError(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [open, categoryId])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('game_id', gameId)

      const response = await fetch('/api/content/positions/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to upload image')
      }

      const { imageUrl: uploadedUrl } = await response.json()
      setImageUrl(uploadedUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!imageUrl) {
      setError('Please upload an image or provide an image URL')
      return
    }

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
          game_id: gameId,
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
              <Label htmlFor="imageUrl">Image</Label>
              <div className="mt-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || loading}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Upload Image'}
                </Button>
                <div className="text-center text-xs text-gray-500">or</div>
                <Input
                  id="imageUrl"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Enter image URL"
                  className="mt-1"
                />
              </div>
              {imageUrl && (
                <div className="mt-2 text-xs text-gray-600">
                  Image URL: <span className="font-mono text-xs break-all">{imageUrl}</span>
                </div>
              )}
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

