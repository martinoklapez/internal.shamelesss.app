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
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Plus, Pencil, Trash2, Lock } from 'lucide-react'
import type { QuizScreen, ConversionScreen } from '@/types/onboarding'
import { OnboardingScreenDialog } from './onboarding-screen-dialog'
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
  const { screen, type, onEdit, onDelete, onToggleShow } = data
  const orderPosition = screen.order_position ?? 0
  const shouldShow = screen.should_show ?? true

  return (
    <div className="bg-white border-2 border-gray-300 rounded-[2rem] shadow-sm w-[200px] h-[400px] flex flex-col overflow-hidden relative" style={{ aspectRatio: '9/16' }}>
      {/* Target handle (left side - input) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#10b981', width: 12, height: 12, border: '2px solid white' }}
      />
      
      {/* Source handle (right side - output) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#3b82f6', width: 12, height: 12, border: '2px solid white' }}
      />
      
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs shrink-0">
                {orderPosition}
              </div>
              {screen.title && (
                <h4 className="font-semibold text-gray-900 text-xs break-words flex-1 leading-tight">
                  {screen.title}
                </h4>
              )}
            </div>
            <div className="mb-2">
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  shouldShow
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {shouldShow ? 'Visible' : 'Hidden'}
              </span>
            </div>
            {screen.description && (
              <p className="text-xs text-gray-600 break-words mb-3 leading-relaxed">
                {screen.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-auto">
              {screen.event_name && (
                <span className="bg-gray-50 px-1.5 py-0.5 rounded text-[10px]">
                  {screen.event_name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-200 mt-auto">
          <div className="flex items-center gap-1">
            <Switch
              id={`toggle-${screen.id}`}
              checked={shouldShow}
              onCheckedChange={() => onToggleShow(screen.id, type, shouldShow)}
              className="scale-75"
            />
            <Label
              htmlFor={`toggle-${screen.id}`}
              className="text-xs text-gray-700 cursor-pointer"
            >
              {shouldShow ? 'Show' : 'Hide'}
            </Label>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(screen, type)}
              className="h-6 w-6 p-0"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(screen.id, type)}
              className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Custom node component for auth screen
function AuthNode() {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-[2rem] shadow-sm w-[200px] h-[400px] flex items-center justify-center relative" style={{ aspectRatio: '9/16' }}>
      {/* Target handle (left side - input) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#10b981', width: 12, height: 12, border: '2px solid white' }}
      />
      
      {/* Source handle (right side - output) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#3b82f6', width: 12, height: 12, border: '2px solid white' }}
      />
      
      <div className="p-4 flex flex-col items-center gap-3">
        <div className="bg-blue-500 rounded-lg p-3">
          <Lock className="h-6 w-6 text-white" />
        </div>
        <div className="text-center">
          <span className="text-sm font-semibold text-gray-900 block">
            Authentication
          </span>
          <span className="text-xs text-gray-600">
            Required step
          </span>
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

    const cardWidth = 200
    const cardSpacing = 30 // Reduced gap between cards
    const rowSpacing = 500 // Vertical spacing between rows
    const startX = 50
    const row1Y = 50 // Quiz screens row
    const row2Y = row1Y + rowSpacing // Auth row
    const row3Y = row2Y + rowSpacing // Conversion screens row

    // Row 1: Quiz screens (horizontally aligned)
    let currentX = startX
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
            type: 'arrowclosed',
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
          type: 'arrowclosed',
          color: '#3b82f6',
        },
      })
    }

    // Row 3: Conversion screens (horizontally aligned)
    currentX = startX
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
            type: 'arrowclosed',
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
            type: 'arrowclosed',
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

  const handleAdd = useCallback((type: 'quiz' | 'conversion') => {
    setScreenType(type)
    setEditingScreen(null)
    setDialogOpen(true)
  }, [])

  // Expose add handlers to window for breadcrumb access
  useEffect(() => {
    (window as any).onboardingAddHandlers = {
      addQuiz: () => handleAdd('quiz'),
      addConversion: () => handleAdd('conversion'),
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
      {screenType && (
        <OnboardingScreenDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          screen={editingScreen}
          screenType={screenType}
          onSuccess={handleDialogSuccess}
        />
      )}

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
