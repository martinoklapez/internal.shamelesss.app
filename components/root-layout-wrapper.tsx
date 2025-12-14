'use client'

import { usePathname } from 'next/navigation'
import { SidebarProvider, SidebarInset } from './ui/sidebar'
import { BreadcrumbWrapper } from './breadcrumb-wrapper'
import { SidebarContent } from './sidebar-content'

export function RootLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Don't show sidebar on sign-in page
  if (pathname === '/') {
    return <>{children}</>
  }
  
  return (
    <SidebarProvider>
      <SidebarContent />
      <SidebarInset>
        <BreadcrumbWrapper />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

