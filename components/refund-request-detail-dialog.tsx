'use client'

import { useState, useEffect } from 'react'
import { RefundRequestWithProfile } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { User, Save } from 'lucide-react'

interface RefundRequestDetailDialogProps {
  request: RefundRequestWithProfile
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdate: () => void
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  processed: 'bg-blue-100 text-blue-800 border-blue-200',
}

const STATUS_SELECT_COLORS: Record<string, string> = {
  pending: 'border-yellow-200 bg-yellow-50 text-yellow-900',
  approved: 'border-green-200 bg-green-50 text-green-900',
  rejected: 'border-red-200 bg-red-50 text-red-900',
  processed: 'border-blue-200 bg-blue-50 text-blue-900',
}

export function RefundRequestDetailDialog({
  request,
  open,
  onOpenChange,
  onStatusUpdate,
}: RefundRequestDetailDialogProps) {
  const [status, setStatus] = useState(request.status)
  const [updating, setUpdating] = useState(false)
  const [adminResponse, setAdminResponse] = useState<string>(request.admin_response || '')
  const [savingResponse, setSavingResponse] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !request.id) return

    const fetchFullRequest = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/refund-requests/${request.id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch request details')
        }
        const data = await response.json()
        
        setStatus(data.status || request.status)
        setAdminResponse(data.admin_response || '')
      } catch (error) {
        console.error('Error fetching request details:', error)
        setStatus(request.status)
        setAdminResponse(request.admin_response || '')
      } finally {
        setLoading(false)
      }
    }

    fetchFullRequest()
  }, [open, request.id])

  const handleStatusUpdate = async (newStatus: string) => {
    if (newStatus === status) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/refund-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      const updatedRequest = await response.json()
      setStatus(updatedRequest.status)
      onStatusUpdate()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const handleSaveAdminResponse = async () => {
    setSavingResponse(true)
    try {
      const response = await fetch(`/api/refund-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_response: adminResponse }),
      })

      if (!response.ok) {
        throw new Error('Failed to save admin response')
      }

      const updatedRequest = await response.json()
      setAdminResponse(updatedRequest.admin_response || '')
      onStatusUpdate()
    } catch (error) {
      console.error('Error saving admin response:', error)
      alert('Failed to save admin response. Please try again.')
    } finally {
      setSavingResponse(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount)
  }

  const userName = request.user_profile?.name || request.user_profile?.username || 'Unknown User'
  const reviewerName = request.reviewer_profile?.name || request.reviewer_profile?.username || null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Refund Request Details</DialogTitle>
          <DialogDescription>
            Request ID: <span className="font-mono text-xs">{request.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Update Section */}
          <div className="flex items-center justify-start py-2">
            <Select value={status} onValueChange={handleStatusUpdate} disabled={updating}>
              <SelectTrigger className={`w-[180px] ${STATUS_SELECT_COLORS[status] || ''} focus:ring-0 focus:ring-offset-0`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">User</h3>
            </div>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {request.user_profile?.profile_picture_url ? (
                  <AvatarImage src={request.user_profile.profile_picture_url} alt={userName} />
                ) : (
                  <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{userName}</div>
                {request.user_profile?.username && (
                  <div className="text-xs text-gray-500 truncate">@{request.user_profile.username}</div>
                )}
              </div>
            </div>
          </div>

          {/* Request Information and Reason - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Request Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Request Information</h3>
              <div className="space-y-3 text-sm">
                {request.transaction_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Transaction ID:</span>
                    <span className="font-mono text-xs text-gray-900">{request.transaction_id}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium text-gray-900">{formatDate(request.created_at)}</span>
                </div>
                {request.reviewed_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Reviewed:</span>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">{formatDate(request.reviewed_at)}</div>
                      {reviewerName && (
                        <div className="text-xs text-gray-500 mt-0.5">by {reviewerName}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reason */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Reason</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.reason}</p>
            </div>
          </div>

          {/* Admin Response Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Admin Response</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAdminResponse}
                disabled={savingResponse}
              >
                <Save className="h-4 w-4 mr-2" />
                {savingResponse ? 'Saving...' : 'Save Response'}
              </Button>
            </div>
            <Textarea
              value={adminResponse}
              onChange={(e) => setAdminResponse(e.target.value)}
              placeholder="Enter your response to this refund request..."
              className="min-h-[120px] resize-none"
            />
            {adminResponse && (
              <p className="text-xs text-gray-500 mt-2">
                {adminResponse.length} characters
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
