'use client'

import type { Position, Category } from '@/types/database'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
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
import AddPositionDialog from './add-position-dialog'

interface PositionsListProps {
  positions: Position[]
  categoryId: string
  gameId: string
  showCategory?: boolean
  categories?: Category[]
}

export default function PositionsList({ 
  positions, 
  categoryId, 
  gameId, 
  showCategory = false,
  categories = []
}: PositionsListProps) {
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
      const response = await fetch(`/api/content/positions/delete?id=${itemToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete position')
      }

      router.refresh()
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    } catch (error) {
      console.error('Error deleting position:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete position')
    } finally {
      setDeleting(false)
    }
  }

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId || !showCategory) return null
    const category = categories.find(c => c.id === categoryId)
    return category ? `${category.emoji} ${category.name}` : null
  }

  if (positions.length === 0 && !addDialogOpen) {
    return (
      <>
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {showCategory ? 'No positions found for this game.' : 'No positions found for this category.'}
          </p>
          <Button onClick={() => setAddDialogOpen(true)} size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <AddPositionDialog
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
            Positions ({positions.length})
          </h2>
          <Button onClick={() => setAddDialogOpen(true)} size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {positions.map((position) => (
            <div
              key={position.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden relative"
            >
              <div className="aspect-square relative bg-gray-100">
                {position.image_url ? (
                  <Image
                    src={position.image_url}
                    alt={position.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    No image
                  </div>
                )}
              </div>
              <div className="p-2">
                <div className="flex flex-col gap-1 mb-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                    {position.name}
                  </h3>
                  {showCategory && position.category_id && getCategoryName(position.category_id) && (
                    <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 self-start">
                      {getCategoryName(position.category_id)}
                    </span>
                  )}
                </div>
                
                {expandedId === position.id && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <p className="truncate"><span className="font-semibold">ID:</span> {position.id}</p>
                      {position.created_at && (
                        <p><span className="font-semibold">Created:</span> {new Date(position.created_at).toLocaleDateString()}</p>
                      )}
                      {position.image_url && (
                        <p className="break-all">
                          <span className="font-semibold">URL:</span>{' '}
                          <a 
                            href={position.image_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {position.image_url}
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-1">
                  <button
                    onClick={() => toggleExpand(position.id)}
                    className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {expandedId === position.id ? 'Hide' : 'Details'}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(position.id)}
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AddPositionDialog
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
            <AlertDialogTitle>Delete Position</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this position? This action cannot be undone.
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
