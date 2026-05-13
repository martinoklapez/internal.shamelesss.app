'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Category, WouldYouRatherQuestion } from '@/types/database'
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

interface AddWouldYouRatherDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameId: string
  categoryId?: string
  categories?: Category[]
  onSuccess: () => void
  editingQuestion?: WouldYouRatherQuestion | null
}

export default function AddWouldYouRatherDialog({
  open,
  onOpenChange,
  gameId,
  categoryId,
  categories = [],
  onSuccess,
  editingQuestion = null,
}: AddWouldYouRatherDialogProps) {
  const router = useRouter()
  const isEditing = Boolean(editingQuestion)
  const [question, setQuestion] = useState('')
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categoryId || '')
  const [difficultyLevel, setDifficultyLevel] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editingQuestion) {
      setQuestion(editingQuestion.question)
      setOptionA(editingQuestion.option_a)
      setOptionB(editingQuestion.option_b)
      setSelectedCategoryId(editingQuestion.category_id || categoryId || '')
      setDifficultyLevel((editingQuestion.difficulty_level as 'easy' | 'medium' | 'hard') || 'medium')
    } else {
      setSelectedCategoryId(categoryId || '')
      setQuestion('')
      setOptionA('')
      setOptionB('')
      setDifficultyLevel('medium')
    }
    setError(null)
  }, [open, categoryId, editingQuestion])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const url = isEditing ? '/api/content/would-you-rather/update' : '/api/content/would-you-rather/create'
      const payload = isEditing
        ? {
            id: editingQuestion!.id,
            question,
            option_a: optionA,
            option_b: optionB,
            category_id: selectedCategoryId || null,
            difficulty_level: difficultyLevel,
          }
        : {
            question,
            option_a: optionA,
            option_b: optionB,
            category_id: selectedCategoryId || null,
            difficulty_level: difficultyLevel,
          }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} question`)
      }

      onSuccess()
      router.refresh()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} question`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Would You Rather Question' : 'Add Would You Rather Question'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update this question for the game.'
              : 'Create a new &quot;Would You Rather&quot; question for this game.'}
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
                placeholder="Would you rather..."
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="optionA">Option A</Label>
              <Input
                id="optionA"
                value={optionA}
                onChange={(e) => setOptionA(e.target.value)}
                placeholder="First option"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="optionB">Option B</Label>
              <Input
                id="optionB"
                value={optionB}
                onChange={(e) => setOptionB(e.target.value)}
                placeholder="Second option"
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
              {loading ? (isEditing ? 'Saving...' : 'Creating...') : isEditing ? 'Save changes' : 'Create Question'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

