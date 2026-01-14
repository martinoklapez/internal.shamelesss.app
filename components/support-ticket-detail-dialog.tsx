'use client'

import { useState, useEffect } from 'react'
import { SupportTicketWithProfile } from '@/types/database'
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

interface SupportTicketDetailDialogProps {
  ticket: SupportTicketWithProfile
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdate: () => void
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  closed: 'bg-gray-100 text-gray-800 border-gray-200',
}

const STATUS_SELECT_COLORS: Record<string, string> = {
  open: 'border-blue-200 bg-blue-50 text-blue-900',
  in_progress: 'border-yellow-200 bg-yellow-50 text-yellow-900',
  resolved: 'border-green-200 bg-green-50 text-green-900',
  closed: 'border-gray-200 bg-gray-50 text-gray-900',
}

export function SupportTicketDetailDialog({
  ticket,
  open,
  onOpenChange,
  onStatusUpdate,
}: SupportTicketDetailDialogProps) {
  const [status, setStatus] = useState(ticket.status)
  const [updating, setUpdating] = useState(false)
  const [adminResponse, setAdminResponse] = useState<string>(ticket.admin_response || '')
  const [savingResponse, setSavingResponse] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !ticket.id) return

    const fetchFullTicket = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/support-tickets/${ticket.id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch ticket details')
        }
        const data = await response.json()
        
        setStatus(data.status || ticket.status)
        setAdminResponse(data.admin_response || '')
      } catch (error) {
        console.error('Error fetching ticket details:', error)
        setStatus(ticket.status)
        setAdminResponse(ticket.admin_response || '')
      } finally {
        setLoading(false)
      }
    }

    fetchFullTicket()
  }, [open, ticket.id])

  const handleStatusUpdate = async (newStatus: string) => {
    if (newStatus === status) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/support-tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      const updatedTicket = await response.json()
      setStatus(updatedTicket.status)
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
      const response = await fetch(`/api/support-tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_response: adminResponse }),
      })

      if (!response.ok) {
        throw new Error('Failed to save admin response')
      }

      const updatedTicket = await response.json()
      setAdminResponse(updatedTicket.admin_response || '')
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

  const userName = ticket.user_profile?.name || ticket.user_profile?.username || 'Unknown User'
  const resolverName = ticket.resolver_profile?.name || ticket.resolver_profile?.username || null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Support Ticket Details</DialogTitle>
          <DialogDescription>
            Ticket ID: <span className="font-mono text-xs">{ticket.id}</span>
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
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
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
                {ticket.user_profile?.profile_picture_url ? (
                  <AvatarImage src={ticket.user_profile.profile_picture_url} alt={userName} />
                ) : (
                  <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{userName}</div>
                {ticket.user_profile?.username && (
                  <div className="text-xs text-gray-500 truncate">@{ticket.user_profile.username}</div>
                )}
              </div>
            </div>
          </div>

          {/* Ticket Information and Message - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ticket Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Ticket Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Subject:</span>
                  <span className="font-medium text-gray-900">{ticket.subject}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Status:</span>
                  <Badge className={STATUS_COLORS[ticket.status] || ''}>
                    {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1).replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium text-gray-900">{formatDate(ticket.created_at)}</span>
                </div>
                {ticket.resolved_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Resolved:</span>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">{formatDate(ticket.resolved_at)}</div>
                      {resolverName && (
                        <div className="text-xs text-gray-500 mt-0.5">by {resolverName}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Message */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Message</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.message}</p>
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
              placeholder="Enter your response to this ticket..."
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
