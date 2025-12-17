'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Switch } from './ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import type { QuizScreen, ConversionScreen } from '@/types/onboarding'
import type { OnboardingComponent } from '@/lib/database/onboarding-components'
import { OnboardingScreenPreview } from './onboarding-screen-preview'
import { Trash2, ArrowLeft, ArrowRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface OnboardingScreenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  screen: QuizScreen | ConversionScreen | null
  screenType: 'quiz' | 'conversion' | null
  onSuccess: () => void
  onDelete?: (id: string, type: 'quiz' | 'conversion') => void
  onScreenTypeChange?: (type: 'quiz' | 'conversion' | null) => void
  existingQuizScreens?: QuizScreen[]
  existingConversionScreens?: ConversionScreen[]
}

export function OnboardingScreenDialog({
  open,
  onOpenChange,
  screen,
  screenType,
  onSuccess,
  onDelete,
  onScreenTypeChange,
  existingQuizScreens = [],
  existingConversionScreens = [],
}: OnboardingScreenDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState('')
  const [orderPosition, setOrderPosition] = useState<number>(0)
  const [eventName, setEventName] = useState('')
  const [shouldShow, setShouldShow] = useState(true)
  const [componentId, setComponentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [availableComponents, setAvailableComponents] = useState<OnboardingComponent[]>([])
  const [loadingComponents, setLoadingComponents] = useState(false)
  const [currentStep, setCurrentStep] = useState<'select' | 'edit'>('select')
  const { toast } = useToast()

  // Fetch available components when dialog opens and screenType is selected
  useEffect(() => {
    if (open && screenType) {
      setLoadingComponents(true)
      fetch(`/api/onboarding/components?category=${screenType}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.components) {
            setAvailableComponents(data.components)
            // Auto-select "options" component and set default options when creating a new screen
            if (!screen && data.components.length > 0) {
              const optionsComponent = data.components.find((c: OnboardingComponent) => c.component_key === 'options')
              if (optionsComponent) {
                setComponentId('options')
                if (optionsComponent.default_options) {
                  setOptions(JSON.stringify(optionsComponent.default_options, null, 2))
                }
              }
            }
          }
        })
        .catch((error) => {
          console.error('Error fetching components:', error)
        })
        .finally(() => {
          setLoadingComponents(false)
        })
    } else {
      setAvailableComponents([])
    }
  }, [open, screenType, screen])

  // Calculate next available order position when creating a new screen
  const calculateNextOrderPosition = (type: 'quiz' | 'conversion' | null): number => {
    if (!type) return 1
    
    // Get screens of the specific type
    const screensOfType = type === 'quiz' ? existingQuizScreens : existingConversionScreens
    
    // Get all order positions for this type, filtering out nulls
    const positions = screensOfType
      .map(s => s.order_position)
      .filter((pos): pos is number => pos !== null && pos !== undefined)
      .sort((a, b) => a - b)
    
    if (positions.length === 0) return 1
    
    // Find the first gap, or return max + 1
    const maxPosition = positions[positions.length - 1]
    
    for (let i = 1; i <= maxPosition; i++) {
      if (!positions.includes(i)) {
        return i
      }
    }
    
    return maxPosition + 1
  }

  useEffect(() => {
    if (screen) {
      // When editing, go directly to edit step
      setCurrentStep('edit')
      setTitle(screen.title || '')
      setDescription(screen.description || '')
      setOptions(JSON.stringify(screen.options || (screenType === 'conversion' ? [] : null), null, 2))
      setOrderPosition(screen.order_position ?? 0)
      setEventName(screen.event_name || (screenType === 'conversion' ? 'step' : ''))
      setShouldShow(screen.should_show ?? true)
      setComponentId(screen.component_id || '')
    } else {
      // When creating, start at select step
      setCurrentStep('select')
      setTitle('')
      setDescription('')
      setOptions(screenType === 'conversion' ? '[]' : '')
      // Auto-calculate order position when creating a new screen
      setOrderPosition(screenType ? calculateNextOrderPosition(screenType) : 1)
      setEventName(screenType === 'conversion' ? 'step' : '')
      setShouldShow(true)
      // Default to "options" component
      setComponentId('options')
    }
  }, [screen, screenType, open, existingQuizScreens, existingConversionScreens])

  const handleContinue = () => {
    if (!componentId) {
      toast({
        title: 'Component Required',
        description: 'Please select a component to continue.',
        variant: 'destructive',
      })
      return
    }
    setCurrentStep('edit')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!screenType) {
      toast({
        title: 'Screen Type Required',
        description: 'Please select a screen type.',
        variant: 'destructive',
      })
      return
    }
    
    setLoading(true)

    try {
      let parsedOptions: any = null
      if (options.trim()) {
        try {
          parsedOptions = JSON.parse(options)
        } catch (error) {
          toast({
            title: 'Invalid JSON',
            description: 'Please check your JSON syntax in the options field.',
            variant: 'destructive',
          })
          setLoading(false)
          return
        }
      } else if (screenType === 'conversion') {
        parsedOptions = []
      }

      const endpoint = screenType === 'quiz'
        ? '/api/onboarding/quiz-screens'
        : '/api/onboarding/conversion-screens'

      const method = screen ? 'PUT' : 'POST'

      const body: any = {
        title: title || null,
        description: description || null,
        options: parsedOptions,
        order_position: orderPosition || null,
        event_name: eventName || null,
        should_show: shouldShow,
        component_id: componentId || null,
      }

      if (screen) {
        body.id = screen.id
      }

      // For conversion screens, title and description are required
      if (screenType === 'conversion' && (!title || !description)) {
        toast({
          title: 'Required Fields',
          description: 'Title and description are required for conversion screens.',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save screen')
      }

      toast({
        title: 'Success',
        description: screen ? 'Screen updated successfully.' : 'Screen created successfully.',
      })

      onSuccess()
      onOpenChange(false)
      setCurrentStep('select') // Reset to select step for next time
    } catch (error) {
      console.error('Error saving screen:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save screen. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Create a preview screen object from current form state (only when screenType is set)
  const previewScreen: QuizScreen | ConversionScreen | null = screenType && componentId
    ? (screen
        ? {
            ...screen,
            title: title || screen.title,
            description: description || screen.description,
            options: (() => {
              try {
                return options.trim() ? JSON.parse(options) : (screenType === 'conversion' ? [] : null)
              } catch {
                return screen.options
              }
            })(),
            component_id: componentId || screen.component_id,
            order_position: orderPosition || screen.order_position,
          }
        : ({
            id: '',
            title: title || 'Preview Title',
            description: description || 'Preview description text',
            options: (() => {
              try {
                return options.trim() ? JSON.parse(options) : (screenType === 'conversion' ? [] : null)
              } catch {
                return screenType === 'conversion' ? [] : null
              }
            })(),
            order_position: orderPosition || null,
            created_at: null,
            event_name: eventName || null,
            should_show: shouldShow,
            component_id: componentId || null,
          } as QuizScreen | ConversionScreen))
    : null

  // Calculate total screens for progress bar
  const totalScreens = screenType === 'quiz' ? existingQuizScreens.length + 1 : existingConversionScreens.length + 1

  const selectedComponent = availableComponents.find(c => c.component_key === componentId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {screen ? 'Edit' : currentStep === 'select' ? 'Select Component' : 'Configure Screen'} {screenType === 'quiz' ? 'Quiz' : screenType === 'conversion' ? 'Conversion' : ''} Screen
          </DialogTitle>
          <DialogDescription>
            {screen
              ? 'Update the screen details below.'
              : currentStep === 'select'
              ? 'Choose a component for your screen and preview it.'
              : 'Configure the screen details below.'}
          </DialogDescription>
        </DialogHeader>
        
        {currentStep === 'select' && !screen && screenType && (
          <div className="flex gap-6 flex-1 overflow-hidden">
            {/* Component Selection */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {/* Screen Type Toggle */}
              <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (onScreenTypeChange) {
                      onScreenTypeChange('quiz')
                    }
                  }}
                  className={`h-8 px-4 transition-all ${
                    screenType === 'quiz'
                      ? 'bg-white text-gray-900 font-semibold shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Quiz Screen
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (onScreenTypeChange) {
                      onScreenTypeChange('conversion')
                    }
                  }}
                  className={`h-8 px-4 transition-all ${
                    screenType === 'conversion'
                      ? 'bg-white text-gray-900 font-semibold shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Conversion Screen
                </Button>
              </div>

              {/* Component Selector */}
              <div className="space-y-3">
                <Label>Component <span className="text-red-500">*</span></Label>
                {loadingComponents ? (
                  <div className="p-4 text-center text-sm text-gray-500">Loading components...</div>
                ) : availableComponents.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">No components available. Add components to the database first.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2">
                    {/* Component Options */}
                    {availableComponents.map((component) => (
                      <Button
                        key={component.id}
                        type="button"
                        variant={componentId === component.component_key ? "default" : "outline"}
                        className={`h-auto p-4 justify-start text-left ${
                          componentId === component.component_key
                            ? 'bg-gray-900 text-white hover:bg-gray-800'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          setComponentId(component.component_key)
                          if (component.default_options) {
                            setOptions(JSON.stringify(component.default_options, null, 2))
                          }
                        }}
                      >
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium">{component.component_name}</span>
                          {component.description && (
                            <span className={`text-xs ${
                              componentId === component.component_key ? 'opacity-80' : 'text-gray-600'
                            }`}>
                              {component.description}
                            </span>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Preview Section */}
            {screenType && componentId && (
              <div className="flex-shrink-0 flex flex-col items-center gap-3 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview</h3>
                <div className="relative">
                  {/* Phone Frame */}
                  <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl">
                    {/* Screen */}
                    <div className="bg-white rounded-[2rem] overflow-hidden w-[200px] h-[400px] relative" style={{ aspectRatio: '9/16' }}>
                      {/* Dynamic Island / Notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-[1.75rem] z-10"></div>
                      
                      {/* Status Bar */}
                      <div className="absolute top-0 left-0 right-0 h-8 bg-white flex items-center justify-between px-3 pt-1 z-20">
                        <span className="text-[10px] font-semibold text-black ml-2">9:41</span>
                        <div className="flex items-center gap-1.5 mr-2">
                          <div className="w-5 h-2.5 bg-black rounded-full border border-white relative">
                            <div className="absolute left-0.5 top-0.5 w-3 h-1.5 bg-black rounded-full"></div>
                          </div>
                          <div className="w-5 h-2.5 bg-white rounded-full border border-black relative">
                            <div className="absolute left-0.5 top-0.5 w-3 h-1.5 bg-white rounded-full"></div>
                          </div>
                        </div>
                      </div>

                      {/* Screen Content */}
                      <div className="w-full h-full overflow-hidden">
                        {previewScreen && (
                          <OnboardingScreenPreview screen={previewScreen} totalScreens={totalScreens} />
                        )}
                      </div>

                      {/* Home Indicator */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-black rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 'edit' && screenType && (
          <div className="flex gap-6 flex-1 overflow-hidden">
            {/* Form Section */}
            <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-2">
              {!screen && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep('select')}
                  className="mb-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Component Selection
                </Button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Title {screenType === 'conversion' && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Screen title"
                    required={screenType === 'conversion'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order_position">Order Position</Label>
                  <Input
                    id="order_position"
                    type="number"
                    value={orderPosition}
                    onChange={(e) => setOrderPosition(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    disabled={!screen}
                    readOnly={!screen}
                    className={!screen ? 'bg-gray-50 cursor-not-allowed' : ''}
                  />
                  {!screen && (
                    <p className="text-xs text-gray-500">
                      Automatically set to the lowest available number
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Description {screenType === 'conversion' && <span className="text-red-500">*</span>}
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Screen description"
                  rows={3}
                  required={screenType === 'conversion'}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="event_name">Event Name</Label>
                  <Input
                    id="event_name"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder={screenType === 'conversion' ? 'step' : 'event name'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="component_id">Component</Label>
                  <Select
                    value={componentId || ''}
                    onValueChange={(value) => {
                      setComponentId(value)
                      const selectedComponent = availableComponents.find(c => c.component_key === value)
                      if (selectedComponent?.default_options) {
                        setOptions(JSON.stringify(selectedComponent.default_options, null, 2))
                      }
                    }}
                  >
                    <SelectTrigger id="component_id">
                      <SelectValue placeholder="Select a component" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingComponents ? (
                        <div className="px-2 py-1.5 text-sm text-gray-500">Loading components...</div>
                      ) : availableComponents.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-gray-500">No components available.</div>
                      ) : (
                        availableComponents.map((component) => (
                          <SelectItem key={component.id} value={component.component_key}>
                            {component.component_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {componentId && (
                    <p className="text-xs text-gray-500">
                      {availableComponents.find(c => c.component_key === componentId)?.description || ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="options">Options (JSON)</Label>
                <Textarea
                  id="options"
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  placeholder={screenType === 'conversion' ? '[]' : '{} or null'}
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  Enter valid JSON. For conversion screens, default is empty array [].
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="should_show"
                  checked={shouldShow}
                  onCheckedChange={setShouldShow}
                />
                <Label htmlFor="should_show" className="cursor-pointer">
                  Show this screen
                </Label>
              </div>

              <DialogFooter className="flex items-center justify-between">
                <div>
                  {screen && onDelete && screenType && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this screen? This action cannot be undone.')) {
                          onDelete(screen.id, screenType)
                          onOpenChange(false)
                        }
                      }}
                      disabled={loading}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || !screenType}>
                    {loading ? 'Saving...' : screen ? 'Update' : 'Create'}
                  </Button>
                </div>
              </DialogFooter>
            </form>

            {/* Preview Section */}
            {screenType && (
              <div className="flex-shrink-0 flex flex-col items-center gap-3 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview</h3>
                <div className="relative">
                  {/* Phone Frame */}
                  <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl">
                    {/* Screen */}
                    <div className="bg-white rounded-[2rem] overflow-hidden w-[200px] h-[400px] relative" style={{ aspectRatio: '9/16' }}>
                      {/* Dynamic Island / Notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-[1.75rem] z-10"></div>
                      
                      {/* Status Bar */}
                      <div className="absolute top-0 left-0 right-0 h-8 bg-white flex items-center justify-between px-3 pt-1 z-20">
                        <span className="text-[10px] font-semibold text-black ml-2">9:41</span>
                        <div className="flex items-center gap-1.5 mr-2">
                          <div className="w-5 h-2.5 bg-black rounded-full border border-white relative">
                            <div className="absolute left-0.5 top-0.5 w-3 h-1.5 bg-black rounded-full"></div>
                          </div>
                          <div className="w-5 h-2.5 bg-white rounded-full border border-black relative">
                            <div className="absolute left-0.5 top-0.5 w-3 h-1.5 bg-white rounded-full"></div>
                          </div>
                        </div>
                      </div>

                      {/* Screen Content */}
                      <div className="w-full h-full overflow-hidden">
                        {previewScreen && (
                          <OnboardingScreenPreview screen={previewScreen} totalScreens={totalScreens} />
                        )}
                      </div>

                      {/* Home Indicator */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-black rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer for Select Step */}
        {currentStep === 'select' && !screen && (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleContinue}
              disabled={!screenType}
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
