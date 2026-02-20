'use client'

import { Suspense } from 'react'
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
        <Suspense fallback={<header className="h-16 shrink-0 border-b border-gray-200 bg-white" />}>
          <BreadcrumbWrapper />
        </Suspense>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

