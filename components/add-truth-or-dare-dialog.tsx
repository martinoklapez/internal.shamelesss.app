'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Category, TruthOrDarePrompt } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Switch } from './ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

interface AddTruthOrDareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  onSuccess: () => void
  editingPrompt?: TruthOrDarePrompt | null
}

const TOD_GAME_ID = 'truth-or-dare'

export default function AddTruthOrDareDialog({
  open,
  onOpenChange,
  categories,
  onSuccess,
  editingPrompt = null,
}: AddTruthOrDareDialogProps) {
  const [kind, setKind] = useState<'truth' | 'dare'>('truth')
  const [body, setBody] = useState('')
  const [packIds, setPackIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const promptCategories = useMemo(
    () => categories.filter((category) => category.game_id === TOD_GAME_ID),
    [categories]
  )

  useEffect(() => {
    if (!open) return
    if (editingPrompt) {
      setKind(editingPrompt.kind)
      setBody(editingPrompt.body)
      setPackIds(editingPrompt.pack_ids ?? [])
      setIsActive(Boolean(editingPrompt.is_active))
    } else {
      setKind('truth')
      setBody('')
      setPackIds([])
      setIsActive(true)
    }
    setError(null)
  }, [open, editingPrompt])

  const handlePackToggle = (packId: string, checked: boolean) => {
    setPackIds((current) =>
      checked ? Array.from(new Set([...current, packId])) : current.filter((id) => id !== packId)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!body.trim()) {
      setError('Prompt text is required.')
      setLoading(false)
      return
    }
    if (packIds.length === 0) {
      setError('Select at least one pack.')
      setLoading(false)
      return
    }

    try {
      const endpoint = editingPrompt
        ? '/api/content/truth-or-dare/update'
        : '/api/content/truth-or-dare/create'
      const payload: Record<string, unknown> = {
        kind,
        body: body.trim(),
        pack_ids: packIds,
        is_active: isActive,
      }
      if (editingPrompt) payload.id = editingPrompt.id

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save prompt')
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prompt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{editingPrompt ? 'Edit Prompt' : 'Add Truth or Dare Prompt'}</DialogTitle>
          <DialogDescription>
            Manage `truth_or_dare_prompts` rows. Pack ids come from Truth or Dare categories.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="tod-kind">Kind</Label>
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as 'truth' | 'dare')}
              >
                <SelectTrigger id="tod-kind" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="truth">Truth</SelectItem>
                  <SelectItem value="dare">Dare</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tod-body">Prompt</Label>
              <Textarea
                id="tod-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Type the prompt shown to players"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label>Packs</Label>
              <div className="mt-2 space-y-2 rounded-md border p-3">
                {promptCategories.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No Truth or Dare categories found. Add `tod_*` categories first.
                  </p>
                ) : (
                  promptCategories.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-center justify-between gap-3 rounded border px-3 py-2"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {category.emoji} {category.name}
                        </p>
                        <p className="text-xs text-gray-500">{category.id}</p>
                      </div>
                      <Switch
                        checked={packIds.includes(category.id)}
                        onCheckedChange={(checked) => handlePackToggle(category.id, Boolean(checked))}
                      />
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label htmlFor="tod-is-active" className="text-sm font-medium">
                  Active
                </Label>
                <p className="text-xs text-gray-500">Inactive prompts are excluded by the app RPC.</p>
              </div>
              <Switch
                id="tod-is-active"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(Boolean(checked))}
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : editingPrompt ? 'Save Changes' : 'Create Prompt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
