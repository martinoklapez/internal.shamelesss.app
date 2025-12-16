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
import { Trash2 } from 'lucide-react'

interface OnboardingScreenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  screen: QuizScreen | ConversionScreen | null
  screenType: 'quiz' | 'conversion'
  onSuccess: () => void
  onDelete?: (id: string, type: 'quiz' | 'conversion') => void
}

export function OnboardingScreenDialog({
  open,
  onOpenChange,
  screen,
  screenType,
  onSuccess,
  onDelete,
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

  // Fetch available components when dialog opens
  useEffect(() => {
    if (open) {
      setLoadingComponents(true)
      fetch(`/api/onboarding/components?category=${screenType}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.components) {
            setAvailableComponents(data.components)
          }
        })
        .catch((error) => {
          console.error('Error fetching components:', error)
        })
        .finally(() => {
          setLoadingComponents(false)
        })
    }
  }, [open, screenType])

  useEffect(() => {
    if (screen) {
      setTitle(screen.title || '')
      setDescription(screen.description || '')
      setOptions(JSON.stringify(screen.options || (screenType === 'conversion' ? [] : null), null, 2))
      setOrderPosition(screen.order_position ?? 0)
      setEventName(screen.event_name || (screenType === 'conversion' ? 'step' : ''))
      setShouldShow(screen.should_show ?? true)
      setComponentId(screen.component_id || '')
    } else {
      setTitle('')
      setDescription('')
      setOptions(screenType === 'conversion' ? '[]' : '')
      setOrderPosition(0)
      setEventName(screenType === 'conversion' ? 'step' : '')
      setShouldShow(true)
      setComponentId('')
    }
  }, [screen, screenType, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let parsedOptions: any = null
      if (options.trim()) {
        try {
          parsedOptions = JSON.parse(options)
        } catch (error) {
          alert('Invalid JSON in options field. Please check your syntax.')
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
        alert('Title and description are required for conversion screens.')
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

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving screen:', error)
      alert(error instanceof Error ? error.message : 'Failed to save screen. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Create a preview screen object from current form state
  const previewScreen: QuizScreen | ConversionScreen = screen
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
        title: title || null,
        description: description || null,
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
      } as QuizScreen | ConversionScreen)

  // Calculate total screens for progress bar
  const totalScreens = screenType === 'quiz' ? 10 : 5 // Approximate, could be improved

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {screen ? 'Edit' : 'Add'} {screenType === 'quiz' ? 'Quiz' : 'Conversion'} Screen
          </DialogTitle>
          <DialogDescription>
            {screen
              ? 'Update the screen details below.'
              : `Create a new ${screenType === 'quiz' ? 'quiz' : 'conversion'} screen.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-6 flex-1 overflow-hidden">
          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-2">
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
              />
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
                value={componentId || '__none__'}
                onValueChange={(value) => {
                  // Convert special "__none__" value to empty string
                  const actualValue = value === '__none__' ? '' : value
                  setComponentId(actualValue)
                  // Auto-fill options with default_options if available
                  if (actualValue) {
                    const selectedComponent = availableComponents.find(c => c.component_key === actualValue)
                    if (selectedComponent?.default_options) {
                      setOptions(JSON.stringify(selectedComponent.default_options, null, 2))
                    }
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
                    <div className="px-2 py-1.5 text-sm text-gray-500">No components available. Add components to the database first.</div>
                  ) : (
                    <>
                      <SelectItem value="__none__">None (Custom)</SelectItem>
                      {availableComponents.map((component) => (
                        <SelectItem key={component.id} value={component.component_key}>
                          {component.component_name}
                        </SelectItem>
                      ))}
                    </>
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
                {screen && onDelete && (
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
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : screen ? 'Update' : 'Create'}
                </Button>
              </div>
            </DialogFooter>
          </form>

          {/* Preview Section */}
          <div className="flex-shrink-0 flex flex-col items-center gap-3 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview</h3>
            <div className="relative">
              {/* Phone Frame */}
              <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl">
                {/* Screen */}
                <div className="bg-white rounded-[2rem] overflow-hidden w-[200px] h-[400px] relative" style={{ aspectRatio: '9/16' }}>
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-10"></div>
                  
                  {/* Status Bar */}
                  <div className="absolute top-0 left-0 right-0 h-8 bg-white flex items-center justify-between px-4 pt-1 z-20">
                    <span className="text-[10px] font-semibold text-black">9:41</span>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-2 border border-black rounded-sm">
                        <div className="w-3 h-1.5 bg-black rounded-sm m-0.5"></div>
                      </div>
                      <div className="w-4 h-2 border border-black rounded-sm">
                        <div className="w-2 h-1 bg-black rounded-sm m-0.5"></div>
                      </div>
                    </div>
                  </div>

                  {/* Screen Content */}
                  <div className="w-full h-full overflow-hidden">
                    <OnboardingScreenPreview screen={previewScreen} totalScreens={totalScreens} />
                  </div>

                  {/* Home Indicator */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-black rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

