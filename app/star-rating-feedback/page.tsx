import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/user-roles'
import StarRatingFeedbackManager from '@/components/star-rating-feedback-manager'

export default async function StarRatingFeedbackPage() {
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
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Star Rating Feedback
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            In-app star ratings and optional feedback from the rate flow
          </p>
        </div>

        <StarRatingFeedbackManager />
      </div>
    </div>
  )
}
