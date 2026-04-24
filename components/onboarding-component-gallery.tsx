'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { OnboardingScreenPreview } from '@/components/onboarding-screen-preview'
import { Button } from '@/components/ui/button'
import type { QuizScreen } from '@/types/onboarding'

type FunnelType = 'quiz' | 'conversion'

interface OnboardingComponentFromApi {
  id: string
  component_key: string
  component_name: string
  categories: ('quiz' | 'conversion')[]
  description: string | null
}

const GALLERY_WIDTH = '16rem'
const GALLERY_COLLAPSED_WIDTH = '2.5rem'

/** Same as flowchart (onboarding-manager ScreenNode) */
const FLOWCHART_PHONE_SCREEN_WIDTH = 200
const FLOWCHART_PHONE_SCREEN_HEIGHT = 400
const FLOWCHART_PHONE_PADDING = 8
const FLOWCHART_PHONE_FRAME_WIDTH = FLOWCHART_PHONE_SCREEN_WIDTH + FLOWCHART_PHONE_PADDING * 2
const FLOWCHART_PHONE_FRAME_HEIGHT = FLOWCHART_PHONE_SCREEN_HEIGHT + FLOWCHART_PHONE_PADDING * 2

/** Scale down for gallery so mockup is 1:1 with flowchart, then scaled equally */
const GALLERY_PHONE_SCALE = 0.5
const GALLERY_PHONE_DISPLAY_WIDTH = Math.round(FLOWCHART_PHONE_FRAME_WIDTH * GALLERY_PHONE_SCALE)
const GALLERY_PHONE_DISPLAY_HEIGHT = Math.round(FLOWCHART_PHONE_FRAME_HEIGHT * GALLERY_PHONE_SCALE)

/** Stub screen for gallery preview (quiz style - minimal fields) */
function stubScreen(component_id: string, title: string, options: Record<string, unknown> = {}): QuizScreen {
  return {
    id: `gallery-${component_id}`,
    title,
    description: 'Sample description',
    options: Object.keys(options).length ? options : null,
    order_position: 0,
    should_show: true,
    created_at: null,
    event_name: null,
    component_id,
  }
}

/** Minimal options for components that need them so the preview isn't empty */
const SAMPLE_OPTIONS: Record<string, Record<string, unknown>> = {
  options: {
    options: [
      { id: '1', label: 'Option A', value: 'a' },
      { id: '2', label: 'Option B', value: 'b' },
    ],
  },
  instant_radio: {
    options: [
      { id: 'ig', label: 'Instagram', value: 'instagram', icon: 'instagram' },
      { id: 'tk', label: 'TikTok', value: 'tiktok', icon: 'tiktok' },
    ],
  },
  frequency_slider: { stepLabels: ['1x', '2x', '3x', '4x', '5x'] },
  satisfaction_slider: {
    stepLabels: ['Awful', 'Okay', 'Good', 'Amazing'],
    markerLabels: ['😡', '😐', '🙂', '🤩'],
  },
  testimonial_loader: {
    reviews: [
      { author: 'User 1', text: 'Great app!' },
      { author: 'User 2', text: 'Love it.' },
    ],
  },
  rate_app_blurred: { final_reviews: [] },
  rate_app_default: { final_reviews: [] },
  rate_app_stars: {},
  quiz_results: {},
  profile_image: {
    skipable: true,
    testimonial_avatars: [
      'https://i.pravatar.cc/100?img=12',
      'https://i.pravatar.cc/100?img=33',
      'https://i.pravatar.cc/100?img=47',
    ],
  },
  data_consents: {
    consents: [
      {
        id: 'privacy',
        title: 'Privacy & data use',
        description: 'How we use your data.',
        required: true,
        learn_more: { label: 'Learn more', url: 'https://example.com/privacy' },
      },
      {
        id: 'marketing',
        title: 'Marketing',
        description: 'Optional updates.',
        required: false,
      },
    ],
    accept_all_label: 'Accept All',
    next_button_label: 'Next',
  },
}


/**
 * Renders the same phone mockup as the flowchart (1:1) then scales it down
 * so every element (fonts, padding, borders) matches the flowchart.
 */
function GalleryPhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="shrink-0 mx-auto overflow-hidden"
      style={{
        width: GALLERY_PHONE_DISPLAY_WIDTH,
        height: GALLERY_PHONE_DISPLAY_HEIGHT,
      }}
    >
      <div
        className="bg-black rounded-[2.5rem] p-2 shadow-2xl"
        style={{
          width: FLOWCHART_PHONE_FRAME_WIDTH,
          height: FLOWCHART_PHONE_FRAME_HEIGHT,
          transform: `scale(${GALLERY_PHONE_SCALE})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Screen — same structure as onboarding-manager ScreenNode */}
        <div
          className="bg-white rounded-[2rem] overflow-hidden relative"
          style={{
            width: FLOWCHART_PHONE_SCREEN_WIDTH,
            height: FLOWCHART_PHONE_SCREEN_HEIGHT,
          }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-[1.75rem] z-10" />
          <div className="absolute top-0 left-0 right-0 h-8 bg-white flex items-center justify-between px-3 pt-1 z-20">
            <span className="text-[10px] font-semibold text-black ml-2">9:41</span>
            <div className="flex items-center gap-1.5 mr-2">
              <div className="flex items-end gap-0.5 h-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-0.5 bg-black rounded-sm" style={{ height: `${2 + i * 2}px` }} />
                ))}
              </div>
              <div className="relative w-4 h-2 border border-black rounded-[2px] overflow-hidden">
                <div className="absolute left-0.5 top-0.5 bottom-0.5 w-[70%] bg-black rounded-[1px]" />
              </div>
            </div>
          </div>
          <div className="w-full h-full overflow-hidden">
            {children}
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-black rounded-full" />
        </div>
      </div>
    </div>
  )
}

interface OnboardingComponentGalleryProps {
  /** Controlled: panel collapsed state */
  collapsed?: boolean
  /** Controlled: called when user collapses/expands */
  onCollapsedChange?: (collapsed: boolean) => void
  /** Uncontrolled: initial collapsed state (default true = closed on load) */
  defaultCollapsed?: boolean
}

export function OnboardingComponentGallery({
  collapsed: controlledCollapsed,
  onCollapsedChange,
  defaultCollapsed = true,
}: OnboardingComponentGalleryProps = {}) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed)
  const isControlled = controlledCollapsed !== undefined
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed
  const setCollapsed = (value: boolean) => {
    if (isControlled) {
      onCollapsedChange?.(value)
    } else {
      setInternalCollapsed(value)
    }
  }
  const [funnelType, setFunnelType] = useState<FunnelType>('quiz')
  const [components, setComponents] = useState<OnboardingComponentFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/onboarding/components?category=${funnelType}&fallback=false`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((data: { components?: OnboardingComponentFromApi[] }) => {
        if (!cancelled) {
          setComponents(data.components ?? [])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load components')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [funnelType])

  const items = useMemo(() => {
    return components.map((c) => {
      const component_id = c.component_key
      const name = c.component_name ?? component_id
      const description = c.description ?? ''
      const sampleOptions = SAMPLE_OPTIONS[component_id]
      const screen = stubScreen(component_id, name, sampleOptions ?? {})
      return { component_id, name, description, screen }
    })
  }, [components])

  return (
    <aside
      className="flex h-full flex-col border-l border-gray-200 bg-white shrink-0 transition-[width] duration-200 ease-out overflow-hidden"
      style={{ width: collapsed ? GALLERY_COLLAPSED_WIDTH : GALLERY_WIDTH }}
    >
      {/* Header: title + funnel toggle + collapse */}
      <div className="p-3 border-b border-gray-200 shrink-0 flex flex-col gap-2">
        {!collapsed && (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 truncate">Screen Components</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  All possible onboarding components
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setCollapsed(true)}
                title="Collapse panel"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {/* Quiz vs Conversion funnel toggle */}
            <div className="flex rounded-md border border-gray-200 p-0.5 bg-gray-100/80">
              <button
                type="button"
                onClick={() => setFunnelType('quiz')}
                className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                  funnelType === 'quiz'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Quiz
              </button>
              <button
                type="button"
                onClick={() => setFunnelType('conversion')}
                className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                  funnelType === 'conversion'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Conversion
              </button>
            </div>
          </>
        )}
        {collapsed && (
          <div className="flex flex-col items-center w-full py-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCollapsed(false)}
              title="Expand Screen Components panel"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            </div>
          )}
          {error && (
            <p className="text-xs text-red-600 py-2">{error}</p>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="text-xs text-gray-500 py-2">
              No components in <span className="font-medium">{funnelType}</span> in onboarding_components.
            </p>
          )}
          {!loading && !error && items.map(({ component_id, name, description, screen }) => (
            <div
              key={component_id}
              className="rounded-lg border border-gray-200 bg-gray-50/50 p-2 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900 leading-tight">
                    {name}
                  </div>
                  {description ? (
                    <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 leading-tight">
                      {description}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  title={`Add ${name} to ${funnelType} funnel`}
                  onClick={() => {
                    const handlers = (window as any).onboardingAddHandlers
                    if (handlers?.addScreenWithComponent) {
                      handlers.addScreenWithComponent(component_id, funnelType)
                    }
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <GalleryPhoneFrame>
                <OnboardingScreenPreview screen={screen} totalScreens={1} />
              </GalleryPhoneFrame>
            </div>
          ))}
          {/* Auth screen (flow node, not in COMPONENT_DISPLAY) */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-2 shadow-sm">
            <div className="mb-2">
              <div className="text-xs font-semibold text-gray-900 leading-tight">
                Authentication Screen
              </div>
              <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 leading-tight">
                Login / Register — Create Account, Continue with E-Mail, Skip, Sign in link.
              </p>
            </div>
            <GalleryPhoneFrame>
              {/* Same auth content as onboarding-manager AuthNode: title at top, buttons + link at bottom */}
              <div
                className="bg-white overflow-hidden flex flex-col"
                style={{
                  position: 'absolute',
                  top: 40,
                  left: 0,
                  right: 0,
                  bottom: 24,
                  paddingLeft: 12,
                  paddingRight: 12,
                }}
              >
                <div
                  className="font-black text-black flex-shrink-0"
                  style={{
                    fontSize: 22,
                    letterSpacing: -1.1,
                    lineHeight: '1.25rem',
                    color: '#000000',
                  }}
                >
                  <div style={{ display: 'block' }}>Create</div>
                  <div style={{ display: 'block' }}>Account</div>
                </div>
                <div className="flex-1 min-h-0" />
                <div className="flex-shrink-0 flex flex-col pt-2">
                  <div
                    className="w-full rounded-[30px] border-2 border-black flex items-center justify-center mb-2"
                    style={{
                      backgroundColor: '#FF5252',
                      padding: 8,
                      boxShadow: '0 2px 0 0 #000000',
                      minHeight: 36,
                    }}
                  >
                    <span className="font-black text-center" style={{ fontSize: 12, color: '#000000' }}>
                      Continue with E-Mail
                    </span>
                  </div>
                  <div
                    className="w-full rounded-[30px] border-2 border-black flex items-center justify-center mb-3"
                    style={{
                      backgroundColor: '#FFFFFF',
                      padding: 8,
                      boxShadow: '0 2px 0 0 #000000',
                      minHeight: 36,
                    }}
                  >
                    <span className="font-black text-center" style={{ fontSize: 12, color: '#000000' }}>
                      Skip
                    </span>
                  </div>
                  <span
                    className="block text-center"
                    style={{ fontSize: 11, color: '#FF5252' }}
                  >
                    Already have an account? Sign in
                  </span>
                </div>
              </div>
            </GalleryPhoneFrame>
          </div>
        </div>
      )}
    </aside>
  )
}
