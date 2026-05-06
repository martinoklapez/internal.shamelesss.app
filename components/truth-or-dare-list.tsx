'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Category, TruthOrDarePrompt } from '@/types/database'
import { formatDate } from '@/lib/utils/date'
import { notifyError } from '@/lib/notify'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Plus, SquarePen, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'
import AddTruthOrDareDialog from './add-truth-or-dare-dialog'

interface TruthOrDareListProps {
  prompts: TruthOrDarePrompt[]
  categories: Category[]
}

export default function TruthOrDareList({ prompts, categories }: TruthOrDareListProps) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<TruthOrDarePrompt | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>()
    categories.forEach((category) => map.set(category.id, category))
    return map
  }, [categories])

  const openAddDialog = () => {
    setEditingPrompt(null)
    setDialogOpen(true)
  }

  const openEditDialog = (prompt: TruthOrDarePrompt) => {
    setEditingPrompt(prompt)
    setDialogOpen(true)
  }

  const handleToggleActive = async (prompt: TruthOrDarePrompt, checked: boolean) => {
    setUpdating(prompt.id)
    try {
      const response = await fetch('/api/content/truth-or-dare/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: prompt.id, is_active: checked }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update active state')
      }
      router.refresh()
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Failed to update active state')
    } finally {
      setUpdating(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setUpdating(deleteId)
    try {
      const response = await fetch(`/api/content/truth-or-dare/delete?id=${deleteId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete prompt')
      }
      setDeleteDialogOpen(false)
      setDeleteId(null)
      router.refresh()
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Failed to delete prompt')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Prompts ({prompts.length})</h2>
          <Button onClick={openAddDialog} size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {prompts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No Truth or Dare prompts yet.</p>
            <Button onClick={openAddDialog}>Add First Prompt</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {prompts.map((prompt) => (
              <div key={prompt.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <span className="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-xs font-medium">
                        {prompt.kind.toUpperCase()}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          prompt.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {prompt.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{prompt.body}</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {prompt.pack_ids.map((packId) => {
                        const category = categoryMap.get(packId)
                        return (
                          <span
                            key={`${prompt.id}-${packId}`}
                            className="rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-xs font-medium"
                          >
                            {category ? `${category.emoji} ${category.name}` : packId}
                          </span>
                        )
                      })}
                    </div>

                    {expandedId === prompt.id ? (
                      <div className="mt-3 border-t pt-3 text-xs text-gray-500">
                        <p>
                          <span className="font-semibold">ID:</span> {prompt.id}
                        </p>
                        <p>
                          <span className="font-semibold">Created:</span> {formatDate(prompt.created_at)}
                        </p>
                        <p>
                          <span className="font-semibold">Updated:</span> {formatDate(prompt.updated_at)}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={prompt.is_active}
                      disabled={updating === prompt.id}
                      onCheckedChange={(checked) => handleToggleActive(prompt, Boolean(checked))}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
                    >
                      {expandedId === prompt.id ? 'Hide' : 'Details'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(prompt)}>
                      <SquarePen className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setDeleteId(prompt.id)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddTruthOrDareDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        editingPrompt={editingPrompt}
        onSuccess={() => router.refresh()}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the prompt from `truth_or_dare_prompts`.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={Boolean(updating)}
              className="bg-red-600 hover:bg-red-700"
            >
              {updating ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
