'use client'

import type { NeverHaveIEverStatement, Category } from '@/types/database'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from './ui/button'
import { formatDate } from '@/lib/utils/date'
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
import AddNeverHaveIEverDialog from './add-never-have-i-ever-dialog'

interface NeverHaveIEverListProps {
  statements: NeverHaveIEverStatement[]
  categoryId: string
  gameId: string
  showCategory?: boolean
  categories?: Category[]
}

export default function NeverHaveIEverList({ 
  statements, 
  categoryId, 
  gameId, 
  showCategory = false,
  categories = []
}: NeverHaveIEverListProps) {
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
      const response = await fetch(`/api/content/never-have-i-ever/delete?id=${itemToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete statement')
      }

      router.refresh()
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    } catch (error) {
      console.error('Error deleting statement:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete statement')
    } finally {
      setDeleting(false)
    }
  }

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId || !showCategory) return null
    const category = categories.find(c => c.id === categoryId)
    return category ? `${category.emoji} ${category.name}` : null
  }

  if (statements.length === 0 && !addDialogOpen) {
    return (
      <>
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {showCategory ? 'No statements found for this game.' : 'No statements found for this category.'}
          </p>
          <Button onClick={() => setAddDialogOpen(true)} size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <AddNeverHaveIEverDialog
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
            Statements ({statements.length})
          </h2>
          <Button onClick={() => setAddDialogOpen(true)} size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          {statements.map((statement) => (
            <div
              key={statement.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {statement.statement}
                    </p>
                    {showCategory && statement.category_id && getCategoryName(statement.category_id) && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {getCategoryName(statement.category_id)}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        statement.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {statement.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {statement.difficulty_level && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {statement.difficulty_level}
                      </span>
                    )}
                  </div>

                  {expandedId === statement.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <p><span className="font-semibold">ID:</span> {statement.id}</p>
                        {statement.created_at && (
                          <p><span className="font-semibold">Created:</span> {formatDate(statement.created_at)}</p>
                        )}
                        {statement.updated_at && (
                          <p><span className="font-semibold">Updated:</span> {formatDate(statement.updated_at)}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => toggleExpand(statement.id)}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {expandedId === statement.id ? 'Hide' : 'Details'}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(statement.id)}
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

      <AddNeverHaveIEverDialog
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
            <AlertDialogTitle>Delete Statement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this statement? This action cannot be undone.
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
