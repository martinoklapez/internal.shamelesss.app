import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/user-roles'

export async function requireCreatorCrmPage(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const userRole = await getUserRole(user.id)
  if (userRole !== 'admin' && userRole !== 'dev' && userRole !== 'developer') {
    redirect('/home')
  }
}
