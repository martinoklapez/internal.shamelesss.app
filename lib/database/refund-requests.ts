import { createClient } from '@/lib/supabase/server'
import { RefundRequest, RefundRequestWithProfile } from '@/types/database'

export async function getRefundRequests(
  filters: {
    status?: string
    search?: string
  } = {},
  page: number = 1,
  pageSize: number = 20
): Promise<{ requests: RefundRequestWithProfile[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const supabase = await createClient()

  let query = supabase
    .from('refund_requests')
    .select('*', { count: 'exact' })

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.search) {
    query = query.or(`reason.ilike.%${filters.search}%,transaction_id.ilike.%${filters.search}%`)
  }

  // Apply pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query.order('created_at', { ascending: false }).range(from, to)

  const { data: requests, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch refund requests: ${error.message}`)
  }

  // Fetch user profiles
  const userIds = new Set<string>()
  requests?.forEach((request) => {
    userIds.add(request.user_id)
    if (request.reviewed_by) {
      userIds.add(request.reviewed_by)
    }
  })

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, username, profile_picture_url')
    .in('user_id', Array.from(userIds))

  const profileMap = new Map(
    (profiles || []).map((p) => [p.user_id, p])
  )

  // Combine requests with profiles
  const requestsWithProfiles: RefundRequestWithProfile[] = (requests || []).map((request: RefundRequest) => ({
    ...request,
    user_profile: profileMap.get(request.user_id) || null,
    reviewer_profile: request.reviewed_by ? (profileMap.get(request.reviewed_by) || null) : null,
  }))

  const total = count || 0
  const totalPages = Math.ceil(total / pageSize)

  return {
    requests: requestsWithProfiles,
    total,
    page,
    pageSize,
    totalPages,
  }
}

export async function getRefundRequestById(id: string): Promise<RefundRequestWithProfile | null> {
  const supabase = await createClient()

  const { data: request, error } = await supabase
    .from('refund_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch refund request: ${error.message}`)
  }

  // Fetch user profiles
  const userIds = new Set<string>()
  userIds.add(request.user_id)
  if (request.reviewed_by) {
    userIds.add(request.reviewed_by)
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, username, profile_picture_url')
    .in('user_id', Array.from(userIds))

  const profileMap = new Map(
    (profiles || []).map((p) => [p.user_id, p])
  )

  return {
    ...request,
    user_profile: profileMap.get(request.user_id) || null,
    reviewer_profile: request.reviewed_by ? (profileMap.get(request.reviewed_by) || null) : null,
  } as RefundRequestWithProfile
}

export async function updateRefundRequestStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected' | 'processed',
  reviewerId: string
): Promise<RefundRequest> {
  const supabase = await createClient()

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  // If reviewing, set reviewed_at and reviewed_by
  if (status !== 'pending') {
    updateData.reviewed_at = new Date().toISOString()
    updateData.reviewed_by = reviewerId
  }

  const { data, error } = await supabase
    .from('refund_requests')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update refund request status: ${error.message}`)
  }

  return data as RefundRequest
}

export async function updateRefundRequestAdminResponse(
  id: string,
  adminResponse: string
): Promise<RefundRequest> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('refund_requests')
    .update({
      admin_response: adminResponse,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update admin response: ${error.message}`)
  }

  return data as RefundRequest
}

export async function getRefundRequestStats(): Promise<{
  total: number
  pending: number
  approved: number
  rejected: number
  processed: number
}> {
  const supabase = await createClient()

  const { count: total } = await supabase
    .from('refund_requests')
    .select('*', { count: 'exact', head: true })

  const { count: pending } = await supabase
    .from('refund_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: approved } = await supabase
    .from('refund_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')

  const { count: rejected } = await supabase
    .from('refund_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'rejected')

  const { count: processed } = await supabase
    .from('refund_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processed')

  return {
    total: total || 0,
    pending: pending || 0,
    approved: approved || 0,
    rejected: rejected || 0,
    processed: processed || 0,
  }
}
