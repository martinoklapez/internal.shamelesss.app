'use client'

import type { WouldYouRatherQuestion, Category } from '@/types/database'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from './ui/button'
import { Trash2, Plus } from 'lucide-react'
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
import AddWouldYouRatherDialog from './add-would-you-rather-dialog'

interface WouldYouRatherListProps {
  questions: WouldYouRatherQuestion[]
  categoryId: string
  gameId: string
  showCategory?: boolean
  categories?: Category[]
}

export default function WouldYouRatherList({ 
  questions, 
  categoryId, 
  gameId, 
  showCategory = false,
  categories = []
}: WouldYouRatherListProps) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/content/would-you-rather/delete?id=${itemToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete question')
      }

      router.refresh()
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    } catch (error) {
      console.error('Error deleting question:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete question')
    } finally {
      setDeleting(false)
    }
  }

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId || !showCategory) return null
    const category = categories.find(c => c.id === categoryId)
    return category ? `${category.emoji} ${category.name}` : null
  }

  if (questions.length === 0 && !addDialogOpen) {
    return (
      <>
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {showCategory ? 'No questions found for this game.' : 'No questions found for this category.'}
          </p>
          <Button onClick={() => setAddDialogOpen(true)} size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <AddWouldYouRatherDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          gameId={gameId}
          categoryId={categoryId || undefined}
          categories={categories}
          onSuccess={() => router.refresh()}
        />
      </>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Questions ({questions.length})
          </h2>
          <Button onClick={() => setAddDialogOpen(true)} size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

      <div className="space-y-3">
        {questions.map((question) => (
          <div
            key={question.id}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {question.question}
                  </h3>
                  {showCategory && question.category_id && getCategoryName(question.category_id) && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      {getCategoryName(question.category_id)}
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      question.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {question.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {question.difficulty_level && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {question.difficulty_level}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Option A</p>
                    <p className="text-sm text-gray-900 dark:text-white">{question.option_a}</p>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Option B</p>
                    <p className="text-sm text-gray-900 dark:text-white">{question.option_b}</p>
                  </div>
                </div>

                {expandedId === question.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <p><span className="font-semibold">ID:</span> {question.id}</p>
                      {question.created_at && (
                        <p><span className="font-semibold">Created:</span> {new Date(question.created_at).toLocaleDateString()}</p>
                      )}
                      {question.updated_at && (
                        <p><span className="font-semibold">Updated:</span> {new Date(question.updated_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => toggleExpand(question.id)}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {expandedId === question.id ? 'Hide' : 'Details'}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteClick(question.id)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>

      <AddWouldYouRatherDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        gameId={gameId}
        categoryId={categoryId || undefined}
        categories={categories}
        onSuccess={() => router.refresh()}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

