import { createClient } from '@/lib/supabase/server'

export interface StarRatingFeedbackRow {
  id: string
  user_id: string | null
  star_rating: number
  feedback_text: string | null
  created_at: string
  updated_at: string
}

export interface StarRatingFeedbackProfile {
  user_id: string
  name: string | null
  profile_picture_url: string | null
}

export interface StarRatingFeedbackWithProfile extends StarRatingFeedbackRow {
  profile: StarRatingFeedbackProfile | null
}

export interface StarRatingFeedbackFilters {
  starRating?: number
  minRating?: number
  maxRating?: number
}

export interface StarRatingFeedbackListResponse {
  items: StarRatingFeedbackWithProfile[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getStarRatingFeedback(
  filters: StarRatingFeedbackFilters = {},
  page: number = 1,
  pageSize: number = 20
): Promise<StarRatingFeedbackListResponse> {
  const supabase = await createClient()

  let query = supabase
    .from('star_rating_feedback')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.starRating != null) {
    query = query.eq('star_rating', filters.starRating)
  }
  if (filters.minRating != null) {
    query = query.gte('star_rating', filters.minRating)
  }
  if (filters.maxRating != null) {
    query = query.lte('star_rating', filters.maxRating)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data: rows, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch star rating feedback: ${error.message}`)
  }

  const items = (rows as StarRatingFeedbackRow[]) ?? []
  const userIds = [...new Set(items.map((r) => r.user_id).filter(Boolean))] as string[]

  let profileMap = new Map<string, StarRatingFeedbackProfile>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name, profile_picture_url')
      .in('user_id', userIds)
    profileMap = new Map(
      (profiles || []).map((p) => [
        p.user_id,
        { user_id: p.user_id, name: p.name ?? null, profile_picture_url: p.profile_picture_url ?? null },
      ])
    )
  }

  const itemsWithProfiles: StarRatingFeedbackWithProfile[] = items.map((row) => ({
    ...row,
    profile: row.user_id ? (profileMap.get(row.user_id) ?? null) : null,
  }))

  const total = count ?? 0
  const totalPages = Math.ceil(total / pageSize) || 1

  return {
    items: itemsWithProfiles,
    total,
    page,
    pageSize,
    totalPages,
  }
}

export interface StarRatingDistribution {
  1: number
  2: number
  3: number
  4: number
  5: number
}

export async function getStarRatingDistribution(): Promise<StarRatingDistribution> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('star_rating_feedback')
    .select('star_rating')

  if (error) {
    throw new Error(`Failed to fetch star rating distribution: ${error.message}`)
  }

  const rows = (data ?? []) as { star_rating: number }[]
  const dist: StarRatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const row of rows) {
    if (row.star_rating >= 1 && row.star_rating <= 5) {
      dist[row.star_rating as keyof StarRatingDistribution]++
    }
  }
  return dist
}
