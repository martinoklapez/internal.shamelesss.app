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

interface AddMostLikelyToDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameId: string
  categoryId?: string
  categories?: Category[]
  onSuccess: () => void
}

export default function AddMostLikelyToDialog({
  open,
  onOpenChange,
  gameId,
  categoryId,
  categories = [],
  onSuccess,
}: AddMostLikelyToDialogProps) {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categoryId || '')
  const [difficultyLevel, setDifficultyLevel] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedCategoryId(categoryId || '')
      setQuestion('')
      setDifficultyLevel('medium')
      setError(null)
    }
  }, [open, categoryId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/content/most-likely-to/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          category_id: selectedCategoryId || null,
          difficulty_level: difficultyLevel,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create question')
      }

      onSuccess()
      router.refresh()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create question')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Most Likely To Question</DialogTitle>
          <DialogDescription>
            Create a new &quot;Most Likely To&quot; question for this game.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Who is most likely to..."
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
            <div>
              <Label htmlFor="difficulty">Difficulty Level</Label>
              <Select
                value={difficultyLevel}
                onValueChange={(value) => setDifficultyLevel(value as 'easy' | 'medium' | 'hard')}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              {loading ? 'Creating...' : 'Create Question'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

