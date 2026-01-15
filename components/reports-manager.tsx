'use client'

import { useState, useEffect } from 'react'
import { ReportWithProfiles } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ReportDetailDialog } from './report-detail-dialog'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'

interface ReportListResponse {
  reports: ReportWithProfiles[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  reviewed: 'bg-blue-100 text-blue-800 border-blue-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  dismissed: 'bg-red-100 text-red-800 border-red-200',
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate_content: 'Inappropriate Content',
  impersonation: 'Impersonation',
  other: 'Other',
}

export default function ReportsManager() {
  const [reports, setReports] = useState<ReportWithProfiles[]>([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [filters, setFilters] = useState({
    status: 'open' as string,
    type: '' as string,
    search: '',
  })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [selectedReport, setSelectedReport] = useState<ReportWithProfiles | null>(null)

  const fetchReports = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.type) params.append('type', filters.type)
      if (filters.search) params.append('search', filters.search)
      params.append('page', page.toString())
      params.append('pageSize', '20')

      const response = await fetch(`/api/reports?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch reports')
      }
      const data: ReportListResponse = await response.json()
      setReports(data.reports)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const response = await fetch('/api/reports/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
    fetchStats()
  }, [page, filters.status, filters.type])

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchReports()
      } else {
        setPage(1)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [filters.search])

  const handleStatusChange = (status: string) => {
    setFilters({ ...filters, status: status || '' })
    setPage(1)
  }

  const handleTypeChange = (type: string) => {
    setFilters({ ...filters, type: type || '' })
    setPage(1)
  }

  const handleSearchChange = (search: string) => {
    setFilters({ ...filters, search })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const reportDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (reportDate.getTime() === today.getTime()) {
      return `Today, ${date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    } else if (reportDate.getTime() === yesterday.getTime()) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        {/* Status Tab Menu */}
        <div className="inline-flex items-center rounded-md border border-gray-300 bg-white p-1 overflow-x-auto flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleStatusChange('open')}
            className={`h-8 px-4 transition-all whitespace-nowrap hover:bg-transparent hover:text-gray-500 relative ${
              filters.status === 'open'
                ? 'bg-white text-gray-900 font-semibold shadow-sm border border-gray-200'
                : 'text-gray-500'
            }`}
          >
            Open
            {statsLoading ? (
              <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 animate-pulse" />
            ) : stats && stats.open > 0 ? (
              <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                {stats.open}
              </span>
            ) : null}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleStatusChange('closed')}
            className={`h-8 px-4 transition-all whitespace-nowrap hover:bg-transparent hover:text-gray-500 relative ${
              filters.status === 'closed'
                ? 'bg-white text-gray-900 font-semibold shadow-sm border border-gray-200'
                : 'text-gray-500'
            }`}
          >
            Closed
            {statsLoading ? (
              <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 animate-pulse" />
            ) : stats && stats.closed > 0 ? (
              <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                {stats.closed}
              </span>
            ) : null}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleStatusChange('')}
            className={`h-8 px-4 transition-all whitespace-nowrap hover:bg-transparent hover:text-gray-500 ${
              filters.status === ''
                ? 'bg-white text-gray-900 font-semibold shadow-sm border border-gray-200'
                : 'text-gray-500'
            }`}
          >
            All
          </Button>
        </div>

        {/* Search Field */}
        <div className="flex-1 min-w-0">
          <Label htmlFor="search" className="sr-only">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="search"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 w-full border-gray-300 bg-white focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-300"
            />
          </div>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Select value={filters.type || undefined} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-[180px] focus:ring-0 focus:ring-offset-0 focus:border-gray-300">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="message">Message</SelectItem>
              <SelectItem value="image">Image</SelectItem>
            </SelectContent>
          </Select>
          {filters.type && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleTypeChange('')}
              className="h-10 w-10 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-full divide-y divide-gray-100">
            {/* Header - Always visible */}
            <div className="hidden sm:grid sm:grid-cols-3 gap-4 py-3 bg-gray-50/50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div className="px-6">Status</div>
              <div className="px-6">Reason</div>
              <div className="px-6">Created</div>
            </div>

            {/* Loading Skeleton Rows */}
            {loading ? (
              <>
                {[...Array(5)].map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="sm:grid sm:grid-cols-3 gap-4 py-4"
                  >
                    <div className="col-span-1 mb-2 sm:mb-0 px-6">
                      <div className="text-xs text-gray-500 sm:hidden">Status</div>
                      <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
                    </div>
                    <div className="col-span-1 mb-2 sm:mb-0 px-6">
                      <div className="text-xs text-gray-500 sm:hidden">Reason</div>
                      <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                    </div>
                    <div className="col-span-1 mb-2 sm:mb-0 px-6">
                      <div className="text-xs text-gray-500 sm:hidden">Created</div>
                      <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </>
            ) : reports.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No reports found.</div>
            ) : (
              <>
                {/* Report Rows */}
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="sm:grid sm:grid-cols-3 gap-4 py-4 hover:bg-gray-50/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedReport(report)}
                  >
                    <div className="col-span-1 mb-2 sm:mb-0 px-6">
                      <div className="text-xs text-gray-500 sm:hidden">Status</div>
                      <Badge className={STATUS_COLORS[report.status] || ''}>
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="col-span-1 mb-2 sm:mb-0 px-6">
                      <div className="text-xs text-gray-500 sm:hidden">Reason</div>
                      <div className="text-sm text-gray-900">{REASON_LABELS[report.reason] || report.reason}</div>
                    </div>
                    <div className="col-span-1 mb-2 sm:mb-0 px-6">
                      <div className="text-xs text-gray-500 sm:hidden">Created</div>
                      <div className="text-sm text-gray-900">{formatDate(report.created_at)}</div>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 mt-0">
                  <div className="text-sm text-gray-700">
                    Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} reports
                  </div>
                  {totalPages > 1 && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let pageNum: number
                          if (totalPages <= 5) {
                            pageNum = i + 1
                          } else if (page <= 3) {
                            pageNum = i + 1
                          } else if (page >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                          } else {
                            pageNum = page - 2 + i
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={page === pageNum ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setPage(pageNum)}
                              className="min-w-[2rem]"
                            >
                              {pageNum}
                            </Button>
                          )
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {selectedReport && (
        <ReportDetailDialog
          report={selectedReport}
          open={!!selectedReport}
          onOpenChange={(open) => !open && setSelectedReport(null)}
          onStatusUpdate={fetchReports}
        />
      )}
    </div>
  )
}

