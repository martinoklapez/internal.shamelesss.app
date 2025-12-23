'use client'

import React, { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb'
import { Separator } from './ui/separator'
import { SidebarTrigger } from './ui/sidebar'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { User, Plus } from 'lucide-react'

export function BreadcrumbWrapper() {
  const pathname = usePathname()
  const router = useRouter()
  const [userRole, setUserRole] = useState<'admin' | 'dev' | 'developer' | 'promoter' | null>(null)
  const [userProfile, setUserProfile] = useState<{ name: string | null; profile_picture_url: string | null } | null>(null)
  const [characterName, setCharacterName] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Fetch character name if on character detail page (only after mount to avoid hydration errors)
  useEffect(() => {
    if (!mounted) return
    
    const segments = (pathname || '').split('/').filter(Boolean)
    if (segments[0] === 'characters' && segments[1]) {
      // First check if character name was injected via script tag
      const injectedName = (window as any).__CHARACTER_NAME__ || null
      
      if (injectedName) {
        setCharacterName(injectedName)
        // Clean up after use
        delete (window as any).__CHARACTER_NAME__
      } else {
        // Fallback to fetching if not injected
        async function fetchCharacterName() {
          const { data, error } = await supabase
            .from('ai_characters')
            .select('name')
            .eq('id', segments[1])
            .single()
          
          if (!error && data) {
            setCharacterName(data.name)
          }
        }
        fetchCharacterName()
      }
    } else {
      setCharacterName(null)
    }
  }, [pathname, supabase, mounted])

  const segments = (pathname || '').split('/').filter(Boolean)

  const getSegmentLabel = (segment: string, index: number) => {
    // Top-level known routes
    if (segment === 'home') return 'Home'
    if (segment === 'games') return 'Games'
    if (segment === 'devices') return 'Devices'
    if (segment === 'feature-flags') return 'Feature Flags'
    if (segment === 'profile') return 'Profile'
    if (segment === 'onboarding') return 'App Onboarding'
    if (segment === 'knowledge') return 'Knowledge'
    if (segment === 'generate') return 'Generate Images'
    if (segment === 'characters') return 'Characters'

    // Nested routes
    if (segments[0] === 'devices' && index === 1) {
      return `Device ${segment}`
    }

    if (segments[0] === 'characters' && index === 1) {
      // Only show character name after mount to avoid hydration errors
      // During SSR and initial render, show UUID, then update to name after hydration
      return mounted && characterName ? characterName : segment
    }

    if (segments[0] === 'games') {
      if (segment === 'content') return 'Content'
      if (segment === 'categories') return 'Categories'
      // Treat gameId as readable label
      if (index === 1) {
        return segment
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      }
    }

    // Fallback: Capitalize
    return segment.charAt(0).toUpperCase() + segment.slice(1)
  }
  
  const isOnboardingPage = pathname === '/onboarding'
  const onboardingHandlers = typeof window !== 'undefined' ? (window as any).onboardingAddHandlers : null

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
            {segments.length === 0 ? (
              <BreadcrumbItem>
                <BreadcrumbPage>Home</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              <>
                {segments.map((segment, index) => {
                  const href = '/' + segments.slice(0, index + 1).join('/')
                  const label = getSegmentLabel(segment, index)
                  const isLast = index === segments.length - 1

                  return (
                    <React.Fragment key={href}>
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage>{label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator />}
                    </React.Fragment>
                  )
                })}
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2">
        {isOnboardingPage && onboardingHandlers && (
          <Button
            onClick={onboardingHandlers.addScreen}
            size="sm"
            variant="outline"
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Screen
          </Button>
        )}
        <Link
          href="/profile"
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Avatar className="h-8 w-8">
          {userProfile?.profile_picture_url ? (
              <AvatarImage
              src={userProfile.profile_picture_url}
              alt={userProfile.name || 'Profile'}
            />
          ) : (
              <AvatarFallback>
              <User className="h-4 w-4 text-gray-600" />
              </AvatarFallback>
          )}
          </Avatar>
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
      </div>
    </header>
  )
}

