import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/user-roles'
import { getQuizScreens, getConversionScreens } from '@/lib/database/onboarding'
import OnboardingManager from '@/components/onboarding-manager'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const userRole = await getUserRole(user.id)
  const allowedRoles = ['admin', 'dev', 'developer']
  if (!userRole || !allowedRoles.includes(userRole)) {
    redirect('/home')
  }

  const quizScreens = await getQuizScreens()
  const conversionScreens = await getConversionScreens()

  return (
    <div className="h-[calc(100vh-4rem)] w-full bg-white overflow-hidden">
      <OnboardingManager
        initialQuizScreens={quizScreens}
        initialConversionScreens={conversionScreens}
      />
    </div>
  )
}


