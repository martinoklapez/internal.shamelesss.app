import { createClient } from '@/lib/supabase/server'

export type UserRole = 'admin' | 'dev' | 'developer' | 'promoter' | 'user'

export interface UserRoleData {
  user_id: string
  role: UserRole
  created_at: string
  updated_at: string
}

/**
 * Get user role from the database
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return null
    }

    return data.role as UserRole
  } catch (error) {
    console.error('Error fetching user role:', error)
    return null
  }
}

/**
 * Check if user has one of the allowed roles
 */
export async function hasRole(userId: string, allowedRoles: UserRole[]): Promise<boolean> {
  const role = await getUserRole(userId)
  return role !== null && allowedRoles.includes(role)
}

/**
 * Check if user can access a specific route
 */
export async function canAccessRoute(userId: string, route: string): Promise<boolean> {
  const role = await getUserRole(userId)
  
  if (!role) {
    return false
  }

  // Promoters cannot access games and feature flags
  if (role === 'promoter') {
    if (route.startsWith('/games') || route === '/feature-flags') {
      return false
    }
  }

  // Admin, dev, and developer can access everything
  if (role === 'admin' || role === 'dev' || role === 'developer') {
    return true
  }

  // Promoters can access home and devices
  if (role === 'promoter') {
    return route === '/home' || route.startsWith('/devices')
  }

  return false
}

/**
 * Get allowed routes for a user role
 */
export function getAllowedRoutes(role: UserRole | null): string[] {
  if (!role) {
    return []
  }

  if (role === 'admin' || role === 'dev' || role === 'developer') {
    return ['/home', '/games', '/devices', '/feature-flags']
  }

  if (role === 'promoter') {
    return ['/home', '/devices']
  }

  return []
}

