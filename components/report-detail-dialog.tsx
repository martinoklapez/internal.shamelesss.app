'use client'

import { useState, useEffect } from 'react'
import { ReportWithProfiles } from '@/types/database'
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
import { Separator } from '@/components/ui/separator'
import Image from 'next/image'
import { ExternalLink, Download, User, MessageSquare, Image as ImageIcon, Trash2, Users, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ReportDetailDialogProps {
  report: ReportWithProfiles
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdate: () => void
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  reviewed: 'bg-blue-100 text-blue-800 border-blue-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  dismissed: 'bg-red-100 text-red-800 border-red-200',
}

const STATUS_SELECT_COLORS: Record<string, string> = {
  pending: 'border-yellow-200 bg-yellow-50 text-yellow-900',
  reviewed: 'border-blue-200 bg-blue-50 text-blue-900',
  resolved: 'border-green-200 bg-green-50 text-green-900',
  dismissed: 'border-red-200 bg-red-50 text-red-900',
}

const TYPE_LABELS: Record<string, string> = {
  user: 'User',
  message: 'Message',
  image: 'Image',
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate_content: 'Inappropriate Content',
  impersonation: 'Impersonation',
  other: 'Other',
}

export function ReportDetailDialog({
  report,
  open,
  onOpenChange,
  onStatusUpdate,
}: ReportDetailDialogProps) {
  const [status, setStatus] = useState(report.status)
  const [updating, setUpdating] = useState(false)
  const [adminResponse, setAdminResponse] = useState<string>(report.admin_response || '')
  const [savingResponse, setSavingResponse] = useState(false)
  const [evidenceImageUrl, setEvidenceImageUrl] = useState<string | null>(report.evidence_image_url || null)
  const [connection, setConnection] = useState(report.connection)
  const [friendRequests, setFriendRequests] = useState(report.friend_requests || [])
  const [deletingConnection, setDeletingConnection] = useState(false)
  const [deletingFriendRequest, setDeletingFriendRequest] = useState<string | null>(null)
  const [loadingRelationships, setLoadingRelationships] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!open || !report.id) return

    // Always fetch full report data when dialog opens to get connection/friend_requests
    const fetchFullReport = async () => {
      setLoadingRelationships(true)
      try {
        const response = await fetch(`/api/reports/${report.id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch report details')
        }
        const data = await response.json()
        
        setStatus(data.status || report.status)
        setAdminResponse(data.admin_response || '')
        setEvidenceImageUrl(data.evidence_image_url || report.evidence_image_url || null)
        setConnection(data.connection || null)
        setFriendRequests(data.friend_requests || [])
      } catch (error) {
        console.error('Error fetching report details:', error)
        // Fallback to prop values
        setStatus(report.status)
        setAdminResponse(report.admin_response || '')
        setEvidenceImageUrl(report.evidence_image_url || null)
        setConnection(report.connection || null)
        setFriendRequests(report.friend_requests || [])
      } finally {
        setLoadingRelationships(false)
      }
    }

    fetchFullReport()
  }, [open, report.id])

  const handleStatusUpdate = async (newStatus: string) => {
    if (newStatus === status) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      const updatedReport = await response.json()
      setStatus(updatedReport.status)
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
      const response = await fetch(`/api/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_response: adminResponse }),
      })

      if (!response.ok) {
        throw new Error('Failed to save admin response')
      }

      const updatedReport = await response.json()
      setAdminResponse(updatedReport.admin_response || '')
      onStatusUpdate()
    } catch (error) {
      console.error('Error saving admin response:', error)
      alert('Failed to save admin response. Please try again.')
    } finally {
      setSavingResponse(false)
    }
  }

  const handleDeleteConnection = async () => {
    if (!connection || !confirm('Are you sure you want to delete this connection and all associated friend requests? This action cannot be undone.')) {
      return
    }

    setDeletingConnection(true)
    try {
      // Delete the connection
      const connectionResponse = await fetch(`/api/connections/${connection.id}/delete`, {
        method: 'DELETE',
      })

      if (!connectionResponse.ok) {
        throw new Error('Failed to delete connection')
      }

      // Delete all friend requests between the two users
      const deleteFriendRequestPromises = friendRequests.map((fr) =>
        fetch(`/api/friend-requests/${fr.id}/delete`, {
          method: 'DELETE',
        })
      )

      if (deleteFriendRequestPromises.length > 0) {
        const friendRequestResponses = await Promise.all(deleteFriendRequestPromises)
        const failedDeletes = friendRequestResponses.filter((res) => !res.ok)
        if (failedDeletes.length > 0) {
          console.warn('Some friend requests failed to delete:', failedDeletes.length)
        }
      }

      // Update state
      setConnection(null)
      setFriendRequests([])

      // Refresh report data to ensure consistency
      const reportResponse = await fetch(`/api/reports/${report.id}`)
      if (reportResponse.ok) {
        const updatedReport = await reportResponse.json()
        setConnection(updatedReport.connection)
        setFriendRequests(updatedReport.friend_requests || [])
      }
    } catch (error) {
      console.error('Error deleting connection:', error)
      alert('Failed to delete connection. Please try again.')
    } finally {
      setDeletingConnection(false)
    }
  }

  const handleDeleteFriendRequest = async (friendRequestId: string) => {
    if (!confirm('Are you sure you want to delete this friend request? This action cannot be undone.')) {
      return
    }

    setDeletingFriendRequest(friendRequestId)
    try {
      const response = await fetch(`/api/friend-requests/${friendRequestId}/delete`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete friend request')
      }

      setFriendRequests(friendRequests.filter(fr => fr.id !== friendRequestId))
      // Refresh report data
      const reportResponse = await fetch(`/api/reports/${report.id}`)
      if (reportResponse.ok) {
        const updatedReport = await reportResponse.json()
        setConnection(updatedReport.connection)
        setFriendRequests(updatedReport.friend_requests || [])
      }
    } catch (error) {
      console.error('Error deleting friend request:', error)
      alert('Failed to delete friend request. Please try again.')
    } finally {
      setDeletingFriendRequest(null)
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

  const reporterName = report.reporter_profile?.name || report.reporter_profile?.username || 'Unknown User'
  const reportedName = report.reported_profile?.name || report.reported_profile?.username || 'Unknown User'
  const reviewerName = report.reviewer_profile?.name || report.reviewer_profile?.username || null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Details</DialogTitle>
          <DialogDescription>
            Report ID: <span className="font-mono text-xs">{report.id}</span>
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
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Information and User Relationship */}
          <div className={`grid grid-cols-1 gap-4 ${!loadingRelationships && connection ? 'md:grid-cols-2' : ''}`}>
            {/* Users Card - Combined Reporter and Reported User */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <div className="space-y-4">
                {/* Reporter */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Reporter</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {report.reporter_profile?.profile_picture_url ? (
                        <AvatarImage src={report.reporter_profile.profile_picture_url} alt={reporterName} />
                      ) : (
                        <AvatarFallback>{reporterName.charAt(0).toUpperCase()}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{reporterName}</div>
                      {report.reporter_profile?.username && (
                        <div className="text-xs text-gray-500 truncate">@{report.reporter_profile.username}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Separator */}
                <div className="border-t border-gray-200" />

                {/* Reported User */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Reported User</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {report.reported_profile?.profile_picture_url ? (
                        <AvatarImage src={report.reported_profile.profile_picture_url} alt={reportedName} />
                      ) : (
                        <AvatarFallback>{reportedName.charAt(0).toUpperCase()}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{reportedName}</div>
                      {report.reported_profile?.username && (
                        <div className="text-xs text-gray-500 truncate">@{report.reported_profile.username}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* User Relationship Section */}
            {!loadingRelationships && connection && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">User Relationship</h3>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-900">Chat Connection</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {connection.status || 'active'}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteConnection}
                      disabled={deletingConnection}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingConnection ? 'Deleting...' : 'Delete Connection'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Report Information and Additional Details - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Report Details */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Report Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium text-gray-900">{TYPE_LABELS[report.type] || report.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Reason:</span>
                  <span className="font-medium text-gray-900">{REASON_LABELS[report.reason] || report.reason}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium text-gray-900">{formatDate(report.created_at)}</span>
                </div>
                {report.reviewed_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Reviewed:</span>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">{formatDate(report.reviewed_at)}</div>
                      {reviewerName && (
                        <div className="text-xs text-gray-500 mt-0.5">by {reviewerName}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Details Text */}
            {report.details ? (
              <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Additional Details</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.details}</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Additional Details</h3>
                <p className="text-sm text-gray-500 italic">No additional details provided</p>
              </div>
            )}
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
              placeholder="Enter your response to this report..."
              className="min-h-[120px] resize-none"
            />
            {adminResponse && (
              <p className="text-xs text-gray-500 mt-2">
                {adminResponse.length} characters
              </p>
            )}
          </div>

          {/* Context Based on Type */}
          {report.type === 'message' && (report.message_id || report.connection_id) && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-4 w-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900">Message Context</h3>
              </div>
              <div className="space-y-2 text-sm">
                {report.message_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Message ID:</span>
                    <span className="font-mono text-xs text-gray-900">{report.message_id}</span>
                  </div>
                )}
                {report.connection_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Connection ID:</span>
                    <span className="font-mono text-xs text-gray-900">{report.connection_id}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {report.type === 'image' && report.image_url && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="h-4 w-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900">Reported Image</h3>
              </div>
              <div className="relative w-full max-w-md aspect-square border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={report.image_url}
                  alt="Reported image"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => window.open(report.image_url!, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Full Size
              </Button>
            </div>
          )}

          {/* Evidence Image */}
          {evidenceImageUrl && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Evidence Image</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(evidenceImageUrl, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
              <div className="relative w-full max-w-md aspect-square border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={evidenceImageUrl}
                  alt="Evidence image"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

