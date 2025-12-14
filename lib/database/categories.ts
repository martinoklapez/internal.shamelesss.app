import { createClient } from '@/lib/supabase/server'
import type { Category } from '@/types/database'

export async function updateCategory(
  categoryId: string,
  updates: Partial<Category>
): Promise<Category> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', categoryId)
    .select()
    .single()

  if (error) {
    console.error('Error updating category:', error)
    throw error
  }

  return data
}

export async function toggleCategoryActive(categoryId: string, isActive: boolean): Promise<Category> {
  return updateCategory(categoryId, { is_active: isActive })
}

