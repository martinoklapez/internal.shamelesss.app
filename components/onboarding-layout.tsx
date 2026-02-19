'use client'

import { useState } from 'react'
import OnboardingManager from '@/components/onboarding-manager'
import { OnboardingComponentGallery } from '@/components/onboarding-component-gallery'
import type { QuizScreen, ConversionScreen } from '@/types/onboarding'

interface OnboardingLayoutProps {
  initialQuizScreens: QuizScreen[]
  initialConversionScreens: ConversionScreen[]
}

export function OnboardingLayout({
  initialQuizScreens,
  initialConversionScreens,
}: OnboardingLayoutProps) {
  const [galleryCollapsed, setGalleryCollapsed] = useState(true)

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-white">
      <div className="flex-1 min-w-0 overflow-hidden">
        <OnboardingManager
          initialQuizScreens={initialQuizScreens}
          initialConversionScreens={initialConversionScreens}
          onAddScreenClick={() => setGalleryCollapsed(false)}
        />
      </div>
      <OnboardingComponentGallery
        collapsed={galleryCollapsed}
        onCollapsedChange={setGalleryCollapsed}
      />
    </div>
  )
}
