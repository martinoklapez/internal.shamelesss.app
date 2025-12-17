'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Handle,
  Position,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Plus, Pencil, Lock } from 'lucide-react'
import type { QuizScreen, ConversionScreen } from '@/types/onboarding'
import { OnboardingScreenDialog } from './onboarding-screen-dialog'
import { OnboardingScreenPreview } from './onboarding-screen-preview'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'

interface OnboardingManagerProps {
  initialQuizScreens: QuizScreen[]
  initialConversionScreens: ConversionScreen[]
}

// Custom node component for screens
function ScreenNode({ data }: { data: any }) {
  const { screen, type, onEdit, onDelete, onToggleShow, totalScreens } = data
  const orderPosition = screen.order_position ?? 0
  const shouldShow = screen.should_show ?? true

  return (
    <div className="flex flex-col items-center gap-3 relative">
      {/* Target handle (left side - input) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#10b981', width: 12, height: 12, border: '2px solid white', top: '50%' }}
      />
      
      {/* Source handle (right side - output) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#3b82f6', width: 12, height: 12, border: '2px solid white', top: '50%' }}
      />

      {/* Details and Controls Header */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2 w-[180px]">
        {/* Controls */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1">
            <Switch
              id={`toggle-${screen.id}`}
              checked={shouldShow}
              onCheckedChange={() => onToggleShow(screen.id, type, shouldShow)}
              className="scale-75"
            />
            <Label
              htmlFor={`toggle-${screen.id}`}
              className="text-[10px] text-gray-700 cursor-pointer"
            >
              {shouldShow ? 'Show' : 'Hide'}
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(screen, type)}
            className="h-6 w-6 p-0"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Phone Mockup */}
      <div className="relative">
        {/* Phone Frame */}
        <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl">
          {/* Screen */}
          <div className="bg-white rounded-[2rem] overflow-hidden w-[200px] h-[400px] relative" style={{ aspectRatio: '9/16' }}>
            {/* Dynamic Island / Notch - integrated into top border */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-[1.75rem] z-10"></div>
            
            {/* Status Bar */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-white flex items-center justify-between px-3 pt-1 z-20">
              <span className="text-[10px] font-semibold text-black ml-2">9:41</span>
              <div className="flex items-center gap-1.5 mr-2">
                {/* Left icon: black oval with white outline */}
                <div className="w-5 h-2.5 bg-black rounded-full border border-white relative">
                  <div className="absolute left-0.5 top-0.5 w-3 h-1.5 bg-black rounded-full"></div>
                </div>
                {/* Right icon: white oval with black outline */}
                <div className="w-5 h-2.5 bg-white rounded-full border border-black relative">
                  <div className="absolute left-0.5 top-0.5 w-3 h-1.5 bg-white rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Screen Content */}
            <div className="w-full h-full overflow-hidden">
              <OnboardingScreenPreview screen={screen} totalScreens={totalScreens} />
            </div>

            {/* Home Indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-black rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Custom node component for auth screen
function AuthNode() {
  return (
    <div className="flex flex-col items-center gap-3 relative">
      {/* Target handle (left side - input) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#10b981', width: 12, height: 12, border: '2px solid white', top: '50%' }}
      />
      
      {/* Source handle (right side - output) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#3b82f6', width: 12, height: 12, border: '2px solid white', top: '50%' }}
      />

      {/* Details Header */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 w-[240px]">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-gray-400" />
          <h4 className="font-semibold text-gray-900 text-sm">
            Authentication Screen
          </h4>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Login / Register
        </p>
      </div>

      {/* Phone Mockup */}
      <div className="relative">
        {/* Phone Frame */}
        <div className="bg-black rounded-[2.5rem] p-2 shadow-2xl">
          {/* Screen */}
          <div className="bg-white rounded-[2rem] overflow-hidden w-[200px] h-[400px] relative" style={{ aspectRatio: '9/16' }}>
            {/* Dynamic Island / Notch - integrated into top border */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-[1.75rem] z-10"></div>
            
            {/* Status Bar */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-white flex items-center justify-between px-3 pt-1 z-20">
              <span className="text-[10px] font-semibold text-black ml-2">9:41</span>
              <div className="flex items-center gap-1.5 mr-2">
                {/* Left icon: black oval with white outline */}
                <div className="w-5 h-2.5 bg-black rounded-full border border-white relative">
                  <div className="absolute left-0.5 top-0.5 w-3 h-1.5 bg-black rounded-full"></div>
                </div>
                {/* Right icon: white oval with black outline */}
                <div className="w-5 h-2.5 bg-white rounded-full border border-black relative">
                  <div className="absolute left-0.5 top-0.5 w-3 h-1.5 bg-white rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Screen Content */}
            <div className="w-full h-full pt-8 pb-6 px-4 flex flex-col items-center justify-center">
              <Lock className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Authentication
              </h3>
              <p className="text-sm text-gray-600 text-center">
                Login or Register to continue
              </p>
            </div>

            {/* Home Indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-black rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  screen: ScreenNode,
  auth: AuthNode,
}

export default function OnboardingManager({
  initialQuizScreens,
  initialConversionScreens,
}: OnboardingManagerProps) {
  const router = useRouter()
  const [quizScreens, setQuizScreens] = useState<QuizScreen[]>(initialQuizScreens)
  const [conversionScreens, setConversionScreens] = useState<ConversionScreen[]>(initialConversionScreens)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingScreen, setEditingScreen] = useState<QuizScreen | ConversionScreen | null>(null)
  const [screenType, setScreenType] = useState<'quiz' | 'conversion' | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [screenToDelete, setScreenToDelete] = useState<{ id: string; type: 'quiz' | 'conversion' } | null>(null)

  const handleEdit = useCallback((screen: QuizScreen | ConversionScreen, type: 'quiz' | 'conversion') => {
    setScreenType(type)
    setEditingScreen(screen)
    setDialogOpen(true)
  }, [])

  const handleDelete = useCallback((id: string, type: 'quiz' | 'conversion') => {
    setScreenToDelete({ id, type })
    setDeleteDialogOpen(true)
  }, [])

  const handleToggleShow = useCallback(async (id: string, type: 'quiz' | 'conversion', currentValue: boolean | null) => {
    try {
      const endpoint = type === 'quiz'
        ? '/api/onboarding/quiz-screens'
        : '/api/onboarding/conversion-screens'

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          should_show: !currentValue,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update screen')
      }

      const { screen } = await response.json()

      if (type === 'quiz') {
        setQuizScreens((prev) =>
          prev.map((s) => (s.id === id ? { ...s, should_show: screen.should_show } : s))
        )
      } else {
        setConversionScreens((prev) =>
          prev.map((s) => (s.id === id ? { ...s, should_show: screen.should_show } : s))
        )
      }

      router.refresh()
    } catch (error) {
      console.error('Error toggling screen visibility:', error)
      alert('Failed to update screen visibility. Please try again.')
    }
  }, [router])

  // Generate nodes and edges from screens
  const generateNodesAndEdges = useCallback(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    const cardWidth = 240 // Width of the details header + phone mockup
    const cardSpacing = 50 // Gap between cards
    const rowSpacing = 650 // Vertical spacing between rows (accounts for header + phone + gap)
    const startX = 50
    const row1Y = 50 // Quiz screens row
    const row2Y = row1Y + rowSpacing // Auth row
    const row3Y = row2Y + rowSpacing // Conversion screens row

    // Row 1: Quiz screens (horizontally aligned)
    let currentX = startX
    const totalQuizScreens = quizScreens.length
    quizScreens.forEach((screen, index) => {
      nodes.push({
        id: `quiz-${screen.id}`,
        type: 'screen',
        position: { x: currentX, y: row1Y },
        data: {
          screen,
          type: 'quiz',
          onEdit: handleEdit,
          onDelete: handleDelete,
          onToggleShow: handleToggleShow,
          totalScreens: totalQuizScreens,
        },
      })

      // Connect to next quiz screen with arrow
      if (index < quizScreens.length - 1) {
        edges.push({
          id: `edge-quiz-${index}`,
          source: `quiz-${screen.id}`,
          target: `quiz-${quizScreens[index + 1].id}`,
          type: 'straight',
          animated: true,
          style: { strokeWidth: 2, stroke: '#3b82f6' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#3b82f6',
          },
        })
      }
      currentX += cardWidth + cardSpacing
    })

    // Row 2: Auth screen (left-aligned)
    nodes.push({
      id: 'auth',
      type: 'auth',
      position: { x: startX, y: row2Y },
      data: {},
    })

    // Connect last quiz to auth if there are quiz screens
    if (quizScreens.length > 0) {
      edges.push({
        id: 'edge-quiz-auth',
        source: `quiz-${quizScreens[quizScreens.length - 1].id}`,
        target: 'auth',
        sourceHandle: 'source',
        targetHandle: 'target',
        type: 'smoothstep',
        animated: true,
        style: { strokeWidth: 2, stroke: '#3b82f6' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#3b82f6',
        },
      })
    }

    // Row 3: Conversion screens (horizontally aligned)
    currentX = startX
    const totalConversionScreens = conversionScreens.length
    conversionScreens.forEach((screen, index) => {
      nodes.push({
        id: `conversion-${screen.id}`,
        type: 'screen',
        position: { x: currentX, y: row3Y },
        data: {
          screen,
          type: 'conversion',
          onEdit: handleEdit,
          onDelete: handleDelete,
          onToggleShow: handleToggleShow,
          totalScreens: totalConversionScreens,
        },
      })

      // Connect auth to first conversion screen
      if (index === 0) {
        edges.push({
          id: 'edge-auth-conversion',
          source: 'auth',
          target: `conversion-${screen.id}`,
          sourceHandle: 'source',
          targetHandle: 'target',
          type: 'smoothstep',
          animated: true,
          style: { strokeWidth: 2, stroke: '#3b82f6' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#3b82f6',
          },
        })
      }

      // Connect to next conversion screen with arrow
      if (index < conversionScreens.length - 1) {
        edges.push({
          id: `edge-conversion-${index}`,
          source: `conversion-${screen.id}`,
          target: `conversion-${conversionScreens[index + 1].id}`,
          type: 'straight',
          animated: true,
          style: { strokeWidth: 2, stroke: '#3b82f6' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#3b82f6',
          },
        })
      }
      currentX += cardWidth + cardSpacing
    })

    return { nodes, edges }
  }, [quizScreens, conversionScreens, handleEdit, handleDelete, handleToggleShow])

  const initialNodesAndEdges = useMemo(() => generateNodesAndEdges(), [generateNodesAndEdges])
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodesAndEdges.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialNodesAndEdges.edges)

  // Update nodes when screens change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges()
    setNodes(newNodes)
    setEdges(newEdges)
  }, [quizScreens, conversionScreens, generateNodesAndEdges, setNodes, setEdges])

  const confirmDelete = async () => {
    if (!screenToDelete) return

    try {
      const endpoint = screenToDelete.type === 'quiz'
        ? `/api/onboarding/quiz-screens?id=${screenToDelete.id}`
        : `/api/onboarding/conversion-screens?id=${screenToDelete.id}`

      const response = await fetch(endpoint, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete screen')
      }

      if (screenToDelete.type === 'quiz') {
        setQuizScreens((prev) => prev.filter((s) => s.id !== screenToDelete.id))
      } else {
        setConversionScreens((prev) => prev.filter((s) => s.id !== screenToDelete.id))
      }

      router.refresh()
    } catch (error) {
      console.error('Error deleting screen:', error)
      alert('Failed to delete screen. Please try again.')
    } finally {
      setDeleteDialogOpen(false)
      setScreenToDelete(null)
    }
  }

  const handleDialogSuccess = async () => {
    try {
      const [quizResponse, conversionResponse] = await Promise.all([
        fetch('/api/onboarding/quiz-screens'),
        fetch('/api/onboarding/conversion-screens'),
      ])

      if (quizResponse.ok) {
        const quizData = await quizResponse.json()
        setQuizScreens(quizData.screens || [])
      }

      if (conversionResponse.ok) {
        const conversionData = await conversionResponse.json()
        setConversionScreens(conversionData.screens || [])
      }

      router.refresh()
    } catch (error) {
      console.error('Error refreshing data:', error)
      router.refresh()
    }
  }

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const handleAdd = useCallback(() => {
    setScreenType('quiz') // Pre-select Quiz Screen
    setEditingScreen(null)
    setDialogOpen(true)
  }, [])

  // Expose add handler to window for breadcrumb access
  useEffect(() => {
    (window as any).onboardingAddHandlers = {
      addScreen: handleAdd,
    }
    return () => {
      delete (window as any).onboardingAddHandlers
    }
  }, [handleAdd])

  return (
    <div className="w-full h-full">
      {/* React Flow Canvas */}
      <div className="w-full h-full bg-gray-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {/* Dialog */}
      <OnboardingScreenDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        screen={editingScreen}
        screenType={screenType}
        onSuccess={handleDialogSuccess}
        onDelete={handleDelete}
        onScreenTypeChange={setScreenType}
        existingQuizScreens={quizScreens}
        existingConversionScreens={conversionScreens}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Screen</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this screen? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
