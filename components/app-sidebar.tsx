'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from './ui/sidebar'
import { Gamepad2, Home, Flag, Smartphone } from 'lucide-react'
import SignOutButton from './sign-out-button'

const allMenuItems = [
  {
    title: 'Home',
    url: '/home',
    icon: Home,
    roles: ['admin', 'dev', 'developer', 'promoter'] as const,
  },
  {
    title: 'Games',
    url: '/games',
    icon: Gamepad2,
    roles: ['admin', 'dev', 'developer'] as const,
  },
  {
    title: 'Feature Flags',
    url: '/feature-flags',
    icon: Flag,
    roles: ['admin', 'dev', 'developer'] as const,
  },
  {
    title: 'Devices',
    url: '/devices',
    icon: Smartphone,
    roles: ['admin', 'dev', 'developer', 'promoter'] as const,
  },
]

interface AppSidebarProps {
  userRole: 'admin' | 'dev' | 'developer' | 'promoter' | null
}

export function AppSidebar({ userRole }: AppSidebarProps) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  // Filter menu items based on user role
  const menuItems = allMenuItems.filter(item => 
    !userRole || (item.roles as readonly string[]).includes(userRole)
  )

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={`border-b border-gray-200 h-16 flex items-center shrink-0 ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}>
        <div className={`flex items-center gap-3 w-full ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-transparent">
            <Image
              src="/assets/app/app-icon.png"
              alt="Shamelesss"
              width={32}
              height={32}
              className="object-contain"
              priority
              unoptimized
            />
          </div>
          {!isCollapsed && (
            <div className="flex flex-1 items-center text-left leading-tight min-w-0">
              <span className="truncate font-semibold text-lg">Shamelesss</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="flex-1 overflow-y-auto">
        <SidebarGroup className="px-2 py-2">
          <SidebarGroupLabel className="px-2 mb-1">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.url || (item.url !== '/home' && pathname?.startsWith(item.url))
                
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.url} className={`flex items-center w-full ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
                        <Icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span className="truncate flex-1">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className={`border-t border-gray-200 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <div className="flex justify-center w-full">
          <SignOutButton iconOnly={isCollapsed} />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

