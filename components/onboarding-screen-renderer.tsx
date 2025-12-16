'use client'

/**
 * Onboarding Screen Renderer
 * 
 * This component renders actual React Native screens on the web.
 * 
 * To use:
 * 1. Get screen components from mobile app team
 * 2. Import them here
 * 3. Map component_id to component
 * 4. Pass options as props
 */

import type { QuizScreen, ConversionScreen } from '@/types/onboarding'

interface OnboardingScreenRendererProps {
  screen: QuizScreen | ConversionScreen
  options?: any // JSONB options from database
}

// TODO: Import actual screen components from mobile app
// Example:
// import AgeStagingScreen from '@/screens/onboarding/AgeStagingScreen'
// import RelationshipStatusScreen from '@/screens/onboarding/RelationshipStatusScreen'

const SCREEN_COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  // Map component_id to actual React Native component
  // Example:
  // 'age_staging': AgeStagingScreen,
  // 'relationship_status': RelationshipStatusScreen,
}

export function OnboardingScreenRenderer({ screen, options = {} }: OnboardingScreenRendererProps) {
  const Component = screen.component_id ? SCREEN_COMPONENT_MAP[screen.component_id] : null

  if (!Component) {
    // Fallback: Show placeholder if component not found
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center p-4">
          <p className="text-sm text-gray-600 mb-2">Screen Preview</p>
          <p className="text-xs text-gray-500">
            Component: {screen.component_id || 'Not set'}
          </p>
          {screen.title && (
            <p className="text-sm font-medium text-gray-900 mt-2">{screen.title}</p>
          )}
        </div>
      </div>
    )
  }

  // Render actual screen component with options as props
  return (
    <div className="w-full h-full bg-white rounded-lg overflow-hidden">
      <Component {...options} />
    </div>
  )
}

