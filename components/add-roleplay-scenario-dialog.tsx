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

interface AddRoleplayScenarioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameId: string
  categoryId?: string
  categories?: Category[]
  onSuccess: () => void
}

export default function AddRoleplayScenarioDialog({
  open,
  onOpenChange,
  gameId,
  categoryId,
  categories = [],
  onSuccess,
}: AddRoleplayScenarioDialogProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [sharedDescription, setSharedDescription] = useState('')
  const [media, setMedia] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categoryId || '')
  const [difficultyLevel, setDifficultyLevel] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [player1RoleTitle, setPlayer1RoleTitle] = useState('')
  const [player1Twist, setPlayer1Twist] = useState('')
  const [player2RoleTitle, setPlayer2RoleTitle] = useState('')
  const [player2Twist, setPlayer2Twist] = useState('')
  const [player3RoleTitle, setPlayer3RoleTitle] = useState('')
  const [player3Twist, setPlayer3Twist] = useState('')
  const [player4RoleTitle, setPlayer4RoleTitle] = useState('')
  const [player4Twist, setPlayer4Twist] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedCategoryId(categoryId || '')
      setTitle('')
      setSharedDescription('')
      setMedia('')
      setDifficultyLevel('medium')
      setPlayer1RoleTitle('')
      setPlayer1Twist('')
      setPlayer2RoleTitle('')
      setPlayer2Twist('')
      setPlayer3RoleTitle('')
      setPlayer3Twist('')
      setPlayer4RoleTitle('')
      setPlayer4Twist('')
      setError(null)
    }
  }, [open, categoryId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/content/roleplay-scenarios/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          shared_description: sharedDescription || null,
          media: media || null,
          category_id: selectedCategoryId || null,
          difficulty_level: difficultyLevel,
          player1_role_title: player1RoleTitle || null,
          player1_twist: player1Twist || null,
          player2_role_title: player2RoleTitle || null,
          player2_twist: player2Twist || null,
          player3_role_title: player3RoleTitle || null,
          player3_twist: player3Twist || null,
          player4_role_title: player4RoleTitle || null,
          player4_twist: player4Twist || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create scenario')
      }

      onSuccess()
      router.refresh()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Roleplay Scenario</DialogTitle>
          <DialogDescription>
            Create a new roleplay scenario for this game.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Scenario title"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sharedDescription">Shared Description</Label>
              <Input
                id="sharedDescription"
                value={sharedDescription}
                onChange={(e) => setSharedDescription(e.target.value)}
                placeholder="Description shared by all players"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="media">Media URL</Label>
              <Input
                id="media"
                value={media}
                onChange={(e) => setMedia(e.target.value)}
                placeholder="https://example.com/media.jpg"
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
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <Label htmlFor="player1Role">Player 1 Role Title</Label>
                <Input
                  id="player1Role"
                  value={player1RoleTitle}
                  onChange={(e) => setPlayer1RoleTitle(e.target.value)}
                  placeholder="Role title"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="player1Twist">Player 1 Twist</Label>
                <Input
                  id="player1Twist"
                  value={player1Twist}
                  onChange={(e) => setPlayer1Twist(e.target.value)}
                  placeholder="Twist"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="player2Role">Player 2 Role Title</Label>
                <Input
                  id="player2Role"
                  value={player2RoleTitle}
                  onChange={(e) => setPlayer2RoleTitle(e.target.value)}
                  placeholder="Role title"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="player2Twist">Player 2 Twist</Label>
                <Input
                  id="player2Twist"
                  value={player2Twist}
                  onChange={(e) => setPlayer2Twist(e.target.value)}
                  placeholder="Twist"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="player3Role">Player 3 Role Title</Label>
                <Input
                  id="player3Role"
                  value={player3RoleTitle}
                  onChange={(e) => setPlayer3RoleTitle(e.target.value)}
                  placeholder="Role title"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="player3Twist">Player 3 Twist</Label>
                <Input
                  id="player3Twist"
                  value={player3Twist}
                  onChange={(e) => setPlayer3Twist(e.target.value)}
                  placeholder="Twist"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="player4Role">Player 4 Role Title</Label>
                <Input
                  id="player4Role"
                  value={player4RoleTitle}
                  onChange={(e) => setPlayer4RoleTitle(e.target.value)}
                  placeholder="Role title"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="player4Twist">Player 4 Twist</Label>
                <Input
                  id="player4Twist"
                  value={player4Twist}
                  onChange={(e) => setPlayer4Twist(e.target.value)}
                  placeholder="Twist"
                  className="mt-1"
                />
              </div>
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
              {loading ? 'Creating...' : 'Create Scenario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

