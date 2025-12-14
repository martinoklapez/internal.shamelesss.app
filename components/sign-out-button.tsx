'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

interface SignOutButtonProps {
  iconOnly?: boolean
}

export default function SignOutButton({ iconOnly = false }: SignOutButtonProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <Button 
      onClick={handleSignOut} 
      variant="outline" 
      className={iconOnly ? "w-full aspect-square" : "w-full"}
      size={iconOnly ? "icon" : "default"}
    >
      <LogOut className="h-4 w-4" />
      {!iconOnly && <span className="ml-2">Sign Out</span>}
    </Button>
  )
}

