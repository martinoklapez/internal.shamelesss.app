'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { QuizScreen, ConversionScreen } from '@/types/onboarding'
import { SiInstagram, SiTiktok, SiReddit, SiYoutube, SiX, SiFacebook, SiAppstore } from 'react-icons/si'
import { Globe, Heart, Info, Upload } from 'lucide-react'
import type { IconType } from 'react-icons'

interface ScreenPreviewProps {
  screen: QuizScreen | ConversionScreen
  totalScreens?: number
}

export function OnboardingScreenPreview({ screen, totalScreens }: ScreenPreviewProps) {
  // All hooks must be at top level (required by React Hooks rules)
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const [selectedAge, setSelectedAge] = useState<number | null>(null)
  const [sliderStepValue, setSliderStepValue] = useState<number>(3)
  const [selectedInstantRadio, setSelectedInstantRadio] = useState<string | null>(null)
  const [nameInputValue, setNameInputValue] = useState<string>('')
  const [usernameInputValue, setUsernameInputValue] = useState<string>('')
  const [profileImageSelected, setProfileImageSelected] = useState<boolean>(false)
  const [rateAppCountdown, setRateAppCountdown] = useState<number | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [rateAppStarsSelected, setRateAppStarsSelected] = useState<number>(0)
  const [rateAppStarsFeedbackOpen, setRateAppStarsFeedbackOpen] = useState(false)
  const [rateAppStarsFeedbackText, setRateAppStarsFeedbackText] = useState('')
  const [scratchComplete, setScratchComplete] = useState(false)

  const scratchCanvasRef = useRef<HTMLCanvasElement>(null)
  const scratchTriggeredRef = useRef(false)
  const scratchIsDrawingRef = useRef(false)

  // Testimonial loader hooks (always declared, conditionally used)
  const [testimonialProgress, setTestimonialProgress] = useState(0)
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0)
  const testimonialProgressRef = useRef<number>(0)
  const testimonialAnimationRef = useRef<number>()
  
  const componentId = screen.component_id
  const options = useMemo(() => screen.options || {}, [screen.options])
  const title = screen.title || ''
  const description = screen.description || ''
  
  // Helper to get options array - handles both direct array and nested options.options
  const getOptionsArray = (): Array<{ label: string; value: string; id?: string; icon?: string }> => {
    // If options is directly an array, use it
    if (Array.isArray(options)) {
      return options
    }
    // If options is an object with an 'options' property that's an array, use that
    if (options && typeof options === 'object' && 'options' in options && Array.isArray(options.options)) {
      return options.options
    }
    // Otherwise return empty array (no fallback sample data)
    return []
  }
  
  // Testimonial Loader - useEffect hooks (must be before any early returns)
  useEffect(() => {
    if (componentId !== 'testimonial_loader') return

    const CIRCLE_RADIUS = 70
    const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS // ~439.82
    const startTime = Date.now()
    const duration = 6000

    const animate = () => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min(elapsed / duration, 1)
      testimonialProgressRef.current = newProgress
      setTestimonialProgress(newProgress)

      if (newProgress < 1) {
        testimonialAnimationRef.current = requestAnimationFrame(animate)
      }
    }

    testimonialAnimationRef.current = requestAnimationFrame(animate)

    return () => {
      if (testimonialAnimationRef.current) {
        cancelAnimationFrame(testimonialAnimationRef.current)
      }
    }
  }, [componentId])

  // Carousel rotation effect
  useEffect(() => {
    if (componentId !== 'testimonial_loader') return
    
    // Get reviews from options - handle both options.reviews and direct reviews array
    const reviews = (() => {
      if (Array.isArray(options)) {
        return []
      }
      if (options && typeof options === 'object' && 'reviews' in options && Array.isArray(options.reviews)) {
        return options.reviews
      }
      return []
    })()

    if (reviews.length <= 1) return

    const interval = setInterval(() => {
      setCurrentReviewIndex((prev) => (prev + 1) % reviews.length)
    }, 1500)

    return () => clearInterval(interval)
  }, [componentId, options])

  // Rate app blurred: countdown 4→3→2→1→0 then hide overlay
  useEffect(() => {
    if (componentId !== 'rate_app_blurred') return
    setRateAppCountdown(4)
    const t = setInterval(() => {
      setRateAppCountdown((c) => (c === null ? null : c <= 0 ? null : c - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [componentId])

  // ScratchDates: reset state when leaving and draw initial red overlay when entering
  useEffect(() => {
    if (componentId !== 'scratchdates_preview') {
      setScratchComplete(false)
      scratchTriggeredRef.current = false
      return
    }
    scratchTriggeredRef.current = false
    setScratchComplete(false)
    const t = requestAnimationFrame(() => {
      const canvas = scratchCanvasRef.current
      if (!canvas) return
      const d = 150
      canvas.width = d
      canvas.height = d
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#FF5252'
      ctx.fillRect(0, 0, d, d)
    })
    return () => cancelAnimationFrame(t)
  }, [componentId])

  // Loading screen: progress bar 0→100% over 4.8s; active step derived from progress (0–25% step 0, 25–50% step 1, …)
  useEffect(() => {
    if (componentId !== 'loading') return
    setLoadingProgress(0)
    const start = Date.now()
    const PROGRESS_DURATION = 4800
    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.min(100, (elapsed / PROGRESS_DURATION) * 100)
      setLoadingProgress(pct)
      if (pct < 100) requestAnimationFrame(tick)
    }
    const id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [componentId])
  
  // Calculate progress percentage based on order_position
  const calculateProgress = () => {
    if (!totalScreens || totalScreens === 0) return 0
    const orderPosition = screen.order_position ?? 0
    // Handle order_position: if it's 0 or null, treat as first screen (1)
    // Progress formula: (position / totalScreens) * 100
    // For 1-based positions: position 1 of 5 = 20%, position 5 of 5 = 100%
    // For 0-based positions: position 0 of 5 = 0%, position 4 of 5 = 80%
    // We'll assume 1-based, but handle 0 by treating it as 1
    const actualPosition = orderPosition === 0 ? 1 : orderPosition
    const progress = Math.min((actualPosition / totalScreens) * 100, 100)
    return Math.max(progress, 0) // Ensure it's at least 0%
  }
  
  const progressPercentage = calculateProgress()

  // Loading Screen
  // Loading (Onboarding + Conversion)
  if (componentId === 'loading') {
    const LOADING_STEPS = [
      'Analyzing your preferences...',
      'Calculating personalized recommendations...',
      'Optimizing your experience...',
      'Preparing your custom journey...',
    ]
    // Active step tied to progress bar: 0–25% step 0, 25–50% step 1, 50–75% step 2, 75–100% step 3
    const activeStep = Math.min(3, Math.floor(loadingProgress / 25))
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>
        <div className="px-3 pb-0 flex-shrink-0">
          {title ? (
            <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">{title}</h3>
          ) : (
            <h3 className="text-lg font-black text-gray-400 mb-2 leading-5 tracking-tight text-left italic">No title</h3>
          )}
          {description ? (
            <p className="text-xs text-black opacity-90 leading-4 mb-3 text-left">{description}</p>
          ) : (
            <p className="text-xs text-gray-400 opacity-60 leading-4 mb-3 text-left italic">No description</p>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-3 min-h-0 overflow-y-auto" style={{ marginTop: 16 }}>
          {/* Loading bar: fills 0→100% over ~4.8s */}
          <div
            className="w-[80%] rounded-[2px] overflow-hidden flex-shrink-0"
            style={{
              height: 4,
              backgroundColor: '#F6F6F6',
              marginBottom: 16,
            }}
          >
            <div
              className="h-full rounded-[2px]"
              style={{
                width: `${loadingProgress}%`,
                backgroundColor: '#FF5252',
              }}
            />
          </div>
          {/* Four step rows: each bolds in turn as the bar fills (0–25% → step 0, 25–50% → step 1, …) */}
          <div
            className="w-full flex flex-col items-center flex-shrink-0"
            style={{ gap: 10 }}
          >
            {LOADING_STEPS.map((text, i) => {
              const isCompleted = i < activeStep
              const isActive = i === activeStep
              return (
                <p
                  key={i}
                  className="text-center w-full flex-shrink-0 whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{
                    fontSize: 10,
                    lineHeight: 1.3,
                    color: '#000000',
                    opacity: isCompleted ? 0.8 : isActive ? 1 : 0.9,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {text}
                </p>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Options (Radio Group)
  if (componentId === 'options') {
    const radioOptions = getOptionsArray()
    
    // Helper to capitalize first letter and lowercase rest
    const formatLabel = (text: string) => {
      if (!text) return ''
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
    }

    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        {/* Progress Bar */}
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }}></div>
          </div>
        </div>

        {/* Header */}
        <div className="px-3 pb-0 flex-shrink-0">
          {title ? (
            <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">
              {title}
            </h3>
          ) : (
            <h3 className="text-lg font-black text-gray-400 mb-2 leading-5 tracking-tight text-left italic">
              No title
            </h3>
          )}
          {description ? (
            <p className="text-xs text-black opacity-90 leading-4 mb-3 text-left">
              {description}
            </p>
          ) : (
            <p className="text-xs text-gray-400 opacity-60 leading-4 mb-3 text-left italic">
              No description
            </p>
          )}
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 px-3 pb-2 overflow-y-auto min-h-0">
          <div className="flex flex-col gap-2 w-full">
            {radioOptions.map((option: any, index: number) => {
              const isSelected = selectedValue === (option.value || option.id)
              const optionLabel = formatLabel(option.label || option.value || `Option ${index + 1}`)
              
              return (
                <button
                  key={option.id || index}
                  onClick={() => setSelectedValue(option.value || option.id)}
                  type="button"
                  className={`
                    w-full rounded-[30px] border-[2px] border-black
                    flex items-center justify-center
                    transition-all duration-200 ease-in-out
                    ${isSelected ? 'bg-[#FF5252]' : 'bg-white'}
                  `}
                  style={{
                    transform: isSelected ? 'translateY(0)' : 'translateY(2px)',
                    boxShadow: isSelected ? '0 2px 0 0 #000000' : 'none',
                    padding: '8px',
                  }}
                >
                  <div className="flex items-center gap-2 justify-center w-full">
                    {/* Icon/Emoji (optional) - show directly, not in wrapper */}
                    {option.icon && (
                      <span className="text-base shrink-0">
                        {option.icon}
                      </span>
                    )}
                    {/* Option Label */}
                    <span 
                      className={`
                        text-black text-center text-sm leading-4 tracking-tight
                        ${isSelected ? 'font-black' : 'font-bold'}
                      `}
                      style={{
                        fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                      }}
                    >
                      {optionLabel}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Button Container - Fixed at bottom */}
        {selectedValue && (
          <div className="px-3 py-2 flex-shrink-0">
            <button 
              type="button"
              className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity"
            >
              Next
            </button>
          </div>
        )}
      </div>
    )
  }

  // Instant Radio (Onboarding + Conversion) – icon + label per row, no Next (selection auto-advances)
  if (componentId === 'instant_radio') {
    const radioOptions = getOptionsArray()
    const formatLabel = (text: string) => {
      if (!text) return ''
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
    }
    const getSocialIcon = (id: string): { Icon: IconType | typeof Globe | typeof Heart | typeof Info; color: string } => {
      const key = (id || '').toLowerCase().replace(/-/g, '_')
      const brandMap: Record<string, { Icon: IconType; color: string }> = {
        instagram: { Icon: SiInstagram, color: '#E1306C' },
        tiktok: { Icon: SiTiktok, color: '#000000' },
        reddit: { Icon: SiReddit, color: '#FF4500' },
        youtube: { Icon: SiYoutube, color: '#FF0000' },
        x: { Icon: SiX, color: '#000000' },
        twitter: { Icon: SiX, color: '#000000' },
        facebook: { Icon: SiFacebook, color: '#1877F2' },
        'facebook-f': { Icon: SiFacebook, color: '#1877F2' },
        app_store: { Icon: SiAppstore, color: '#007AFF' },
        appstore: { Icon: SiAppstore, color: '#007AFF' },
        'app-store-ios': { Icon: SiAppstore, color: '#007AFF' },
      }
      const brand = brandMap[key]
      if (brand) return brand
      if (key === 'website' || key === 'globe') return { Icon: Globe, color: '#0F172A' }
      if (key === 'partner_ref' || key === 'gf' || key === 'bf') return { Icon: Heart, color: '#FF5252' }
      return { Icon: Info, color: '#64748B' }
    }
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>
        <div className="px-3 pb-0 flex-shrink-0">
          {title ? (
            <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">{title}</h3>
          ) : (
            <h3 className="text-lg font-black text-gray-400 mb-2 leading-5 tracking-tight text-left italic">No title</h3>
          )}
          {description ? (
            <p className="text-xs text-black opacity-90 leading-4 mb-3 text-left">{description}</p>
          ) : (
            <p className="text-xs text-gray-400 opacity-60 leading-4 mb-3 text-left italic">No description</p>
          )}
        </div>
        <div className="flex-1 px-3 pb-2 overflow-y-auto min-h-0">
          <div className="flex flex-col w-full" style={{ gap: 8 }}>
            {radioOptions.map((option: { id?: string; value?: string; label?: string }, index: number) => {
              const optionId = option.id ?? option.value ?? ''
              const isSelected = selectedInstantRadio === optionId
              const label = formatLabel(option.label || option.value || `Option ${index + 1}`)
              const { Icon, color } = getSocialIcon(optionId)
              return (
                <button
                  key={option.id ?? option.value ?? index}
                  type="button"
                  onClick={() => setSelectedInstantRadio(optionId)}
                  className="w-full rounded-[30px] flex items-center text-left transition-all duration-200"
                  style={{
                    padding: '10px 12px',
                    backgroundColor: isSelected ? '#F5F5F5' : '#F5F5F5',
                    borderWidth: isSelected ? 2 : 0,
                    borderStyle: 'solid',
                    borderColor: isSelected ? '#000000' : 'transparent',
                    boxShadow: isSelected ? '0 2px 6px rgba(0, 0, 0, 0.12)' : 'none',
                  }}
                >
                  <div
                    className="flex-shrink-0 rounded-full bg-white flex items-center justify-center border-0"
                    style={{
                      width: 28,
                      height: 28,
                      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
                      color,
                    }}
                  >
                    <Icon size={14} style={{ flexShrink: 0 }} />
                  </div>
                  <span
                    className="flex-1"
                    style={{
                      marginLeft: 8,
                      fontSize: 14,
                      fontWeight: isSelected ? 600 : 400,
                      color: '#000000',
                    }}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Name Input (Onboarding + Conversion)
  if (componentId === 'name_input') {
    const isNameValid = nameInputValue.trim().length >= 2
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>
        <div className="px-3 pb-0 flex-shrink-0">
          {title ? (
            <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">{title}</h3>
          ) : (
            <h3 className="text-lg font-black text-gray-400 mb-2 leading-5 tracking-tight text-left italic">No title</h3>
          )}
          {description ? (
            <p className="text-xs text-black opacity-90 leading-4 mb-3 text-left">{description}</p>
          ) : (
            <p className="text-xs text-gray-400 opacity-60 leading-4 mb-3 text-left italic">No description</p>
          )}
        </div>
        <div className="flex-1 px-3 pb-2 flex flex-col min-h-0" style={{ gap: 8 }}>
          <label className="text-black text-left" style={{ color: '#000000' }}>
            Name
          </label>
          <input
            type="text"
            value={nameInputValue}
            onChange={(e) => setNameInputValue(e.target.value)}
            placeholder={typeof options.placeholder === 'string' ? options.placeholder : 'Enter your name'}
            className="w-full rounded-[30px] border-0 focus:border-2 focus:border-black focus:outline-none placeholder:text-[#666666]"
            style={{
              padding: '10px 14px',
              backgroundColor: '#F5F5F5',
              color: '#000000',
              fontSize: 14,
              fontWeight: 400,
            }}
            autoCapitalize="words"
          />
        </div>
        <div className="px-3 py-2 flex-shrink-0">
          <button
            type="button"
            className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: isNameValid ? '0 4px 0 #000' : 'none' }}
            disabled={!isNameValid}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // Username Input (Onboarding + Conversion)
  if (componentId === 'username_input') {
    const trimmed = usernameInputValue.trim()
    const isUsernameValid = trimmed.length >= 3 && /^[a-zA-Z0-9_]+$/.test(trimmed)
    const showInlineError = usernameInputValue.length > 0 && !isUsernameValid
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>
        <div className="px-3 pb-0 flex-shrink-0">
          {title ? (
            <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">{title}</h3>
          ) : (
            <h3 className="text-lg font-black text-gray-400 mb-2 leading-5 tracking-tight text-left italic">No title</h3>
          )}
          {description ? (
            <p className="text-xs text-black opacity-90 leading-4 mb-3 text-left">{description}</p>
          ) : (
            <p className="text-xs text-gray-400 opacity-60 leading-4 mb-3 text-left italic">No description</p>
          )}
        </div>
        <div className="flex-1 px-3 pb-2 flex flex-col min-h-0" style={{ gap: 8 }}>
          <label className="text-black text-left" style={{ color: '#000000' }}>
            Username
          </label>
          <input
            type="text"
            value={usernameInputValue}
            onChange={(e) => setUsernameInputValue(e.target.value)}
            placeholder={typeof options.placeholder === 'string' ? options.placeholder : 'Enter your username'}
            className="w-full rounded-[30px] border-0 focus:border-2 focus:border-black focus:outline-none placeholder:text-[#666666]"
            style={{
              padding: '10px 14px',
              backgroundColor: '#F5F5F5',
              color: '#000000',
              fontSize: 14,
              fontWeight: 400,
            }}
            autoCapitalize="none"
          />
          {showInlineError && (
            <p
              className="text-left"
              style={{ fontSize: 14, marginTop: 8, color: '#FCA5A5' }}
            >
              Username must be at least 3 characters and contain only letters, numbers, and underscores.
            </p>
          )}
        </div>
        <div className="px-3 py-2 flex-shrink-0">
          <button
            type="button"
            className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: isUsernameValid ? '0 4px 0 #000' : 'none' }}
            disabled={!isUsernameValid}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // Age Input
  if (componentId === 'age_input') {
    return (
      <div className="w-full h-full flex flex-col bg-white pt-8">
        {title ? (
          <h3 className="text-sm font-bold text-gray-900 mb-1 mt-2 px-3 text-left">{title}</h3>
        ) : (
          <h3 className="text-sm font-bold text-gray-400 mb-1 mt-2 px-3 text-left italic">No title</h3>
        )}
        {description ? (
          <p className="text-xs text-gray-600 mb-3 px-3 text-left">{description}</p>
        ) : (
          <p className="text-xs text-gray-400 opacity-60 mb-3 px-3 text-left italic">No description</p>
        )}
        <div className="flex-1 px-3">
          <input
            type="number"
            placeholder={options.placeholder || 'Enter your age'}
            min={options.min || 18}
            max={options.max || 120}
            className="w-full h-8 px-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-xs"
          />
        </div>
      </div>
    )
  }

  // Age Input Scroll (12–120, scroll wheel style – quiz + conversion)
  if (componentId === 'age_input_scroll') {
    const ages = Array.from({ length: 120 - 12 + 1 }, (_, i) => 12 + i)
    const displayAge = selectedAge !== null && selectedAge >= 12 && selectedAge <= 120 ? selectedAge : null
    const itemHeight = 24
    const pickerHeight = 72
    const indicatorHeight = 26
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }}></div>
          </div>
        </div>
        <div className="px-3 pb-0 flex-shrink-0">
          {title ? (
            <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">{title}</h3>
          ) : (
            <h3 className="text-lg font-black text-gray-400 mb-2 leading-5 tracking-tight text-left italic">No title</h3>
          )}
          {description ? (
            <p className="text-xs text-black opacity-90 leading-4 mb-3 text-left">{description}</p>
          ) : (
            <p className="text-xs text-gray-400 opacity-60 leading-4 mb-3 text-left italic">No description</p>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center min-h-0 px-3 pb-2" style={{ gap: 16 }}>
          <p
            className="w-full text-left font-semibold text-black flex-shrink-0"
            style={{ fontSize: 18, marginBottom: 8 }}
          >
            {displayAge !== null ? `Age ${displayAge}` : 'Age'}
          </p>
          <div
            className="w-full flex-shrink-0 rounded-2xl overflow-hidden relative"
            style={{ height: pickerHeight, backgroundColor: '#F5F5F5' }}
          >
            <div
              className="absolute left-0 right-0 pointer-events-none border-2 border-black rounded-xl"
              style={{ top: (pickerHeight - indicatorHeight) / 2, height: indicatorHeight }}
            />
            <div
              className="h-full overflow-y-auto overflow-x-hidden"
              style={{ paddingTop: (pickerHeight - indicatorHeight) / 2, paddingBottom: (pickerHeight - indicatorHeight) / 2 }}
            >
              <div
                className="text-center flex items-center justify-center w-full"
                style={{ height: itemHeight, fontSize: 16, color: '#999999', fontStyle: 'italic' }}
              >
                Scroll to select
              </div>
              {ages.map((age) => (
                <button
                  key={age}
                  type="button"
                  onClick={() => setSelectedAge(age)}
                  className="w-full text-center block flex items-center justify-center"
                  style={{
                    height: itemHeight,
                    fontSize: selectedAge === age ? 14 : 10,
                    fontWeight: selectedAge === age ? 700 : 400,
                    color: selectedAge === age ? '#000000' : '#666666',
                    lineHeight: 1,
                  }}
                >
                  {age}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-3 py-2 flex-shrink-0">
          <button
            type="button"
            className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: displayAge !== null ? '0 4px 0 #000' : 'none' }}
            disabled={displayAge === null}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // Age Input Picker (14–120, native-style – conversion only)
  if (componentId === 'age_input_picker') {
    const ages = Array.from({ length: 120 - 14 + 1 }, (_, i) => 14 + i)
    const isValid = selectedAge !== null && selectedAge >= 14 && selectedAge <= 120
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }}></div>
          </div>
        </div>
        <div className="px-3 pb-0 flex-shrink-0">
          {title ? (
            <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">{title}</h3>
          ) : (
            <h3 className="text-lg font-black text-gray-400 mb-2 leading-5 tracking-tight text-left italic">No title</h3>
          )}
          {description ? (
            <p className="text-xs text-black opacity-90 leading-4 mb-3 text-left">{description}</p>
          ) : (
            <p className="text-xs text-gray-400 opacity-60 leading-4 mb-3 text-left italic">No description</p>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center min-h-0 px-3 pb-2" style={{ gap: 12 }}>
          <p
            className="w-full text-left font-semibold text-black flex-shrink-0"
            style={{ fontSize: 18, marginBottom: 4 }}
          >
            {isValid ? `Age ${selectedAge}` : 'Age'}
          </p>
          <div className="w-full flex-shrink-0 py-2 min-h-[90px]">
            <select
              value={selectedAge ?? ''}
              onChange={(e) => setSelectedAge(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-9 px-2 border border-gray-300 rounded-lg bg-white text-black text-sm font-normal"
              style={{ fontSize: 20 }}
            >
              <option value="">Select age</option>
              {ages.map((age) => (
                <option key={age} value={age}>{age}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-3 py-2 flex-shrink-0">
          <button
            type="button"
            className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: isValid ? '0 4px 0 #000' : 'none' }}
            disabled={!isValid}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // Profile Image (Onboarding + Conversion)
  if (componentId === 'profile_image') {
    const skipable = options && typeof options === 'object' && 'skipable' in options && options.skipable === true
    const avatarSources = (() => {
      if (!options || typeof options !== 'object' || !('final_reviews' in options)) return []
      const arr = (options as { final_reviews?: unknown[] }).final_reviews
      return Array.isArray(arr) ? arr.slice(0, 3) : []
    })()
    const showAvatarRow = avatarSources.length > 0
    const UPLOAD_SIZE = 100
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="px-3 pt-8 pb-2 flex-shrink-0 flex items-center gap-2">
          <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }} />
          </div>
          {skipable && (
            <button
              type="button"
              className="flex-shrink-0 rounded-[20px] font-semibold text-sm"
              style={{
                background: '#ECECEC',
                color: '#666666',
                padding: '8px 16px',
              }}
            >
              Skip
            </button>
          )}
        </div>
        <div className="px-3 pb-0 flex-shrink-0">
          {title ? (
            <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">{title}</h3>
          ) : (
            <h3 className="text-lg font-black text-gray-400 mb-2 leading-5 tracking-tight text-left italic">No title</h3>
          )}
          {description ? (
            <p className="text-xs text-black opacity-90 leading-4 mb-3 text-left">{description}</p>
          ) : (
            <p className="text-xs text-gray-400 opacity-60 leading-4 mb-3 text-left italic">No description</p>
          )}
        </div>
        <div className="flex-1 px-3 pb-2 flex flex-col items-center justify-center min-h-0" style={{ gap: 16 }}>
          <button
            type="button"
            onClick={() => setProfileImageSelected(!profileImageSelected)}
            className="flex-shrink-0 rounded-[32px] border-2 border-black bg-white overflow-hidden flex items-center justify-center"
            style={{
              width: UPLOAD_SIZE,
              height: UPLOAD_SIZE,
              boxShadow: '0 4px 0 #000000',
            }}
          >
            <div
              className="w-full h-full rounded-[30px] overflow-hidden flex items-center justify-center"
              style={{ backgroundColor: profileImageSelected ? '#E5E7EB' : '#FFFFFF' }}
            >
              {profileImageSelected ? (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-3xl">✓</span>
                </div>
              ) : (
                <div
                  className="w-full h-full flex flex-col items-center justify-center"
                  style={{ padding: 12, gap: 6 }}
                >
                  <Upload size={24} className="text-black" strokeWidth={2.5} />
                  <span
                    className="font-black text-black"
                    style={{ fontSize: 14, fontWeight: 900 }}
                  >
                    Upload
                  </span>
                </div>
              )}
            </div>
          </button>
          {showAvatarRow && (
            <div className="w-full flex-shrink-0" style={{ marginTop: 24 }}>
              <p
                className="text-left w-full mb-2"
                style={{ fontSize: 14, fontWeight: 500, color: '#222222' }}
              >
                Let them notice you 👀✨
              </p>
              <div
                className="flex items-center"
                style={{ height: 56, marginLeft: -9 }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 rounded-full bg-gray-300 border-2 border-white"
                    style={{
                      width: 40,
                      height: 40,
                      marginLeft: i === 0 ? 0 : -9,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-3 py-2 flex-shrink-0">
          <button
            type="button"
            className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: profileImageSelected ? '0 4px 0 #000' : 'none' }}
            disabled={!profileImageSelected}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // DiscreteSlider-style shared values (thinner track like options screens)
  const TRACK_HEIGHT = 10
  const HANDLE_SIZE = 36
  const STEP_MARKER_SIZE = 8
  const STEPS = 5
  const trackUnfilled = '#E5E7EB'
  const trackFilled = '#D1D5DB'
  const stepMarkerColor = '#D1D5DB'
  const handleColor = '#FF5252'

  // Frequency Slider (Onboarding + Conversion)
  if (componentId === 'frequency_slider') {
    const stepLabels = (options.stepLabels as string[] | undefined) || ['1x', '2x', '3x', '4x', '5x']
    const valueLabel = stepLabels[sliderStepValue - 1] ?? `${sliderStepValue}x`
    const fillPercent = ((sliderStepValue - 1) / (STEPS - 1)) * 100
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>
        <div className="px-3 pb-0 flex-shrink-0">
          {title ? (
            <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">{title}</h3>
          ) : (
            <h3 className="text-lg font-black text-gray-400 mb-2 leading-5 tracking-tight text-left italic">No title</h3>
          )}
          {description ? (
            <p className="text-sm text-black/90 leading-4 mb-3 text-left">{description}</p>
          ) : (
            <p className="text-sm text-gray-400 opacity-60 leading-4 mb-3 text-left italic">No description</p>
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center px-3 min-h-0">
          <div className="w-full py-4">
            <p
              className="text-center font-black text-black w-full"
              style={{ fontSize: 48, fontWeight: 900, color: '#000000', marginBottom: 32 }}
            >
              {valueLabel}
            </p>
            <div className="relative w-full" style={{ paddingTop: HANDLE_SIZE / 2, paddingBottom: HANDLE_SIZE / 2 + 16 }}>
              <div
                className="relative w-full rounded-full overflow-visible cursor-pointer"
                style={{ height: TRACK_HEIGHT, background: trackUnfilled }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = (e.clientX - rect.left) / rect.width
                  const step = Math.min(STEPS, Math.max(1, Math.round(x * (STEPS - 1)) + 1))
                  setSliderStepValue(step)
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${fillPercent}%`, background: trackFilled }}
                />
                {Array.from({ length: STEPS }, (_, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: STEP_MARKER_SIZE,
                      height: STEP_MARKER_SIZE,
                      left: `calc(${(i / (STEPS - 1)) * 100}% - ${STEP_MARKER_SIZE / 2}px)`,
                      top: (TRACK_HEIGHT - STEP_MARKER_SIZE) / 2,
                      background: stepMarkerColor,
                    }}
                  />
                ))}
                <div
                  className="absolute rounded-xl pointer-events-none transition-[left] border-2 border-[#e04545]"
                  style={{
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    left: `calc(${fillPercent}% - ${HANDLE_SIZE / 2}px)`,
                    top: (TRACK_HEIGHT - HANDLE_SIZE) / 2,
                    background: handleColor,
                    boxShadow: '0 3px 6px rgba(0,0,0,0.25)',
                  }}
                >
                  <div
                    className="absolute rounded-[10px]"
                    style={{
                      width: 24,
                      height: 24,
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(255,255,255,0.35)',
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-between mt-2 w-full" style={{ fontSize: 14, fontWeight: 500, color: '#6B7280' }}>
                <span>1x</span>
                <span>5x</span>
              </div>
            </div>
          </div>
        </div>
        <div className="px-3 py-2 flex-shrink-0">
          <button
            type="button"
            className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 4px 0 #000' }}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // Satisfaction Slider (Onboarding + Conversion)
  if (componentId === 'satisfaction_slider') {
    const stepLabels = (options.stepLabels as string[] | undefined) || ['Awful', 'Not great', 'Okay', 'Good', 'Amazing']
    const markerLabels = (options.markerLabels as string[] | undefined) || ['😡', '😕', '😐', '🙂', '🤩']
    const valueLabel = stepLabels[sliderStepValue - 1] ?? 'Okay'
    const fillPercent = ((sliderStepValue - 1) / (STEPS - 1)) * 100
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>
        <div className="px-3 pb-0 flex-shrink-0">
          {title ? (
            <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">{title}</h3>
          ) : (
            <h3 className="text-lg font-black text-gray-400 mb-2 leading-5 tracking-tight text-left italic">No title</h3>
          )}
          {description ? (
            <p className="text-sm text-black/90 leading-4 mb-3 text-left">{description}</p>
          ) : (
            <p className="text-sm text-gray-400 opacity-60 leading-4 mb-3 text-left italic">No description</p>
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center px-3 min-h-0">
          <div className="w-full py-4">
            <p
              className="text-center font-black text-black w-full"
              style={{ fontSize: 48, fontWeight: 900, color: '#000000', marginBottom: 32 }}
            >
              {valueLabel}
            </p>
            <div className="relative w-full" style={{ paddingTop: HANDLE_SIZE / 2, paddingBottom: HANDLE_SIZE / 2 }}>
              <div
                className="relative w-full rounded-full overflow-visible cursor-pointer"
                style={{ height: TRACK_HEIGHT, background: trackUnfilled }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = (e.clientX - rect.left) / rect.width
                  const step = Math.min(STEPS, Math.max(1, Math.round(x * (STEPS - 1)) + 1))
                  setSliderStepValue(step)
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${fillPercent}%`, background: trackFilled }}
                />
                {Array.from({ length: STEPS }, (_, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: STEP_MARKER_SIZE,
                      height: STEP_MARKER_SIZE,
                      left: `calc(${(i / (STEPS - 1)) * 100}% - ${STEP_MARKER_SIZE / 2}px)`,
                      top: (TRACK_HEIGHT - STEP_MARKER_SIZE) / 2,
                      background: stepMarkerColor,
                    }}
                  />
                ))}
                <div
                  className="absolute rounded-xl pointer-events-none transition-[left] border-2 border-[#e04545]"
                  style={{
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    left: `calc(${fillPercent}% - ${HANDLE_SIZE / 2}px)`,
                    top: (TRACK_HEIGHT - HANDLE_SIZE) / 2,
                    background: handleColor,
                    boxShadow: '0 3px 6px rgba(0,0,0,0.25)',
                  }}
                >
                  <div
                    className="absolute rounded-[10px]"
                    style={{
                      width: 24,
                      height: 24,
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(255,255,255,0.35)',
                    }}
                  />
                </div>
              </div>
              <div
                className="flex justify-between w-full"
                style={{ marginTop: 12, fontSize: 20 }}
              >
                {markerLabels.map((emoji: string, i: number) => (
                  <button
                    key={i}
                    type="button"
                    className="flex-1 text-center cursor-pointer hover:opacity-80"
                    onClick={() => setSliderStepValue(i + 1)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="px-3 py-2 flex-shrink-0">
          <button
            type="button"
            className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 4px 0 #000' }}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // Testimonial Loader
  if (componentId === 'testimonial_loader') {
    const CIRCLE_RADIUS = 70
    const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS // ~439.82

    // Get reviews from options - handle both options.reviews and direct reviews array
    const reviews = (() => {
      if (Array.isArray(options)) {
        return []
      }
      if (options && typeof options === 'object' && 'reviews' in options && Array.isArray(options.reviews)) {
        return options.reviews
      }
      return []
    })()

    const progressDisplay = Math.round(testimonialProgress * 100)
    const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - testimonialProgress)

    // Get status text based on progress
    const getStatusText = () => {
      if (testimonialProgress < 0.3) return 'Gathering stories from our community'
      if (testimonialProgress < 0.6) return 'Polishing your personalized experience'
      if (testimonialProgress < 1) return 'Finalizing results'
      return 'All set!'
    }

    const currentReview = reviews[currentReviewIndex] || reviews[0]

    // Generate avatar initials
    const getAvatarContent = () => {
      if (currentReview.avatar) {
        // eslint-disable-next-line @next/next/no-img-element
        return (
          <img
            src={currentReview.avatar}
            alt={currentReview.author}
            className="w-full h-full object-cover"
          />
        )
      }
      if (currentReview.initials) {
        return (
          <span className="text-[14px] font-bold text-[#111827]">
            {currentReview.initials}
          </span>
        )
      }
      // Generate from author name
      const initials = currentReview.author
        .split(' ')
        .slice(0, 2)
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
      return (
        <span className="text-[14px] font-bold text-[#111827]">
          {initials || '⭐'}
        </span>
      )
    }

    // Scale down for phone mockup
    const SCALE = 0.5 // Scale everything down by 50%
    const SCALED_CIRCLE_SIZE = 80 // 160 * 0.5
    const SCALED_RADIUS = 35 // 70 * 0.5
    const SCALED_CIRCUMFERENCE = 2 * Math.PI * SCALED_RADIUS

    return (
      <div className="w-full h-full flex flex-col bg-white pt-8 overflow-hidden">
        {/* Progress Bar */}
        <div className="px-3 pt-1 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }}></div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-3 py-4 gap-3 min-h-0 overflow-hidden">
          {/* Progress Section */}
          <div className="flex flex-col items-center gap-2.5 w-full flex-shrink-0">
            {/* Circular Progress Indicator */}
            <div className="relative w-[80px] h-[80px] flex items-center justify-center">
              <svg width="80" height="80" viewBox="0 0 160 160" className="absolute top-0 left-0">
                {/* Background track */}
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="#E5E7EB"
                  strokeWidth="14"
                  fill="none"
                />
                {/* Progress fill */}
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="#111827"
                  strokeWidth="14"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={CIRCLE_CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 80 80)"
                  className="transition-all duration-200"
                />
              </svg>
              {/* Percentage text */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <span className="text-base font-black text-[#111827] leading-none" style={{ fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                  {progressDisplay}%
                </span>
              </div>
            </div>

            {/* Progress Headline */}
            <h3 className="text-[10px] font-semibold text-[#111827] text-center leading-tight px-2" style={{ fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
              We&apos;re setting everything up
            </h3>

            {/* Progress Status */}
            <p className="text-[8px] text-[#6B7280] text-center leading-tight px-2" style={{ fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
              {getStatusText()}
            </p>
          </div>

          {/* Testimonial Card Section */}
          <div className="flex-1 flex items-center justify-center w-full min-h-0 overflow-hidden">
            {reviews.length === 0 ? (
              // Empty state
              <div className="bg-[#F3F4F6] rounded-xl px-3 py-2.5 w-full min-h-[55px] flex flex-col gap-1.5 shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
                <h4 className="text-[9px] font-bold text-[#111827]" style={{ fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                  Our community loves Shameless
                </h4>
                <p className="text-[7.5px] text-[#4B5563] text-center" style={{ fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                  Sit tight while we load what people are saying.
                </p>
              </div>
            ) : (
              // Review Card
              <div className="bg-[#F3F4F6] rounded-xl px-3 py-2.5 w-full min-h-[55px] flex flex-col gap-1.5 shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
                {/* Review Header */}
                <div className="flex items-center justify-between gap-2 w-full">
                  {/* Reviewer Info */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-5.5 h-5.5 rounded-full bg-white border border-white flex items-center justify-center overflow-hidden shrink-0">
                      {currentReview.initials ? (
                        <span className="text-[7px] font-bold text-[#111827]">
                          {currentReview.initials}
                        </span>
                      ) : (
                        <span className="text-[7px] font-bold text-[#111827]">⭐</span>
                      )}
                    </div>
                    {/* Author Name */}
                    <p className="text-[8.5px] font-bold text-[#111827] leading-tight truncate" style={{ fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                      {currentReview.author}
                    </p>
                  </div>
                  {/* Rating Stars */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: currentReview.rating || 5 }).map((_, i) => (
                      <span key={i} className="text-[9px] leading-none">⭐</span>
                    ))}
                  </div>
                </div>
                {/* Review Text */}
                <p className="text-[8px] text-[#374151] leading-3 text-left" style={{ fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                  &ldquo;{currentReview.text}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Push Notification Permission (conversion – same header/CTA layout as quiz, content in middle)
  if (componentId === 'push_notification_permission') {
    const displayTitle = title || "Don't miss a thing"
    return (
      <div
        className="w-full h-full flex flex-col bg-white overflow-hidden"
        style={{ fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >
        {/* Progress bar – same as quiz screens */}
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }}></div>
          </div>
        </div>

        {/* Header – same as quiz (title only, no description) */}
        <div className="px-3 pb-0 flex-shrink-0">
          <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">
            {displayTitle}
          </h3>
        </div>

        {/* Content – centered in middle (notification mock, hint, link) */}
        <div className="flex-1 px-3 pb-2 overflow-y-auto min-h-0 flex flex-col items-center justify-center gap-2.5">
          {/* Notification mock */}
          <div
            className="w-full max-w-[calc(100%-8px)] flex-shrink-0 flex items-start gap-2 rounded-[7px] p-1.5 bg-white border"
            style={{
              borderColor: 'rgba(0,0,0,0.08)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            }}
          >
            <div
              className="w-9 h-9 flex-shrink-0 relative flex items-center justify-center bg-[#FF5252] text-white font-bold text-xs overflow-hidden"
              style={{ borderRadius: 8 }}
            >
              <img
                src="/assets/app/app-icon.png"
                alt=""
                className="w-full h-full object-cover absolute inset-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const parent = e.currentTarget.parentElement
                  const fallback = parent?.querySelector('[data-fallback]') as HTMLElement
                  if (fallback) fallback.style.display = 'flex'
                }}
              />
              <span data-fallback className="hidden font-black text-sm text-white" style={{ display: 'none' }}>S</span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="flex justify-between items-baseline gap-1">
                <span className="text-black font-semibold truncate" style={{ fontSize: 10 }}>Shamelesss</span>
                <span className="text-[#8E8E93] flex-shrink-0" style={{ fontSize: 9 }}>now</span>
              </div>
              <div className="text-black font-semibold truncate" style={{ fontSize: 9 }}>New friend request</div>
              <div className="text-[#3C3C43] truncate opacity-80" style={{ fontSize: 8, lineHeight: 1.3 }}>Someone wants to connect with you</div>
            </div>
          </div>

          <p
            className="text-center px-2"
            style={{ color: '#374151', fontSize: 8, lineHeight: 1.35, fontWeight: 400 }}
          >
            Let us notify you when other users send you a friend request or a new message. Tap &quot;Allow&quot; above 👉
          </p>

          <button
            type="button"
            className="underline py-1 px-2"
            style={{ color: '#6B7280', fontSize: 7, fontWeight: 400, lineHeight: 1.4 }}
          >
            Didn&apos;t see the dialog? Tap to try again
          </button>
        </div>

        {/* CTA – same position and style as quiz screens */}
        <div className="px-3 py-2 flex-shrink-0">
          <button
            type="button"
            className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 4px 0 #000' }}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // ScratchDates Preview – card with coral overlay; scratch to reveal image, 40% threshold, Next only after complete
  if (componentId === 'scratchdates_preview') {
    const SCRATCH_THRESHOLD = 0.4
    const SCRATCH_STROKE = 30
    const cardSize = 150
    const imageUrl = (options && typeof options === 'object' && 'image_url' in options && typeof (options as { image_url: string }).image_url === 'string')
      ? (options as { image_url: string }).image_url
      : ''
    const positionTitle = (options && typeof options === 'object' && 'title' in options && typeof (options as { title: string }).title === 'string')
      ? (options as { title: string }).title
      : 'Position'
    const defaultArcadeUrl = 'https://esdzfopaahvbokddexeh.supabase.co/storage/v1/object/public/positions-images/Arcade-1.png'
    const imageSrc = imageUrl || defaultArcadeUrl

    const getCanvasPoint = (e: React.PointerEvent) => {
      const canvas = scratchCanvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    }

    const handlePointerDown = (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      const canvas = scratchCanvasRef.current
      if (!canvas) return
      const p = getCanvasPoint(e)
      if (!p) return
      scratchIsDrawingRef.current = true
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.lineWidth = SCRATCH_STROKE
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
    }

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!scratchIsDrawingRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const canvas = scratchCanvasRef.current
      if (!canvas) return
      const p = getCanvasPoint(e)
      if (!p) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }

    const checkScratchComplete = () => {
      const canvas = scratchCanvasRef.current
      if (!canvas || scratchTriggeredRef.current) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const w = canvas.width
      const h = canvas.height
      const data = ctx.getImageData(0, 0, w, h)
      let scratched = 0
      for (let i = 3; i < data.data.length; i += 4) {
        if (data.data[i] < 128) scratched += 1
      }
      const total = w * h
      if (total > 0 && scratched / total >= SCRATCH_THRESHOLD) {
        scratchTriggeredRef.current = true
        setScratchComplete(true)
      }
    }

    const handlePointerUp = (e: React.PointerEvent) => {
      e.currentTarget.releasePointerCapture(e.pointerId)
      if (scratchIsDrawingRef.current) {
        scratchIsDrawingRef.current = false
        checkScratchComplete()
      }
    }

    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        {/* Progress bar – same as other screens */}
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>
        {/* Header – same as other screens */}
        <div className="px-3 pb-0 flex-shrink-0">
          {title ? (
            <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">{title}</h3>
          ) : (
            <h3 className="text-lg font-black text-gray-400 mb-2 leading-5 tracking-tight text-left italic">No title</h3>
          )}
          {description ? (
            <p className="text-xs text-black opacity-90 leading-4 mb-3 text-left">{description}</p>
          ) : (
            <p className="text-xs text-gray-400 opacity-60 leading-4 mb-3 text-left italic">No description</p>
          )}
        </div>
        {/* Content – centered scratch card: image + coral overlay canvas */}
        <div className="flex-1 px-3 pb-2 overflow-y-auto min-h-0 flex flex-col items-center justify-center">
          <div
            className="flex-shrink-0 relative overflow-hidden rounded-[20px] bg-white"
            style={{
              width: cardSize,
              height: cardSize,
            }}
          >
            {/* Image layer (contentFit cover) */}
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc}
                alt={positionTitle}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">Image</div>
            )}
            {/* Coral overlay – scratched away with pointer; 30px stroke, 40% threshold */}
            <canvas
              ref={scratchCanvasRef}
              className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
              style={{ borderRadius: 20 }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </div>
        </div>
        {/* Next button – shown only after scratch completion */}
        {scratchComplete && (
          <div className="px-3 py-2 flex-shrink-0">
            <button
              type="button"
              className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity"
              style={{ boxShadow: '0 4px 0 #000' }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    )
  }

  // Info Screen
  if (componentId === 'info' || !componentId) {
    return (
      <div className="w-full h-full flex flex-col bg-white pt-8">
        {title ? (
          <h3 className="text-sm font-bold text-gray-900 mb-1 mt-2 px-3 text-left">{title}</h3>
        ) : (
          <h3 className="text-sm font-bold text-gray-400 mb-1 mt-2 px-3 text-left italic">No title</h3>
        )}
        {description ? (
          <p className="text-xs text-gray-600 mb-2 px-3 leading-relaxed text-left">{description}</p>
        ) : (
          <p className="text-xs text-gray-400 opacity-60 mb-2 px-3 leading-relaxed text-left italic">No description</p>
        )}
        <div className="flex-1"></div>
        <div className="px-3 pb-2">
          <button className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity">
            Next
          </button>
        </div>
      </div>
    )
  }

  // Quiz Results (conversion only) – PotentialImprovementChart
  if (componentId === 'quiz_results') {
    const BAR_WIDTH = 40
    const BAR_SPACING = 28
    const BAR_RADIUS = 10
    const CHART_HEIGHT = 90
    const current = 60
    const after = 85
    const max = 100
    const percentChange = 300
    const grayBarHeight = (current / max) * CHART_HEIGHT
    const greenBarHeight = (after / max) * CHART_HEIGHT * 1.25

    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>
        <div className="px-3 pb-0 flex-shrink-0">
          {title ? (
            <h3 className="text-lg font-black text-black mb-2 leading-5 tracking-tight text-left">{title}</h3>
          ) : (
            <h3 className="text-lg font-black text-gray-400 mb-2 leading-5 tracking-tight text-left italic">No title</h3>
          )}
          {description ? (
            <p className="text-xs text-black opacity-90 leading-4 mb-3 text-left">{description}</p>
          ) : (
            <p className="text-xs text-gray-400 opacity-60 leading-4 mb-3 text-left italic">No description</p>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-3 min-h-0" style={{ minHeight: 160 }}>
          <div className="flex flex-shrink-0 gap-6 items-end">
            {/* Left column: bar container so gray bar sits on same baseline as green bar */}
            <div className="flex flex-col items-center" style={{ width: BAR_WIDTH + 16 }}>
              <div className="flex flex-col justify-end items-center" style={{ height: greenBarHeight }}>
                <div
                  className="flex-shrink-0"
                  style={{ width: BAR_WIDTH, height: grayBarHeight, backgroundColor: '#ECECEC', borderRadius: BAR_RADIUS }}
                />
              </div>
              <span className="text-center mt-2.5" style={{ fontSize: 12, color: '#888888', maxWidth: 90, lineHeight: 1.3 }}>Your Game</span>
            </div>
            {/* Right column: badge (arrow left of %) + green bar + label */}
            <div className="flex flex-col items-center" style={{ width: BAR_WIDTH + 16 }}>
              <span
                className="inline-flex items-center gap-0.5 font-bold flex-shrink-0 mb-1 whitespace-nowrap"
                style={{ fontSize: 12, color: '#FF5252' }}
              >
                ↑ {percentChange}.0%
              </span>
              <div
                className="flex-shrink-0"
                style={{ width: BAR_WIDTH, height: greenBarHeight, backgroundColor: '#4CAF50', borderRadius: BAR_RADIUS }}
              />
              <span className="text-center mt-2.5 font-bold" style={{ fontSize: 12, color: '#222222', maxWidth: 100, lineHeight: 1.25 }}>Shameless Game</span>
            </div>
          </div>
        </div>
        <div className="px-3 py-2 flex-shrink-0">
          <button
            type="button"
            className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 4px 0 #000' }}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  // Shared rate app content (rate_app_blurred + rate_app_default)
  const getRateAppReviews = (): Array<{ author_name?: string; author?: string; text?: string; avatar_url?: string }> => {
    if (!options || typeof options !== 'object' || !('final_reviews' in options)) return []
    const arr = (options as { final_reviews?: unknown[] }).final_reviews
    if (!Array.isArray(arr)) return []
    return arr.slice(0, 3).map((r) => (typeof r === 'object' && r !== null ? (r as Record<string, unknown>) : {})) as Array<{ author_name?: string; author?: string; text?: string; avatar_url?: string }>
  }
  const rateAppStatsTitle = (options && typeof options === 'object' && 'stats' in options && options.stats && typeof (options.stats as Record<string, unknown>).title === 'string')
    ? (options.stats as { title: string }).title
    : '500k'

  const renderRateAppContent = (showContinue: boolean) => {
    const reviews = getRateAppReviews()
    return (
      <>
        <div className="px-3 pt-8 pb-2 flex-shrink-0">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>
        <div className="px-3 pb-0 flex-shrink-0">
          <h3 className="text-left mb-2 leading-tight" style={{ fontSize: 20, fontWeight: 900, color: '#000000' }}>
            {title || 'Rate us'}
          </h3>
          <p className="text-left mb-3 opacity-90" style={{ fontSize: 14, color: '#000000' }}>
            {description || 'We\'d love your feedback'}
          </p>
        </div>
        <div className="flex-1 px-3 pb-2 overflow-y-auto min-h-0">
          <div className="flex flex-col items-center" style={{ gap: 12 }}>
            <div
              className="flex items-center justify-center rounded-[20px] border flex-shrink-0"
              style={{
                borderColor: '#ECECEC',
                backgroundColor: '#FFFFFF',
                padding: '6px 14px',
                margin: '8px 0',
                gap: 6,
              }}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} style={{ fontSize: 20 }}>⭐</span>
              ))}
            </div>
            <div className="flex items-center w-full" style={{ marginLeft: -9 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex-shrink-0 rounded-full bg-gray-300 border-2 border-white"
                  style={{ width: 36, height: 36, marginLeft: i === 0 ? 0 : -9 }}
                />
              ))}
              <span className="ml-2 flex-shrink-0" style={{ fontSize: 12, fontWeight: 500, color: '#222222' }}>
                {rateAppStatsTitle} Shameless Users
              </span>
            </div>
            {reviews.length > 0 && (
              <div className="w-full flex flex-col" style={{ gap: 8, marginTop: 8 }}>
                {reviews.map((r, i) => (
                  <div
                    key={i}
                    className="w-full rounded-[18px] flex items-start gap-2 flex-shrink-0"
                    style={{ backgroundColor: '#f4f4f4', padding: 12 }}
                  >
                    <div
                      className="flex-shrink-0 rounded-full bg-gray-400 border-2 border-white"
                      style={{ width: 28, height: 28 }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="font-bold" style={{ fontSize: 12 }}>{r.author_name || r.author || 'User'}</span>
                        <span style={{ fontSize: 10 }}>⭐</span>
                      </div>
                      <p className="text-left leading-snug" style={{ fontSize: 11, color: '#333333', lineHeight: 1.35 }}>
                        {r.text || 'Great app!'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {showContinue && (
          <div className="px-3 py-2 flex-shrink-0">
            <button
              type="button"
              className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity"
              style={{ boxShadow: '0 4px 0 #000' }}
            >
              Continue
            </button>
          </div>
        )}
      </>
    )
  }

  // Rate App Blurred (conversion only)
  if (componentId === 'rate_app_blurred') {
    const showOverlay = rateAppCountdown !== null
    const showContinue = !showOverlay
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden relative">
        {renderRateAppContent(showContinue)}
        {showOverlay && (
          <div
            className="absolute inset-0 flex items-center justify-center z-20"
            style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.4)' }}
          >
            <div
              className="rounded-[32px] flex items-center justify-center font-bold"
              style={{
                padding: '12px 24px',
                backgroundColor: 'rgba(255,255,255,0.85)',
                fontSize: 28,
                color: '#222222',
              }}
            >
              {rateAppCountdown}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Rate App Default (conversion only)
  if (componentId === 'rate_app_default') {
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        {renderRateAppContent(true)}
      </div>
    )
  }

  // Rate App Stars – main screen + feedback modal (1–3 stars)
  if (componentId === 'rate_app_stars') {
    const starCount = 5
    const handleStarClick = (value: number) => {
      setRateAppStarsSelected(value)
      if (value >= 1 && value <= 3) {
        setRateAppStarsFeedbackOpen(true)
      }
    }
    return (
      <div className="w-full h-full relative flex flex-col overflow-hidden" style={{ backgroundColor: '#FF5252' }}>
        {/* Content – title and subtitle above stars, block centered */}
        <div className="flex-1 flex flex-col items-center justify-center px-3 min-h-0 gap-3">
          <h3 className="text-lg font-black text-black text-center leading-5 tracking-tight flex-shrink-0">
            {title || 'Like Shameless?'}
          </h3>
          <p className="text-xs text-black text-center opacity-90 leading-4 flex-shrink-0">
            {description || 'Rate Us'}
          </p>
          <div
            className="flex items-center justify-center border-2 border-black bg-white w-fit flex-shrink-0"
            style={{
              padding: '8px 12px',
              borderRadius: 28,
              boxShadow: '0 4px 0 #000',
              gap: 4,
            }}
          >
            {Array.from({ length: starCount }, (_, i) => {
              const value = i + 1
              const filled = rateAppStarsSelected >= value
              const size = 18
              return (
                <button
                  key={i}
                  type="button"
                  className="p-0.5 border-0 bg-transparent cursor-pointer touch-manipulation inline-flex items-center justify-center shrink-0"
                  style={{ width: size, height: size }}
                  onClick={() => handleStarClick(value)}
                  aria-label={`${value} star${value > 1 ? 's' : ''}`}
                >
                  {filled ? (
                    <span style={{ fontSize: size, lineHeight: 1 }}>⭐</span>
                  ) : (
                    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.5" strokeLinejoin="round" className="shrink-0">
                      <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        {/* CTA – fixed at bottom, same as other screens */}
        <div className="px-3 py-2 flex-shrink-0">
          <button
            type="button"
            className="w-full h-8 bg-white border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 4px 0 #000' }}
          >
            Continue
          </button>
        </div>

        {/* Feedback modal – overlay + sheet (1–3 stars) */}
        {rateAppStarsFeedbackOpen && (
          <div
            className="absolute inset-0 flex items-end justify-center z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            <div
              className="w-full bg-white rounded-t-[24px] flex flex-col max-h-[85%] overflow-hidden"
              style={{ padding: '12px 24px 34px' }}
            >
              {/* Handle */}
              <div
                className="w-10 h-1 rounded-sm mx-auto mb-6 shrink-0"
                style={{ backgroundColor: '#E5E7EB', width: 40, height: 4, borderRadius: 2 }}
              />
              {/* Title row – title left, Skip right; smaller so it fits one row */}
              <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
                <span className="font-bold text-black shrink-0 whitespace-nowrap" style={{ fontSize: 10 }}>
                  What could we do better?
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded-full font-bold text-black hover:opacity-80 transition-opacity leading-tight"
                  style={{
                    background: '#E5E7EB',
                    padding: '2px 8px',
                    fontSize: 10,
                  }}
                  onClick={() => {
                    setRateAppStarsFeedbackOpen(false)
                    setRateAppStarsFeedbackText('')
                  }}
                >
                  Skip
                </button>
              </div>
              {/* Input – white, light gray border, faint shadow */}
              <textarea
                className="w-full rounded-xl resize-none bg-white text-black placeholder:text-gray-400 mb-5 min-h-[80px] border border-gray-200"
                style={{ padding: 12, fontSize: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                placeholder="Share your feedback..."
                value={rateAppStarsFeedbackText}
                onChange={(e) => setRateAppStarsFeedbackText(e.target.value)}
                rows={4}
              />
              {/* Send Feedback – red-orange, bold black text, raised shadow */}
              <button
                type="button"
                className="w-full h-9 bg-[#FF5252] border-2 border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity shrink-0"
                style={{ boxShadow: '0 4px 0 #000' }}
                onClick={() => {
                  setRateAppStarsFeedbackOpen(false)
                  setRateAppStarsFeedbackText('')
                }}
              >
                Send Feedback
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Default fallback
  return (
    <div className="w-full h-full flex flex-col bg-white pt-8">
      {title ? (
        <h3 className="text-sm font-bold text-gray-900 mb-1 mt-2 px-3 text-left">{title}</h3>
      ) : (
        <h3 className="text-sm font-bold text-gray-400 mb-1 mt-2 px-3 text-left italic">No title</h3>
      )}
      {description ? (
        <p className="text-xs text-gray-600 mb-2 px-3 text-left">{description}</p>
      ) : (
        <p className="text-xs text-gray-400 opacity-60 mb-2 px-3 text-left italic">No description</p>
      )}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-1">📱</div>
          <p className="text-[10px] text-gray-500">{componentId || 'Custom Screen'}</p>
        </div>
      </div>
    </div>
  )
}
