'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppSidebar } from './app-sidebar'

export function SidebarContent() {
  const [userRole, setUserRole] = useState<'admin' | 'dev' | 'developer' | 'promoter' | 'user' | 'demo' | null>(null)
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
          setUserRole(roleData.role as 'admin' | 'dev' | 'developer' | 'promoter' | 'user' | 'demo')
        }
      }
    }
    fetchUserRole()
  }, [supabase])

  return <AppSidebar userRole={userRole} />
}

