'use client'

import { useState, useEffect, useCallback } from 'react'
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
import {
  isAllowedQuizComponent,
  isAllowedConversionComponent,
} from '@/lib/onboarding-component-ids'
import {
  finalizePushMockupForSave,
  getMockupTypeForNotificationType,
} from '@/lib/push-permission-mockup'
import {
  emptyDataConsentRow,
  parseDataConsentsOptionsJson,
  serializeDataConsentsOptions,
  type DataConsentEditorRow,
} from '@/lib/data-consents-options'
import { OnboardingScreenPreview } from './onboarding-screen-preview'
import { Trash2, ArrowLeft, ArrowRight, Plus, Pencil, X, Play } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAppDialogs } from '@/components/app-dialogs-provider'

const DEFAULT_PUSH_NOTIFICATION_OPTIONS = {
  mockup_type: 'user-avatar' as const,
  display_name: '',
  title: "You've caught someone's eye 👀",
  body: '{name} wants to connect!',
}

type PushNotifMockupType = 'user-avatar' | 'app-icon'

type DemoUserRow = {
  id: string
  name: string | null
  username: string | null
  profile_picture_url: string | null
  email: string | null
  role: string | null
}

type PushNotifContentTemplateRow = {
  notification_type: string
  title_template: string
  body_template: string
}

/** `__custom__` = not tied to notification_content_templates */
const PUSH_NOTIF_CUSTOM_KEY = '__custom__' as const

function buildPushNotificationOptionsJson(params: {
  templateKey: string
  mockup_type: PushNotifMockupType
  display_name: string
  title: string
  body: string
  demo_user_id: string
  demoUsers: DemoUserRow[]
}): string {
  const profile_image_url = params.demo_user_id.trim()
    ? params.demoUsers.find((u) => u.id === params.demo_user_id.trim())?.profile_picture_url?.trim() ?? ''
    : ''
  const template_source =
    params.templateKey === PUSH_NOTIF_CUSTOM_KEY ? 'custom' : 'notification_template'
  const o: Record<string, string> = {
    template_source,
    mockup_type: params.mockup_type,
    display_name: params.display_name.trim(),
    profile_image_url,
    title: params.title.trim(),
    body: params.body.trim(),
  }
  if (template_source === 'notification_template' && params.templateKey !== PUSH_NOTIF_CUSTOM_KEY) {
    o.notification_type = params.templateKey
  }
  if (params.demo_user_id.trim()) {
    o.demo_user_id = params.demo_user_id.trim()
  }
  return JSON.stringify(o, null, 2)
}

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
  /** When set, open in edit step with this component pre-selected (e.g. from gallery) */
  initialComponentId?: string | null
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
  initialComponentId = null,
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
  const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null)
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [newOptionValue, setNewOptionValue] = useState('')
  const [showJsonView, setShowJsonView] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const { toast } = useToast()
  const { confirm } = useAppDialogs()

  // ScratchDates Preview: positions list + image source (position picker or custom URL)
  const [scratchDatesPositions, setScratchDatesPositions] = useState<Array<{ id: string; name: string; image_url: string }>>([])
  const [scratchDatesPositionsLoading, setScratchDatesPositionsLoading] = useState(false)
  const [scratchDatesImageSource, setScratchDatesImageSource] = useState<'position' | 'custom'>('position')
  const [scratchDatesSelectedPositionId, setScratchDatesSelectedPositionId] = useState<string>('')
  const [scratchDatesCustomUrl, setScratchDatesCustomUrl] = useState('')
  const [scratchDatesTitle, setScratchDatesTitle] = useState('')

  // Push notification permission: notification mockup JSON + demo user picker
  const [pushNotifMockupType, setPushNotifMockupType] = useState<PushNotifMockupType>('user-avatar')
  const [pushNotifDisplayName, setPushNotifDisplayName] = useState('')
  const [pushNotifNotifTitle, setPushNotifNotifTitle] = useState(DEFAULT_PUSH_NOTIFICATION_OPTIONS.title)
  const [pushNotifBody, setPushNotifBody] = useState(DEFAULT_PUSH_NOTIFICATION_OPTIONS.body)
  const [pushNotifDemoUserId, setPushNotifDemoUserId] = useState('')
  const [pushNotifDemoUsers, setPushNotifDemoUsers] = useState<DemoUserRow[]>([])
  const [pushNotifDemoUsersLoading, setPushNotifDemoUsersLoading] = useState(false)
  const [pushNotifTemplateKey, setPushNotifTemplateKey] = useState<string>(PUSH_NOTIF_CUSTOM_KEY)
  const [pushNotifContentTemplates, setPushNotifContentTemplates] = useState<PushNotifContentTemplateRow[]>([])
  const [pushNotifTemplatesLoading, setPushNotifTemplatesLoading] = useState(false)

  const [dataConsentsRows, setDataConsentsRows] = useState<DataConsentEditorRow[]>([emptyDataConsentRow()])
  const [dataConsentsAcceptAll, setDataConsentsAcceptAll] = useState('Accept All')
  const [dataConsentsNext, setDataConsentsNext] = useState('Next')
  const [dataConsentsJsonMode, setDataConsentsJsonMode] = useState(false)

  // Check if options is an array of objects with label/value structure
  const isOptionsArray = (): boolean => {
    try {
      const parsed = options.trim() ? JSON.parse(options) : null
      return (
        Array.isArray(parsed) &&
        parsed.every((item: any) => 
          typeof item === 'object' && 
          item !== null && 
          'label' in item && 
          'value' in item
        )
      )
    } catch {
      return false
    }
  }

  // Get parsed options array
  const getOptionsArray = (): Array<{ label: string; value: string }> => {
    try {
      const parsed = options.trim() ? JSON.parse(options) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  // Update options from array
  const updateOptionsFromArray = (arr: Array<{ label: string; value: string }>) => {
    setOptions(JSON.stringify(arr, null, 2))
  }

  // Add new option
  const handleAddOption = () => {
    if (!newOptionLabel.trim() || !newOptionValue.trim()) {
      toast({
        title: 'Invalid Option',
        description: 'Both label and value are required.',
        variant: 'destructive',
      })
      return
    }
    const currentOptions = getOptionsArray()
    updateOptionsFromArray([...currentOptions, { label: newOptionLabel, value: newOptionValue }])
    setNewOptionLabel('')
    setNewOptionValue('')
  }

  // Update existing option
  const handleUpdateOption = (index: number, label: string, value: string) => {
    if (!label.trim() || !value.trim()) {
      toast({
        title: 'Invalid Option',
        description: 'Both label and value are required.',
        variant: 'destructive',
      })
      return
    }
    const currentOptions = getOptionsArray()
    currentOptions[index] = { label, value }
    updateOptionsFromArray(currentOptions)
    setEditingOptionIndex(null)
  }

  // Delete option
  const handleDeleteOption = (index: number) => {
    const currentOptions = getOptionsArray()
    updateOptionsFromArray(currentOptions.filter((_, i) => i !== index))
  }

  // Fetch ScratchDates positions when dialog is open and component is scratchdates_preview
  useEffect(() => {
    if (!open || componentId !== 'scratchdates_preview') return
    setScratchDatesPositionsLoading(true)
    fetch('/api/onboarding/scratch-dates-positions')
      .then((res) => res.json())
      .then((data) => {
        if (data.positions) setScratchDatesPositions(data.positions)
      })
      .catch(() => toast({ title: 'Could not load ScratchDates positions', variant: 'destructive' }))
      .finally(() => setScratchDatesPositionsLoading(false))
  }, [open, componentId, toast])

  // Sync options -> ScratchDates local state when component is scratchdates_preview (e.g. when editing or switching component)
  useEffect(() => {
    if (componentId !== 'scratchdates_preview') return
    try {
      const parsed = options.trim() ? JSON.parse(options) : {}
      const imageUrl = typeof parsed.image_url === 'string' ? parsed.image_url : ''
      const titleVal = typeof parsed.title === 'string' ? parsed.title : ''
      setScratchDatesTitle(titleVal)
      const match = scratchDatesPositions.find((p) => p.image_url === imageUrl)
      if (match) {
        setScratchDatesImageSource('position')
        setScratchDatesSelectedPositionId(match.id)
        setScratchDatesCustomUrl('')
      } else {
        setScratchDatesImageSource('custom')
        setScratchDatesSelectedPositionId('')
        setScratchDatesCustomUrl(imageUrl)
      }
    } catch {
      setScratchDatesImageSource('custom')
      setScratchDatesSelectedPositionId('')
      setScratchDatesCustomUrl('')
      setScratchDatesTitle('')
    }
  }, [componentId, options, scratchDatesPositions])

  // Load demo-role users for push_notification_permission mockup
  useEffect(() => {
    if (!open || componentId !== 'push_notification_permission') return
    setPushNotifDemoUsersLoading(true)
    fetch('/api/users/list?demo_only=true')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.users)) setPushNotifDemoUsers(data.users as DemoUserRow[])
      })
      .catch(() => toast({ title: 'Could not load demo users', variant: 'destructive' }))
      .finally(() => setPushNotifDemoUsersLoading(false))
  }, [open, componentId, toast])

  // Load notification_content_templates for push mockup picker
  useEffect(() => {
    if (!open || componentId !== 'push_notification_permission') return
    setPushNotifTemplatesLoading(true)
    fetch('/api/notification-templates')
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) return
        const list = Array.isArray(data) ? data : data?.templates
        if (Array.isArray(list)) {
          setPushNotifContentTemplates(
            list.filter(
              (row: unknown): row is PushNotifContentTemplateRow =>
                !!row &&
                typeof row === 'object' &&
                typeof (row as PushNotifContentTemplateRow).notification_type === 'string'
            )
          )
        }
      })
      .catch(() => toast({ title: 'Could not load notification templates', variant: 'destructive' }))
      .finally(() => setPushNotifTemplatesLoading(false))
  }, [open, componentId, toast])

  // Sync options JSON -> push notification form fields
  useEffect(() => {
    if (componentId !== 'push_notification_permission') return
    try {
      const raw = options.trim()
      const parsed = raw ? JSON.parse(raw) : {}
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid')
      }
      const keys = Object.keys(parsed as object)
      if (keys.length === 0) {
        setPushNotifTemplateKey(PUSH_NOTIF_CUSTOM_KEY)
        setPushNotifMockupType(DEFAULT_PUSH_NOTIFICATION_OPTIONS.mockup_type)
        setPushNotifDisplayName(DEFAULT_PUSH_NOTIFICATION_OPTIONS.display_name)
        setPushNotifNotifTitle(DEFAULT_PUSH_NOTIFICATION_OPTIONS.title)
        setPushNotifBody(DEFAULT_PUSH_NOTIFICATION_OPTIONS.body)
        setPushNotifDemoUserId('')
        setOptions(
          buildPushNotificationOptionsJson({
            templateKey: PUSH_NOTIF_CUSTOM_KEY,
            mockup_type: DEFAULT_PUSH_NOTIFICATION_OPTIONS.mockup_type,
            display_name: '',
            title: DEFAULT_PUSH_NOTIFICATION_OPTIONS.title,
            body: DEFAULT_PUSH_NOTIFICATION_OPTIONS.body,
            demo_user_id: '',
            demoUsers: pushNotifDemoUsers,
          })
        )
        return
      }
      const p = parsed as Record<string, unknown>
      const nt = typeof p.notification_type === 'string' ? p.notification_type.trim() : ''
      const templateKey =
        p.template_source === 'notification_template' && nt ? nt : PUSH_NOTIF_CUSTOM_KEY
      const mockupFromJson = p.mockup_type === 'app-icon' ? 'app-icon' : 'user-avatar'
      const mockup_type =
        templateKey === PUSH_NOTIF_CUSTOM_KEY
          ? mockupFromJson
          : getMockupTypeForNotificationType(templateKey)
      const display_name = typeof p.display_name === 'string' ? p.display_name : ''
      const notifTitle = typeof p.title === 'string' ? p.title : DEFAULT_PUSH_NOTIFICATION_OPTIONS.title
      const notifBody = typeof p.body === 'string' ? p.body : DEFAULT_PUSH_NOTIFICATION_OPTIONS.body
      const demo_user_id = typeof p.demo_user_id === 'string' ? p.demo_user_id : ''
      setPushNotifTemplateKey(templateKey)
      setPushNotifMockupType(mockup_type)
      setPushNotifDisplayName(display_name)
      setPushNotifNotifTitle(notifTitle)
      setPushNotifBody(notifBody)
      setPushNotifDemoUserId(demo_user_id)
      setOptions(
        buildPushNotificationOptionsJson({
          templateKey,
          mockup_type,
          display_name,
          title: notifTitle,
          body: notifBody,
          demo_user_id,
          demoUsers: pushNotifDemoUsers,
        })
      )
    } catch {
      setPushNotifTemplateKey(PUSH_NOTIF_CUSTOM_KEY)
      setPushNotifMockupType('user-avatar')
      setPushNotifDisplayName('')
      setPushNotifNotifTitle(DEFAULT_PUSH_NOTIFICATION_OPTIONS.title)
      setPushNotifBody(DEFAULT_PUSH_NOTIFICATION_OPTIONS.body)
      setPushNotifDemoUserId('')
      setOptions(
        buildPushNotificationOptionsJson({
          templateKey: PUSH_NOTIF_CUSTOM_KEY,
          mockup_type: DEFAULT_PUSH_NOTIFICATION_OPTIONS.mockup_type,
          display_name: '',
          title: DEFAULT_PUSH_NOTIFICATION_OPTIONS.title,
          body: DEFAULT_PUSH_NOTIFICATION_OPTIONS.body,
          demo_user_id: '',
          demoUsers: pushNotifDemoUsers,
        })
      )
    }
  }, [componentId, options, pushNotifDemoUsers])

  // data_consents: keep form rows in sync with options JSON (visual mode only)
  useEffect(() => {
    if (componentId !== 'data_consents' || dataConsentsJsonMode) return
    const parsed = parseDataConsentsOptionsJson(options)
    setDataConsentsRows(parsed.rows.length ? parsed.rows : [emptyDataConsentRow()])
    setDataConsentsAcceptAll(parsed.acceptAllLabel)
    setDataConsentsNext(parsed.nextButtonLabel)
  }, [componentId, options, dataConsentsJsonMode])

  // Fetch available components when dialog opens and screenType is selected
  useEffect(() => {
    if (open && screenType) {
      setLoadingComponents(true)
      fetch(`/api/onboarding/components?category=${screenType}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.components) {
            setAvailableComponents(data.components)
            if (!screen && data.components.length > 0) {
              if (initialComponentId) {
                const comp = data.components.find((c: OnboardingComponent) => c.component_key === initialComponentId)
                setComponentId(initialComponentId)
                setCurrentStep('edit')
                if (comp) {
                  setTitle(comp.component_name || '')
                  setDescription(comp.description || '')
                  if (comp.default_options) {
                    setOptions(JSON.stringify(comp.default_options, null, 2))
                    setShowJsonView(false)
                  }
                }
              } else {
                const optionsComponent = data.components.find((c: OnboardingComponent) => c.component_key === 'options')
                if (optionsComponent) {
                  setComponentId('options')
                  if (optionsComponent.default_options) {
                    setOptions(JSON.stringify(optionsComponent.default_options, null, 2))
                    setShowJsonView(false)
                  }
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
  }, [open, screenType, screen, initialComponentId])

  // Calculate next available order position when creating a new screen
  const calculateNextOrderPosition = useCallback((type: 'quiz' | 'conversion' | null): number => {
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
  }, [existingQuizScreens, existingConversionScreens])

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
      setShowJsonView(false)
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
      setShowJsonView(false)
      // Default to "options" component
      setComponentId('options')
    }
  }, [screen, screenType, open, existingQuizScreens, existingConversionScreens, calculateNextOrderPosition])

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

    if (componentId) {
      if (screenType === 'quiz' && !isAllowedQuizComponent(componentId)) {
        toast({
          title: 'Wrong funnel for this component',
          description:
            `"${componentId}" is conversion-only (e.g. push notification permission, profile fields). Open the conversion funnel on the onboarding page, add or edit the screen there, or choose a quiz component.`,
          variant: 'destructive',
        })
        return
      }
      if (screenType === 'conversion' && !isAllowedConversionComponent(componentId)) {
        toast({
          title: 'Wrong funnel for this component',
          description: `"${componentId}" is not allowed on conversion screens (e.g. rate_app is quiz-only). Pick another component.`,
          variant: 'destructive',
        })
        return
      }
    }

    setLoading(true)

    try {
      let parsedOptions: any = null

      if (componentId === 'data_consents') {
        if (dataConsentsJsonMode) {
          try {
            const raw = options.trim()
            parsedOptions = raw ? JSON.parse(raw) : {}
          } catch {
            toast({
              title: 'Invalid JSON',
              description: 'Fix the options JSON or switch back to the form editor.',
              variant: 'destructive',
            })
            setLoading(false)
            return
          }
          if (!parsedOptions || typeof parsedOptions !== 'object' || Array.isArray(parsedOptions)) {
            toast({
              title: 'Invalid data consents options',
              description: 'options must be a JSON object with consents (or items), not a top-level array.',
              variant: 'destructive',
            })
            setLoading(false)
            return
          }
        } else {
          parsedOptions = JSON.parse(
            serializeDataConsentsOptions(dataConsentsRows, dataConsentsAcceptAll, dataConsentsNext)
          )
        }
        const list = Array.isArray(parsedOptions.consents)
          ? parsedOptions.consents
          : Array.isArray(parsedOptions.items)
            ? parsedOptions.items
            : []
        const hasTitledConsent = list.some(
          (c: unknown) =>
            c &&
            typeof c === 'object' &&
            typeof (c as { title?: string }).title === 'string' &&
            (c as { title: string }).title.trim().length > 0
        )
        if (!hasTitledConsent) {
          toast({
            title: 'Consents required',
            description: 'Add at least one consent with a non-empty title.',
            variant: 'destructive',
          })
          setLoading(false)
          return
        }
      } else if (options.trim()) {
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

      if (
        componentId === 'push_notification_permission' &&
        parsedOptions &&
        typeof parsedOptions === 'object' &&
        !Array.isArray(parsedOptions)
      ) {
        const nameForReplace = (pushNotifDisplayName || '').trim() || 'Someone'
        const t =
          typeof parsedOptions.title === 'string' ? parsedOptions.title : ''
        const b =
          typeof parsedOptions.body === 'string' ? parsedOptions.body : ''
        const fin = finalizePushMockupForSave(t, b, nameForReplace)
        parsedOptions.title = fin.title
        parsedOptions.body = fin.body
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

  const ANIMATED_PREVIEW_COMPONENTS = ['loading', 'rate_app_blurred', 'testimonial_loader']
  const isAnimatedPreview = previewScreen && ANIMATED_PREVIEW_COMPONENTS.includes(previewScreen.component_id ?? '')

  // Only show the Options field for components that use an options list (options, instant_radio)
  const COMPONENT_IDS_WITH_OPTIONS = ['options', 'instant_radio']
  const showOptionsField = componentId && COMPONENT_IDS_WITH_OPTIONS.includes(componentId)

  const showScratchDatesOptionsField = componentId === 'scratchdates_preview'
  const showPushNotificationOptionsField = componentId === 'push_notification_permission'
  const showDataConsentsOptionsField = componentId === 'data_consents'

  const commitDataConsentsOptions = (
    rows: DataConsentEditorRow[],
    acceptAll: string,
    nextLabel: string
  ) => {
    setDataConsentsRows(rows)
    setDataConsentsAcceptAll(acceptAll)
    setDataConsentsNext(nextLabel)
    setOptions(serializeDataConsentsOptions(rows, acceptAll, nextLabel))
  }

  const commitPushNotificationFields = (patch: {
    templateKey?: string
    mockup_type?: PushNotifMockupType
    display_name?: string
    title?: string
    body?: string
    demo_user_id?: string
  }) => {
    const nextKey = patch.templateKey !== undefined ? patch.templateKey : pushNotifTemplateKey
    const mockup_type =
      nextKey === PUSH_NOTIF_CUSTOM_KEY
        ? patch.mockup_type ?? pushNotifMockupType
        : getMockupTypeForNotificationType(nextKey)
    const display_name = patch.display_name ?? pushNotifDisplayName
    const title = patch.title ?? pushNotifNotifTitle
    const body = patch.body ?? pushNotifBody
    const demo_user_id = patch.demo_user_id !== undefined ? patch.demo_user_id : pushNotifDemoUserId
    if (patch.templateKey !== undefined) setPushNotifTemplateKey(patch.templateKey)
    setPushNotifMockupType(mockup_type)
    if (patch.display_name !== undefined) setPushNotifDisplayName(patch.display_name)
    if (patch.title !== undefined) setPushNotifNotifTitle(patch.title)
    if (patch.body !== undefined) setPushNotifBody(patch.body)
    if (patch.demo_user_id !== undefined) setPushNotifDemoUserId(patch.demo_user_id)
    setOptions(
      buildPushNotificationOptionsJson({
        templateKey: nextKey,
        mockup_type,
        display_name,
        title,
        body,
        demo_user_id,
        demoUsers: pushNotifDemoUsers,
      })
    )
  }

  const setScratchDatesOptionsFromState = useCallback(() => {
    const imageUrl = scratchDatesImageSource === 'position' && scratchDatesSelectedPositionId
      ? scratchDatesPositions.find((p) => p.id === scratchDatesSelectedPositionId)?.image_url ?? ''
      : scratchDatesCustomUrl
    const titleVal = scratchDatesTitle.trim() || ''
    setOptions(JSON.stringify({ image_url: imageUrl, title: titleVal || undefined }, null, 2))
  }, [scratchDatesImageSource, scratchDatesSelectedPositionId, scratchDatesPositions, scratchDatesCustomUrl, scratchDatesTitle])

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
                          setDataConsentsJsonMode(false)
                          if (component.default_options) {
                            setOptions(JSON.stringify(component.default_options, null, 2))
                            setShowJsonView(false)
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
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">Preview</h3>
                  {isAnimatedPreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewKey((k) => k + 1)}
                      className="h-7 w-7 p-0"
                      title="Restart animation"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {componentId === 'scratchdates_preview' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewKey((k) => k + 1)}
                      className="h-7 w-7 p-0"
                      title="Reset scratch card"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
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

                      {/* Screen Content */}
                      <div className="w-full h-full overflow-hidden">
                        {previewScreen && (
                          <OnboardingScreenPreview key={previewKey} screen={previewScreen} totalScreens={totalScreens} />
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
                      setDataConsentsJsonMode(false)
                      const selectedComponent = availableComponents.find(c => c.component_key === value)
                      if (selectedComponent?.default_options) {
                        setOptions(JSON.stringify(selectedComponent.default_options, null, 2))
                        setShowJsonView(false)
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

              {showScratchDatesOptionsField && (
                <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  <Label>ScratchDates Preview – Image</Label>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Image source</Label>
                      <Select
                        value={scratchDatesImageSource}
                        onValueChange={(v: 'position' | 'custom') => {
                          setScratchDatesImageSource(v)
                          if (v === 'custom') {
                            setOptions(JSON.stringify({ image_url: scratchDatesCustomUrl, title: scratchDatesTitle || undefined }, null, 2))
                          } else if (scratchDatesSelectedPositionId) {
                            const p = scratchDatesPositions.find((x) => x.id === scratchDatesSelectedPositionId)
                            if (p) setOptions(JSON.stringify({ image_url: p.image_url, title: scratchDatesTitle || p.name || undefined }, null, 2))
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="position">From ScratchDates positions</SelectItem>
                          <SelectItem value="custom">Custom URL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {scratchDatesImageSource === 'position' && (
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-500">Choose position</Label>
                        {scratchDatesPositionsLoading ? (
                          <p className="text-sm text-gray-500 py-4">Loading positions…</p>
                        ) : scratchDatesPositions.length === 0 ? (
                          <p className="text-sm text-gray-500 py-4">No ScratchDates positions found.</p>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[280px] overflow-y-auto p-1">
                            {scratchDatesPositions.map((p) => {
                              const isSelected = scratchDatesSelectedPositionId === p.id
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setScratchDatesSelectedPositionId(p.id)
                                    setScratchDatesTitle(p.name)
                                    setOptions(JSON.stringify({ image_url: p.image_url, title: p.name }, null, 2))
                                  }}
                                  className={`
                                    flex flex-col items-center rounded-xl overflow-hidden border-2 transition-all
                                    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400
                                    ${isSelected
                                      ? 'border-[#FF5252] bg-[#FF5252]/5 ring-2 ring-[#FF5252]/30'
                                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                    }
                                  `}
                                >
                                  <div className="w-full aspect-square bg-gray-100 relative">
                                    {p.image_url ? (
                                      /* eslint-disable-next-line @next/next/no-img-element */
                                      <img
                                        src={p.image_url}
                                        alt={p.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">No image</span>
                                    )}
                                  </div>
                                  <span className="w-full py-1.5 px-1.5 text-center text-xs font-medium text-gray-700 truncate">
                                    {p.name}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {scratchDatesImageSource === 'custom' && (
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-500">Image URL</Label>
                        <Input
                          value={scratchDatesCustomUrl}
                          onChange={(e) => {
                            const val = e.target.value
                            setScratchDatesCustomUrl(val)
                            setOptions(JSON.stringify({ image_url: val, title: scratchDatesTitle || undefined }, null, 2))
                          }}
                          placeholder="https://…"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Title (optional)</Label>
                      <Input
                        value={scratchDatesTitle}
                        onChange={(e) => {
                          const val = e.target.value
                          setScratchDatesTitle(val)
                          const imageUrl = scratchDatesImageSource === 'position' && scratchDatesSelectedPositionId
                            ? scratchDatesPositions.find((p) => p.id === scratchDatesSelectedPositionId)?.image_url ?? ''
                            : scratchDatesCustomUrl
                          setOptions(JSON.stringify({ image_url: imageUrl, title: val || undefined }, null, 2))
                        }}
                        placeholder="e.g. Arcade"
                      />
                    </div>
                  </div>
                </div>
              )}

              {showPushNotificationOptionsField && (
                <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  <div>
                    <Label>Push notification mockup (JSON options)</Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Choose a template from <strong>notification_content_templates</strong> (or Custom). Title and
                      body drive the in-banner copy; mockup layout follows the template type unless you use Custom.
                      Pick a <strong>demo</strong> user for display name and avatar when the layout uses a user
                      avatar. Stored as <code className="text-[11px]">options</code> (jsonb).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Notification content template</Label>
                    {pushNotifTemplatesLoading ? (
                      <p className="text-sm text-gray-500 py-2">Loading templates…</p>
                    ) : (
                      <Select
                        value={pushNotifTemplateKey}
                        onValueChange={(v) => {
                          if (v === PUSH_NOTIF_CUSTOM_KEY) {
                            commitPushNotificationFields({ templateKey: PUSH_NOTIF_CUSTOM_KEY })
                            return
                          }
                          const t = pushNotifContentTemplates.find((x) => x.notification_type === v)
                          if (!t) return
                          commitPushNotificationFields({
                            templateKey: v,
                            title: t.title_template,
                            body: t.body_template,
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={PUSH_NOTIF_CUSTOM_KEY}>Custom</SelectItem>
                          {pushNotifTemplateKey !== PUSH_NOTIF_CUSTOM_KEY &&
                            !pushNotifContentTemplates.some(
                              (t) => t.notification_type === pushNotifTemplateKey
                            ) && (
                              <SelectItem value={pushNotifTemplateKey}>
                                {pushNotifTemplateKey.replace(/_/g, ' ')} (saved; not in list)
                              </SelectItem>
                            )}
                          {pushNotifContentTemplates.map((t) => (
                            <SelectItem key={t.notification_type} value={t.notification_type}>
                              {t.notification_type.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {pushNotifTemplateKey === PUSH_NOTIF_CUSTOM_KEY ? (
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Mockup type</Label>
                      <Select
                        value={pushNotifMockupType}
                        onValueChange={(v) =>
                          commitPushNotificationFields({
                            mockup_type: v === 'app-icon' ? 'app-icon' : 'user-avatar',
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user-avatar">User avatar (like iOS rich notification)</SelectItem>
                          <SelectItem value="app-icon">App icon</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 rounded-md border border-gray-200 bg-white px-3 py-2">
                      Mockup type:{' '}
                      <span className="font-medium text-gray-900">
                        {pushNotifMockupType === 'user-avatar'
                          ? 'User avatar'
                          : 'App icon'}
                      </span>{' '}
                      (from this template)
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Demo user (role = demo)</Label>
                    {pushNotifDemoUsersLoading ? (
                      <p className="text-sm text-gray-500 py-2">Loading demo users…</p>
                    ) : (
                      <Select
                        value={pushNotifDemoUserId || '__none__'}
                        onValueChange={(v) => {
                          if (v === '__none__') {
                            commitPushNotificationFields({ demo_user_id: '' })
                            return
                          }
                          const u = pushNotifDemoUsers.find((x) => x.id === v)
                          if (!u) return
                          commitPushNotificationFields({
                            demo_user_id: u.id,
                            display_name: u.name?.trim() || u.username || 'Demo user',
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No demo user" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None — manual name &amp; image URL</SelectItem>
                          {pushNotifDemoUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              <span className="flex items-center gap-2">
                                {u.profile_picture_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={u.profile_picture_url}
                                    alt=""
                                    className="h-6 w-6 rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="h-6 w-6 rounded-full bg-gray-200 inline-block shrink-0" />
                                )}
                                <span className="truncate">
                                  {u.name?.trim() || u.username || u.email || u.id.slice(0, 8)}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {pushNotifDemoUsers.length === 0 && !pushNotifDemoUsersLoading ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
                        No users with the <strong>demo</strong> role. Add one under Users, or enter name and image URL
                        manually.
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs text-gray-500">Display name (notification)</Label>
                      <Input
                        value={pushNotifDisplayName}
                        onChange={(e) => commitPushNotificationFields({ display_name: e.target.value })}
                        placeholder="e.g. Emi Pham"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs text-gray-500">
                        Notification title{' '}
                        <span className="text-gray-400 font-normal">
                          (in-banner headline; placeholders like {'{name}'}, {'{message_preview}'} are filled on save)
                        </span>
                      </Label>
                      <Input
                        value={pushNotifNotifTitle}
                        onChange={(e) => commitPushNotificationFields({ title: e.target.value })}
                        placeholder={
                          pushNotifMockupType === 'app-icon'
                            ? 'e.g. Shameless'
                            : "e.g. You've caught someone's eye 👀"
                        }
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs text-gray-500">
                        Notification body{' '}
                        <span className="text-gray-400 font-normal">
                          (placeholders are replaced when you save)
                        </span>
                      </Label>
                      <Textarea
                        value={pushNotifBody}
                        onChange={(e) => commitPushNotificationFields({ body: e.target.value })}
                        placeholder="{name} wants to connect!"
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {showDataConsentsOptionsField && (
                <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  <div>
                    <Label>Data consents (options JSONB)</Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Stored as a single <strong>object</strong> with <code className="text-[11px]">consents</code>{' '}
                      (or <code className="text-[11px]">items</code>), <code className="text-[11px]">accept_all_label</code>, and{' '}
                      <code className="text-[11px]">next_button_label</code>. Do not use a top-level JSON array. Title
                      and intro copy on the device still come from the screen title/description fields above.
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        if (dataConsentsJsonMode) {
                          setDataConsentsJsonMode(false)
                        } else {
                          setOptions(
                            serializeDataConsentsOptions(
                              dataConsentsRows,
                              dataConsentsAcceptAll,
                              dataConsentsNext
                            )
                          )
                          setDataConsentsJsonMode(true)
                        }
                      }}
                    >
                      {dataConsentsJsonMode ? 'Back to form editor' : 'Edit raw JSON'}
                    </Button>
                  </div>
                  {dataConsentsJsonMode ? (
                    <div className="space-y-2">
                      <Textarea
                        value={options}
                        onChange={(e) => setOptions(e.target.value)}
                        rows={14}
                        className="font-mono text-sm"
                        spellCheck={false}
                      />
                      <p className="text-xs text-gray-500">
                        Must parse to an object with <code className="text-[11px]">consents</code> (array of items with{' '}
                        <code className="text-[11px]">title</code>).
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">Accept all row label</Label>
                          <Input
                            value={dataConsentsAcceptAll}
                            onChange={(e) =>
                              commitDataConsentsOptions(dataConsentsRows, e.target.value, dataConsentsNext)
                            }
                            placeholder="Accept All"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">Primary CTA label</Label>
                          <Input
                            value={dataConsentsNext}
                            onChange={(e) =>
                              commitDataConsentsOptions(dataConsentsRows, dataConsentsAcceptAll, e.target.value)
                            }
                            placeholder="Next"
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-gray-500">Consents (order = app order)</Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              commitDataConsentsOptions(
                                [...dataConsentsRows, emptyDataConsentRow()],
                                dataConsentsAcceptAll,
                                dataConsentsNext
                              )
                            }
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add consent
                          </Button>
                        </div>
                        {dataConsentsRows.map((row, index) => (
                          <div
                            key={index}
                            className="rounded-lg border border-gray-200 bg-white p-3 space-y-2 shadow-sm"
                          >
                            <div className="flex flex-wrap items-center gap-2 justify-between">
                              <span className="text-xs font-semibold text-gray-700">Consent {index + 1}</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  disabled={index === 0}
                                  onClick={() => {
                                    const next = [...dataConsentsRows]
                                    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                                    commitDataConsentsOptions(next, dataConsentsAcceptAll, dataConsentsNext)
                                  }}
                                  title="Move up"
                                >
                                  ↑
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  disabled={index === dataConsentsRows.length - 1}
                                  onClick={() => {
                                    const next = [...dataConsentsRows]
                                    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                                    commitDataConsentsOptions(next, dataConsentsAcceptAll, dataConsentsNext)
                                  }}
                                  title="Move down"
                                >
                                  ↓
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-red-600"
                                  disabled={dataConsentsRows.length <= 1}
                                  onClick={() => {
                                    const next = dataConsentsRows.filter((_, i) => i !== index)
                                    commitDataConsentsOptions(
                                      next.length ? next : [emptyDataConsentRow()],
                                      dataConsentsAcceptAll,
                                      dataConsentsNext
                                    )
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Input
                                placeholder="id (analytics)"
                                value={row.id}
                                onChange={(e) => {
                                  const next = dataConsentsRows.map((r, i) =>
                                    i === index ? { ...r, id: e.target.value } : r
                                  )
                                  commitDataConsentsOptions(next, dataConsentsAcceptAll, dataConsentsNext)
                                }}
                              />
                              <div className="flex items-center gap-2 sm:justify-end">
                                <Switch
                                  id={`dc-req-${index}`}
                                  checked={row.required}
                                  onCheckedChange={(checked) => {
                                    const next = dataConsentsRows.map((r, i) =>
                                      i === index ? { ...r, required: checked } : r
                                    )
                                    commitDataConsentsOptions(next, dataConsentsAcceptAll, dataConsentsNext)
                                  }}
                                />
                                <Label htmlFor={`dc-req-${index}`} className="text-xs cursor-pointer">
                                  Required (blocks Next)
                                </Label>
                              </div>
                            </div>
                            <Input
                              placeholder="Title *"
                              value={row.title}
                              onChange={(e) => {
                                const next = dataConsentsRows.map((r, i) =>
                                  i === index ? { ...r, title: e.target.value } : r
                                )
                                commitDataConsentsOptions(next, dataConsentsAcceptAll, dataConsentsNext)
                              }}
                            />
                            <Textarea
                              placeholder="Description (optional)"
                              value={row.description}
                              rows={2}
                              className="text-sm"
                              onChange={(e) => {
                                const next = dataConsentsRows.map((r, i) =>
                                  i === index ? { ...r, description: e.target.value } : r
                                )
                                commitDataConsentsOptions(next, dataConsentsAcceptAll, dataConsentsNext)
                              }}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Input
                                placeholder='Learn more label (default "Learn more")'
                                value={row.learnMoreLabel}
                                onChange={(e) => {
                                  const next = dataConsentsRows.map((r, i) =>
                                    i === index ? { ...r, learnMoreLabel: e.target.value } : r
                                  )
                                  commitDataConsentsOptions(next, dataConsentsAcceptAll, dataConsentsNext)
                                }}
                              />
                              <Input
                                placeholder="Learn more URL (https…)"
                                value={row.learnMoreUrl}
                                onChange={(e) => {
                                  const next = dataConsentsRows.map((r, i) =>
                                    i === index ? { ...r, learnMoreUrl: e.target.value } : r
                                  )
                                  commitDataConsentsOptions(next, dataConsentsAcceptAll, dataConsentsNext)
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {showOptionsField && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="options">Options</Label>
                  {isOptionsArray() && !showJsonView && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowJsonView(true)}
                      className="text-xs"
                    >
                      Edit as JSON
                    </Button>
                  )}
                  {showJsonView && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowJsonView(false)
                        // Validate JSON when switching back
                        try {
                          const parsed = JSON.parse(options)
                          if (Array.isArray(parsed) && parsed.every((item: any) => 
                            typeof item === 'object' && item !== null && 'label' in item && 'value' in item
                          )) {
                            // Valid array format, keep it
                          } else {
                            // Invalid format, reset to empty array
                            setOptions('[]')
                          }
                        } catch {
                          setOptions('[]')
                        }
                      }}
                      className="text-xs"
                    >
                      Back to Visual Editor
                    </Button>
                  )}
                </div>
                
                {isOptionsArray() && !showJsonView ? (
                  <div className="space-y-3">
                    {/* Options List */}
                    <div className="space-y-2">
                      {getOptionsArray().map((option, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-white">
                          {editingOptionIndex === index ? (
                            <>
                              <Input
                                value={newOptionLabel}
                                onChange={(e) => setNewOptionLabel(e.target.value)}
                                placeholder="Label"
                                className="flex-1"
                              />
                              <Input
                                value={newOptionValue}
                                onChange={(e) => setNewOptionValue(e.target.value)}
                                placeholder="Value"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleUpdateOption(index, newOptionLabel, newOptionValue)}
                                disabled={!newOptionLabel.trim() || !newOptionValue.trim()}
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingOptionIndex(null)
                                  setNewOptionLabel('')
                                  setNewOptionValue('')
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <div className="flex-1">
                                <div className="font-medium">{option.label}</div>
                                <div className="text-xs text-gray-500">{option.value}</div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingOptionIndex(index)
                                  setNewOptionLabel(option.label)
                                  setNewOptionValue(option.value)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteOption(index)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add New Option */}
                    {editingOptionIndex === null && (
                      <div className="flex items-center gap-2 p-3 border-2 border-dashed rounded-lg bg-gray-50">
                        <Input
                          value={newOptionLabel}
                          onChange={(e) => setNewOptionLabel(e.target.value)}
                          placeholder="Label"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newOptionLabel.trim() && newOptionValue.trim()) {
                              handleAddOption()
                            }
                          }}
                        />
                        <Input
                          value={newOptionValue}
                          onChange={(e) => setNewOptionValue(e.target.value)}
                          placeholder="Value"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newOptionLabel.trim() && newOptionValue.trim()) {
                              handleAddOption()
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddOption}
                          disabled={!newOptionLabel.trim() || !newOptionValue.trim()}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {getOptionsArray().length === 0 && (
                      <p className="text-xs text-gray-500 text-center py-4">
                        No options yet. Add your first option above.
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <Textarea
                      id="options"
                      value={options}
                      onChange={(e) => setOptions(e.target.value)}
                      placeholder={screenType === 'conversion' ? '[]' : '{} or null'}
                      rows={6}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500">
                      Enter valid JSON. For options / instant_radio use array of objects with label, value, and id (e.g. {`[{"label": "Option A", "value": "option_a", "id": "option_a"}]`}). For instant_radio icons use id: instagram, tiktok, reddit, youtube, x, facebook, app_store, website, partner_ref, gf, bf.
                    </p>
                  </>
                )}
              </div>
              )}

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
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete this screen?',
                          description: 'This action cannot be undone.',
                          variant: 'destructive',
                          confirmLabel: 'Delete',
                        })
                        if (ok) {
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
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">Preview</h3>
                  {isAnimatedPreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewKey((k) => k + 1)}
                      className="h-7 w-7 p-0"
                      title="Restart animation"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {componentId === 'scratchdates_preview' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewKey((k) => k + 1)}
                      className="h-7 w-7 p-0"
                      title="Reset scratch card"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
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

                      {/* Screen Content */}
                      <div className="w-full h-full overflow-hidden">
                        {previewScreen && (
                          <OnboardingScreenPreview key={previewKey} screen={previewScreen} totalScreens={totalScreens} />
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
