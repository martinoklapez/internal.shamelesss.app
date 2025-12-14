'use client'

import type { RoleplayScenario, Category } from '@/types/database'
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
import AddRoleplayScenarioDialog from './add-roleplay-scenario-dialog'

interface RoleplayScenariosListProps {
  scenarios: RoleplayScenario[]
  categoryId: string
  gameId: string
  showCategory?: boolean
  categories?: Category[]
}

export default function RoleplayScenariosList({ 
  scenarios, 
  categoryId, 
  gameId, 
  showCategory = false,
  categories = []
}: RoleplayScenariosListProps) {
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
      const response = await fetch(`/api/content/roleplay-scenarios/delete?id=${itemToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete scenario')
      }

      router.refresh()
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    } catch (error) {
      console.error('Error deleting scenario:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete scenario')
    } finally {
      setDeleting(false)
    }
  }

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId || !showCategory) return null
    const category = categories.find(c => c.id === categoryId)
    return category ? `${category.emoji} ${category.name}` : null
  }

  if (scenarios.length === 0 && !addDialogOpen) {
    return (
      <>
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {showCategory ? 'No scenarios found for this game.' : 'No scenarios found for this category.'}
          </p>
          <Button onClick={() => setAddDialogOpen(true)} size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <AddRoleplayScenarioDialog
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
            Scenarios ({scenarios.length})
          </h2>
          <Button onClick={() => setAddDialogOpen(true)} size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {scenario.title}
                    </h3>
                    {showCategory && scenario.category_id && getCategoryName(scenario.category_id) && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {getCategoryName(scenario.category_id)}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        scenario.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {scenario.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {scenario.difficulty_level && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {scenario.difficulty_level}
                      </span>
                    )}
                  </div>
                  
                  {scenario.shared_description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {scenario.shared_description}
                    </p>
                  )}

                  {expandedId === scenario.id && (
                    <div className="mt-4 space-y-3 pt-4 border-t border-gray-200">
                      {scenario.media && (
                        <div>
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Media:</span>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{scenario.media}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {scenario.player1_role_title && (
                          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Player 1</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{scenario.player1_role_title}</p>
                            {scenario.player1_twist && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{scenario.player1_twist}</p>
                            )}
                          </div>
                        )}
                        {scenario.player2_role_title && (
                          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Player 2</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{scenario.player2_role_title}</p>
                            {scenario.player2_twist && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{scenario.player2_twist}</p>
                            )}
                          </div>
                        )}
                        {scenario.player3_role_title && (
                          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Player 3</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{scenario.player3_role_title}</p>
                            {scenario.player3_twist && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{scenario.player3_twist}</p>
                            )}
                          </div>
                        )}
                        {scenario.player4_role_title && (
                          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Player 4</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{scenario.player4_role_title}</p>
                            {scenario.player4_twist && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{scenario.player4_twist}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 pt-2">
                        <p><span className="font-semibold">ID:</span> {scenario.id}</p>
                        {scenario.created_at && (
                          <p><span className="font-semibold">Created:</span> {new Date(scenario.created_at).toLocaleDateString()}</p>
                        )}
                        {scenario.updated_at && (
                          <p><span className="font-semibold">Updated:</span> {new Date(scenario.updated_at).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => toggleExpand(scenario.id)}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {expandedId === scenario.id ? 'Hide' : 'View'}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(scenario.id)}
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

      <AddRoleplayScenarioDialog
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
            <AlertDialogTitle>Delete Scenario</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this scenario? This action cannot be undone.
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
