import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/user-roles'
import SupportChat from '@/components/support-chat'

export default async function SupportChatPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const role = await getUserRole(user.id)
  if (role !== 'admin' && role !== 'dev' && role !== 'developer') {
    redirect('/home')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 px-4 pb-4 pt-4 sm:px-6">
      <SupportChat />
    </div>
  )
}
