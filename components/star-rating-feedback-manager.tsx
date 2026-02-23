'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'

interface StarRatingFeedbackItem {
  id: string
  user_id: string | null
  star_rating: number
  feedback_text: string | null
  created_at: string
  updated_at: string
  profile: {
    user_id: string
    name: string | null
    profile_picture_url: string | null
  } | null
}

interface RatingDistribution {
  1: number
  2: number
  3: number
  4: number
  5: number
}

interface ListResponse {
  items: StarRatingFeedbackItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  ratingDistribution: RatingDistribution
}

export default function StarRatingFeedbackManager() {
  const [items, setItems] = useState<StarRatingFeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [starFilter, setStarFilter] = useState<string>('all')
  const [ratingDistribution, setRatingDistribution] = useState<RatingDistribution | null>(null)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (starFilter && starFilter !== 'all') {
        params.append('starRating', starFilter)
      }
      params.append('page', page.toString())
      params.append('pageSize', '20')

      const response = await fetch(`/api/star-rating-feedback?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch star rating feedback')
      }
      const data: ListResponse = await response.json()
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      if (data.ratingDistribution) setRatingDistribution(data.ratingDistribution)
    } catch (error) {
      console.error('Error fetching star rating feedback:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [page, starFilter])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const feedbackDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

    if (feedbackDate.getTime() === today.getTime()) {
      return `Today, ${timeStr}`
    }
    if (feedbackDate.getTime() === yesterday.getTime()) {
      return `Yesterday, ${timeStr}`
    }
    const diffMs = today.getTime() - feedbackDate.getTime()
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }

  const distributionRows = useMemo(() => {
    if (!ratingDistribution) return []
    return [1, 2, 3, 4, 5].map((r) => ({
      stars: r,
      count: ratingDistribution[r as keyof RatingDistribution],
    }))
  }, [ratingDistribution])

  const { totalResponses, averageRating } = useMemo(() => {
    if (!ratingDistribution) return { totalResponses: 0, averageRating: 0 }
    const total =
      ratingDistribution[1] +
      ratingDistribution[2] +
      ratingDistribution[3] +
      ratingDistribution[4] +
      ratingDistribution[5]
    const sum =
      ratingDistribution[1] * 1 +
      ratingDistribution[2] * 2 +
      ratingDistribution[3] * 3 +
      ratingDistribution[4] * 4 +
      ratingDistribution[5] * 5
    return {
      totalResponses: total,
      averageRating: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
    }
  }, [ratingDistribution])

  const renderStars = (rating: number) => {
    return (
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i <= rating ? 'fill-amber-400 text-amber-500' : 'text-gray-200'}`}
          />
        ))}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {distributionRows.length > 0 && (
        <Card className="w-full max-w-md p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium text-gray-700">Ratings distribution</h3>
            <p className="text-sm text-gray-600">
              Average: <span className="font-semibold text-gray-900">{averageRating.toFixed(1)}</span>
              {totalResponses > 0 && (
                <span className="ml-1 text-gray-500">
                  ({totalResponses} response{totalResponses === 1 ? '' : 's'})
                </span>
              )}
            </p>
          </div>
          <div className="space-y-2">
            {distributionRows.map(({ stars, count }) => (
              <div
                key={stars}
                className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50/50 px-3 py-2"
              >
                <span className="inline-flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i <= stars ? 'fill-amber-400 text-amber-500' : 'text-gray-200'}`}
                    />
                  ))}
                </span>
                <span className="text-sm font-medium tabular-nums text-gray-700">
                  {count} {count === 1 ? 'time' : 'times'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Select value={starFilter} onValueChange={(v) => { setStarFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            <SelectItem value="1">1 star</SelectItem>
            <SelectItem value="2">2 stars</SelectItem>
            <SelectItem value="3">3 stars</SelectItem>
            <SelectItem value="4">4 stars</SelectItem>
            <SelectItem value="5">5 stars</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-gray-500">
          {total} feedback {total === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      <Card className="border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No star rating feedback yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Rating</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {row.profile ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 shrink-0">
                            {row.profile.profile_picture_url ? (
                              <AvatarImage src={row.profile.profile_picture_url} alt={row.profile.name ?? 'User'} />
                            ) : null}
                            <AvatarFallback className="text-xs">
                              {(row.profile.name || row.user_id || '?').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-gray-900 truncate max-w-[160px]" title={row.profile.name ?? row.user_id ?? undefined}>
                            {row.profile.name || row.user_id || '—'}
                          </span>
                        </div>
                      ) : row.user_id ? (
                        <span className="text-sm text-gray-500 font-mono truncate max-w-[140px]" title={row.user_id}>
                          {row.user_id}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {renderStars(row.star_rating)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-md">
                      {row.feedback_text ? (
                        <span className="line-clamp-2">{row.feedback_text}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
            <p className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
