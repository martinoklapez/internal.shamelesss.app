'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
import { User } from 'lucide-react'

export function BreadcrumbWrapper() {
  const pathname = usePathname()
  const router = useRouter()
  const [userRole, setUserRole] = useState<'admin' | 'dev' | 'developer' | 'promoter' | null>(null)
  const [userProfile, setUserProfile] = useState<{ name: string | null; profile_picture_url: string | null } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Fetch role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()
        
        if (roleData) {
          setUserRole(roleData.role as 'admin' | 'dev' | 'developer' | 'promoter')
        }

        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, profile_picture_url')
          .eq('user_id', user.id)
          .single()
        
        if (profile) {
          setUserProfile(profile)
        }
      }
    }
    fetchUserData()

    // Listen for profile updates
    const handleProfileUpdate = (event: CustomEvent) => {
      const { name, profile_picture_url } = event.detail
      setUserProfile({
        name,
        profile_picture_url,
      })
    }

    window.addEventListener('profile-updated', handleProfileUpdate as EventListener)

    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate as EventListener)
    }
  }, [supabase])
  
  const getPageTitle = () => {
    if (pathname === '/home') return 'Home'
    if (pathname === '/games') return 'Games'
    if (pathname === '/feature-flags') return 'Feature Flags'
    if (pathname === '/devices') return 'Devices'
    if (pathname === '/profile') return 'Profile'
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
      <Link
        href="/profile"
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {userProfile?.profile_picture_url ? (
          <Image
            src={userProfile.profile_picture_url}
            alt={userProfile.name || 'Profile'}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <User className="h-4 w-4 text-gray-600" />
          </div>
        )}
        {userProfile?.name && (
          <span className="text-sm font-medium text-gray-700 hidden sm:inline">
            {userProfile.name}
          </span>
        )}
        {userRole && (
          <Badge variant="outline" className="text-sm font-medium">
            {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
          </Badge>
        )}
      </Link>
    </header>
  )
}

