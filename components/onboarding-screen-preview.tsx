'use client'

import { useState, useEffect, useRef } from 'react'
import type { QuizScreen, ConversionScreen } from '@/types/onboarding'

interface ScreenPreviewProps {
  screen: QuizScreen | ConversionScreen
  totalScreens?: number
}

export function OnboardingScreenPreview({ screen, totalScreens }: ScreenPreviewProps) {
  // All hooks must be at top level (required by React Hooks rules)
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  
  // Testimonial loader hooks (always declared, conditionally used)
  const [testimonialProgress, setTestimonialProgress] = useState(0)
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0)
  const testimonialProgressRef = useRef<number>(0)
  const testimonialAnimationRef = useRef<number>()
  
  const componentId = screen.component_id
  const options = screen.options || {}
  const title = screen.title || ''
  const description = screen.description || ''
  
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
    
    const reviews = options.reviews || [
      { id: '1', author: 'Sarah M.', text: 'This app changed my life! The personalized experience is incredible.', rating: 5, avatar: null, initials: 'SM' },
      { id: '2', author: 'John D.', text: 'Best dating app I\'ve ever used. Highly recommend!', rating: 5, avatar: null, initials: 'JD' },
      { id: '3', author: 'Emma L.', text: 'Love how it adapts to my preferences. So intuitive!', rating: 5, avatar: null, initials: 'EL' }
    ]

    if (reviews.length <= 1) return

    const interval = setInterval(() => {
      setCurrentReviewIndex((prev) => (prev + 1) % reviews.length)
    }, 1500)

    return () => clearInterval(interval)
  }, [componentId, options.reviews])
  
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
  if (componentId === 'loading') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
        <div className="w-32 h-0.5 bg-gray-200 rounded-full overflow-hidden mb-1">
          <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
        <p className="text-[10px] text-gray-500">Loading...</p>
      </div>
    )
  }

  // Options (Radio Group)
  if (componentId === 'options') {
    const radioOptions = options.options || [
      { id: '1', label: 'Option 1', value: 'option1' },
      { id: '2', label: 'Option 2', value: 'option2' },
      { id: '3', label: 'Option 3', value: 'option3' },
    ]
    
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

  // Instant Radio (Social Icons)
  if (componentId === 'instant_radio') {
    const radioOptions = options.options || [
      { id: 'instagram', label: 'Instagram', value: 'instagram' },
      { id: 'tiktok', label: 'TikTok', value: 'tiktok' },
    ]
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
        <div className="flex-1 px-3 space-y-1">
          {radioOptions.map((option: any, index: number) => (
            <label key={option.id || index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 border border-transparent hover:border-blue-500">
              <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center text-white text-[10px] font-bold">
                {option.label?.[0] || '?'}
              </div>
              <span className="text-xs font-medium text-gray-900 flex-1">{option.label || option.value}</span>
              <input type="radio" name="instant-radio" className="w-3 h-3 text-blue-500" />
            </label>
          ))}
        </div>
      </div>
    )
  }

  // Name Input
  if (componentId === 'name_input') {
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
            type="text"
            placeholder={options.placeholder || 'Enter your name'}
            className="w-full h-8 px-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-xs"
          />
        </div>
      </div>
    )
  }

  // Username Input
  if (componentId === 'username_input') {
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
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">@</span>
            <input
              type="text"
              placeholder={options.placeholder || 'Enter your username'}
              className="w-full h-8 pl-5 pr-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-xs"
            />
          </div>
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

  // Profile Image Upload
  if (componentId === 'profile_image') {
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
        <div className="flex-1 px-3 flex items-center justify-center">
          <div className="w-20 h-20 border border-dashed border-gray-300 rounded-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="text-xl mb-1">📷</div>
              <p className="text-[10px] text-gray-500">Tap to upload</p>
            </div>
          </div>
        </div>
        {options.skipable && (
          <div className="px-3 pb-2">
            <button className="w-full text-xs text-gray-500 py-1">Skip</button>
          </div>
        )}
      </div>
    )
  }

  // Frequency Slider
  if (componentId === 'frequency_slider') {
    const stepLabels = options.stepLabels || ['1x', '2x', '3x', '4x', '5x']
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
        <div className="flex-1 px-3 flex flex-col justify-center">
          <div className="relative">
            <input
              type="range"
              min={options.min || 1}
              max={options.max || 5}
              defaultValue="3"
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between mt-1">
              {stepLabels.map((label: string, i: number) => (
                <span key={i} className="text-[10px] text-gray-500">{label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Satisfaction Slider
  if (componentId === 'satisfaction_slider') {
    const stepLabels = options.stepLabels || ['Awful', 'Not great', 'Okay', 'Good', 'Amazing']
    const markerLabels = options.markerLabels || ['😡', '😕', '😐', '🙂', '🤩']
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
        <div className="flex-1 px-3 flex flex-col justify-center">
          <div className="relative">
            <input
              type="range"
              min={options.min || 1}
              max={options.max || 5}
              defaultValue="3"
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between mt-1">
              {markerLabels.map((emoji: string, i: number) => (
                <span key={i} className="text-sm">{emoji}</span>
              ))}
            </div>
            <div className="flex justify-between mt-0.5">
              {stepLabels.map((label: string, i: number) => (
                <span key={i} className="text-[8px] text-gray-500">{label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Testimonial Loader
  if (componentId === 'testimonial_loader') {
    const CIRCLE_RADIUS = 70
    const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS // ~439.82

    // Mock reviews data
    const reviews = options.reviews || [
      {
        id: '1',
        author: 'Sarah M.',
        text: 'This app changed my life! The personalized experience is incredible.',
        rating: 5,
        avatar: null,
        initials: 'SM'
      },
      {
        id: '2',
        author: 'John D.',
        text: 'Best dating app I\'ve ever used. Highly recommend!',
        rating: 5,
        avatar: null,
        initials: 'JD'
      },
      {
        id: '3',
        author: 'Emma L.',
        text: 'Love how it adapts to my preferences. So intuitive!',
        rating: 5,
        avatar: null,
        initials: 'EL'
      }
    ]

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

  // Quiz Results
  if (componentId === 'quiz_results') {
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
        <div className="flex-1 px-3 flex flex-col justify-center space-y-2">
          <div>
            <div className="flex justify-between text-[10px] text-gray-600 mb-0.5">
              <span>Current</span>
              <span>40%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gray-400 rounded-full" style={{ width: '40%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-gray-600 mb-0.5">
              <span>Potential</span>
              <span>85%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '85%' }}></div>
            </div>
          </div>
          <div className="text-center mt-2">
            <p className="text-xs font-bold text-blue-500">+45% Improvement</p>
          </div>
        </div>
      </div>
    )
  }

  // Rate App (Blurred)
  if (componentId === 'rate_app_blurred') {
    return (
      <div className="w-full h-full flex flex-col bg-white relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 opacity-20 blur-sm"></div>
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-3">
          <div className="text-2xl mb-2">⭐</div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">{title || 'Rate Us'}</h3>
          <div className="flex gap-0.5 mb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="text-lg text-yellow-400">★</span>
            ))}
          </div>
          <p className="text-xs text-gray-600 text-center mb-2">4.8 • 1,234 reviews</p>
          <button className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity">
            Rate App
          </button>
        </div>
      </div>
    )
  }

  // Rate App (Default)
  if (componentId === 'rate_app_default') {
    return (
      <div className="w-full h-full flex flex-col bg-white">
        <div className="flex flex-col items-center justify-center flex-1 px-3">
          <div className="text-2xl mb-2">⭐</div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">{title || 'Rate Us'}</h3>
          <div className="flex gap-0.5 mb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="text-lg text-yellow-400">★</span>
            ))}
          </div>
          <p className="text-xs text-gray-600 text-center mb-2">4.8 • 1,234 reviews</p>
          <button className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity mb-1">
            Rate App
          </button>
          <button className="w-full h-8 bg-[#FF5252] border-[3px] border-black rounded-[30px] font-black text-black text-sm hover:opacity-90 transition-opacity">
            Next
          </button>
        </div>
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
