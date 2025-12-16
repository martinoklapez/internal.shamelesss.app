'use client'

import { useState } from 'react'
import type { QuizScreen, ConversionScreen } from '@/types/onboarding'

interface ScreenPreviewProps {
  screen: QuizScreen | ConversionScreen
  totalScreens?: number
}

export function OnboardingScreenPreview({ screen, totalScreens }: ScreenPreviewProps) {
  // Move useState to top level (required by React Hooks rules)
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  
  const componentId = screen.component_id
  const options = screen.options || {}
  const title = screen.title || ''
  const description = screen.description || ''
  
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
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <div className="bg-gray-50 rounded-lg p-2 max-w-[80%]">
          <p className="text-xs text-gray-700 italic mb-1">&ldquo;This app changed my life!&rdquo;</p>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
            <div>
              <p className="text-[10px] font-medium text-gray-900">John Doe</p>
              <p className="text-[8px] text-gray-500">Verified User</p>
            </div>
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

