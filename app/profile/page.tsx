import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileEditor from '@/components/profile-editor'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Fetch current profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, profile_picture_url')
    .eq('user_id', user.id)
    .single()

  // Get user email from auth
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const email = authUser?.email || ''

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Profile Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Update your profile information
          </p>
        </div>

        <ProfileEditor
          initialName={profile?.name || null}
          initialProfilePictureUrl={profile?.profile_picture_url || null}
          email={email}
        />
      </div>
    </div>
  )
}

