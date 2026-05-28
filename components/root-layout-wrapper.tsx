'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { SidebarProvider, SidebarInset } from './ui/sidebar'
import { BreadcrumbWrapper } from './breadcrumb-wrapper'
import { SidebarContent } from './sidebar-content'
import { Toaster } from './ui/toaster'
import { AppDialogsProvider } from './app-dialogs-provider'
import { cn } from '@/lib/utils'

function isFullHeightAppRoute(pathname: string | null): boolean {
  return (
    pathname?.startsWith('/support-chat') === true ||
    pathname?.startsWith('/creator-crm') === true
  )
}

export function RootLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const fullHeightApp = isFullHeightAppRoute(pathname)

  // Don't show sidebar on sign-in page
  if (pathname === '/') {
    return (
      <AppDialogsProvider>
        <Toaster />
        {children}
      </AppDialogsProvider>
    )
  }

  return (
    <AppDialogsProvider>
      <Toaster />
      <SidebarProvider>
        <SidebarContent />
        <SidebarInset
          className={cn(
            fullHeightApp && 'h-svh max-h-svh min-h-0 overflow-hidden'
          )}
        >
          <Suspense fallback={<header className="h-16 shrink-0 border-b border-gray-200 bg-white" />}>
            <BreadcrumbWrapper />
          </Suspense>
          <div
            className={
              fullHeightApp
                ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden'
                : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto'
            }
          >
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AppDialogsProvider>
  )
}

