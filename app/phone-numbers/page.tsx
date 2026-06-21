import { Suspense } from 'react'
import PhoneNumbersPageContent from '@/components/phone-numbers-page-content'
import { requirePhoneNumbersPage } from '@/lib/auth/panel-access'

export default async function PhoneNumbersPage() {
  const { user, isPhoneAdmin } = await requirePhoneNumbersPage()

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
        <PhoneNumbersPageContent isPhoneAdmin={isPhoneAdmin} currentUserId={user.id} />
      </Suspense>
    </div>
  )
}
