'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Category } from '@/types/database'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Button } from './ui/button'
import CategoryDialog from './category-dialog'
import { Pencil, Plus, Eye, List } from 'lucide-react'
import Link from 'next/link'

interface CategoryManagerProps {
  gameId: string
  categories: Category[]
  gameTitle?: string
}

export default function CategoryManager({ gameId, categories: initialCategories, gameTitle }: CategoryManagerProps) {
  const router = useRouter()
  const [categories, setCategories] = useState(initialCategories)
  const [loadingCategoryId, setLoadingCategoryId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  const handleToggleActive = async (categoryId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus
    
    // Set loading state for this specific category
    setLoadingCategoryId(categoryId)
    
    // Optimistically update the UI
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId ? { ...cat, is_active: newStatus } : cat
      )
    )

    try {
      const response = await fetch('/api/categories/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId,
          isActive: newStatus,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update category')
      }

      const updatedCategory = await response.json()
      
      // Update with server response
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId ? updatedCategory : cat
        )
      )
      
      router.refresh()
    } catch (error) {
      console.error('Error toggling category:', error)
      // Revert optimistic update on error
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId ? { ...cat, is_active: currentStatus } : cat
        )
      )
      alert(error instanceof Error ? error.message : 'Failed to update category. Please try again.')
    } finally {
      setLoadingCategoryId(null)
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingCategory(null)
    setDialogOpen(true)
  }

  const handleDialogSuccess = () => {
    router.refresh()
  }

  const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
          Categories ({categories.length})
        </h4>
        <div className="flex gap-2">
          <Link href={`/games/${gameId}/content`}>
            <Button variant="outline" size="sm">
              <List className="h-4 w-4 mr-2" />
              Show All Content
            </Button>
          </Link>
          <Button onClick={handleAdd} size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {sortedCategories.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No categories found for this game.
        </p>
      ) : (
        <div className="space-y-3">
          {sortedCategories.map((category) => (
            <div
              key={category.id}
              className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 p-4 bg-white rounded-lg border border-gray-200"
            >
              <span className="text-2xl">{category.emoji}</span>
              
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </h5>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      category.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {category.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {category.description}
                </p>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span>Sort: {category.sort_order}</span>
                  <span>ID: {category.id}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  id={`category-${category.id}`}
                  checked={category.is_active}
                  onCheckedChange={() => handleToggleActive(category.id, category.is_active)}
                  disabled={loadingCategoryId === category.id}
                />
                <Label
                  htmlFor={`category-${category.id}`}
                  className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer w-14 text-left"
                >
                  {category.is_active ? 'Active' : 'Inactive'}
                </Label>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/games/${gameId}/categories/${category.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(category)}
                  className="shrink-0"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        gameId={gameId}
        category={editingCategory}
        categories={categories}
        onSuccess={handleDialogSuccess}
      />
    </div>
  )
}

