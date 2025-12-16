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
import type { QuizScreen, ConversionScreen } from '@/types/onboarding'

interface OnboardingScreenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  screen: QuizScreen | ConversionScreen | null
  screenType: 'quiz' | 'conversion'
  onSuccess: () => void
}

export function OnboardingScreenDialog({
  open,
  onOpenChange,
  screen,
  screenType,
  onSuccess,
}: OnboardingScreenDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState('')
  const [orderPosition, setOrderPosition] = useState<number>(0)
  const [eventName, setEventName] = useState('')
  const [shouldShow, setShouldShow] = useState(true)
  const [componentId, setComponentId] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="component_id">Component ID</Label>
              <Input
                id="component_id"
                value={componentId}
                onChange={(e) => setComponentId(e.target.value)}
                placeholder="component_id"
              />
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

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

