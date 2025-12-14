'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from './ui/breadcrumb'
import { Separator } from './ui/separator'
import { SidebarTrigger } from './ui/sidebar'
import { Badge } from './ui/badge'

export function BreadcrumbWrapper() {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<'admin' | 'dev' | 'developer' | 'promoter' | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchUserRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()
        
        if (roleData) {
          setUserRole(roleData.role as 'admin' | 'dev' | 'developer' | 'promoter')
        }
      }
    }
    fetchUserRole()
  }, [supabase])
  
  const getPageTitle = () => {
    if (pathname === '/home') return 'Home'
    if (pathname === '/games') return 'Games'
    if (pathname === '/feature-flags') return 'Feature Flags'
    if (pathname === '/devices') return 'Devices'
    if (pathname?.startsWith('/devices/')) {
      return 'Device Details'
    }
    if (pathname?.startsWith('/games/')) {
      const parts = pathname.split('/')
      if (parts.length === 2) return 'Games'
      if (parts.length === 3 && parts[2] === 'content') return 'All Content'
      if (parts.length === 4 && parts[2] === 'categories') return 'Category Content'
      return 'Game Details'
    }
    return 'Admin Panel'
  }
  
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 bg-white">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{getPageTitle()}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {userRole && (
        <Badge variant="outline" className="text-sm font-medium">
          {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
        </Badge>
      )}
    </header>
  )
}

