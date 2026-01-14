import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Report, ReportWithProfiles } from '@/types/database'

export interface ReportFilters {
  status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed' | 'open' | 'closed'
  type?: 'user' | 'message' | 'image'
  startDate?: string
  endDate?: string
  search?: string
}

export interface ReportListResponse {
  reports: ReportWithProfiles[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getReports(
  filters: ReportFilters = {},
  page: number = 1,
  pageSize: number = 20
): Promise<ReportListResponse> {
  const supabase = await createClient()
  
  let query = supabase
    .from('reports')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  // Apply filters
  if (filters.status) {
    if (filters.status === 'open') {
      // Open = pending or reviewed
      query = query.in('status', ['pending', 'reviewed'])
    } else if (filters.status === 'closed') {
      // Closed = resolved or dismissed
      query = query.in('status', ['resolved', 'dismissed'])
    } else {
      query = query.eq('status', filters.status)
    }
  }
  
  if (filters.type) {
    query = query.eq('type', filters.type)
  }
  
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate)
  }
  
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate)
  }
  
  if (filters.search) {
    // Search by report ID or user IDs
    const searchTerm = `%${filters.search}%`
    query = query.or(`id.ilike.${searchTerm},reported_user_id.ilike.${searchTerm},reporter_user_id.ilike.${searchTerm}`)
  }

  // Apply pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data: reports, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch reports: ${error.message}`)
  }

  if (!reports || reports.length === 0) {
    return {
      reports: [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }
  }

  // Fetch profiles for all users involved
  const userIds = new Set<string>()
  reports.forEach((report: Report) => {
    userIds.add(report.reporter_user_id)
    userIds.add(report.reported_user_id)
    if (report.reviewed_by) {
      userIds.add(report.reviewed_by)
    }
  })

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, username, profile_picture_url')
    .in('user_id', Array.from(userIds))

  const profileMap = new Map(
    (profiles || []).map((p) => [p.user_id, p])
  )

  // Combine reports with profiles
  const reportsWithProfiles: ReportWithProfiles[] = reports.map((report: Report) => ({
    ...report,
    reporter_profile: profileMap.get(report.reporter_user_id) || null,
    reported_profile: profileMap.get(report.reported_user_id) || null,
    reviewer_profile: report.reviewed_by ? (profileMap.get(report.reviewed_by) || null) : null,
  }))

  return {
    reports: reportsWithProfiles,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  }
}

export async function getReportById(id: string): Promise<ReportWithProfiles | null> {
  const supabase = await createClient()
  
  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch report: ${error.message}`)
  }

  if (!report) {
    return null
  }

  // Fetch profiles for all users involved
  const userIds = [
    report.reporter_user_id,
    report.reported_user_id,
    report.reviewed_by,
  ].filter(Boolean) as string[]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, username, profile_picture_url')
    .in('user_id', userIds)

  const profileMap = new Map(
    (profiles || []).map((p) => [p.user_id, p])
  )

  // Fetch connection between reporter and reported user
  // Use admin client to bypass RLS (connections table may have RLS policies)
  const reporterId = report.reporter_user_id
  const reportedId = report.reported_user_id

  // Use admin client (service role) to bypass RLS for admin operations
  let connectionsClient = supabase
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    connectionsClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  // Query 1: reporter = user_id_1, reported = user_id_2
  const { data: connections1, error: conn1Error } = await connectionsClient
    .from('connections')
    .select('*')
    .eq('user_id_1', reporterId)
    .eq('user_id_2', reportedId)

  if (conn1Error) {
    console.error('❌ Error fetching connections1:', conn1Error)
  } else {
    console.log('✅ Query 1 result:', connections1?.length || 0, 'connections')
  }

  // Query 2: reported = user_id_1, reporter = user_id_2
  const { data: connections2, error: conn2Error } = await connectionsClient
    .from('connections')
    .select('*')
    .eq('user_id_1', reportedId)
    .eq('user_id_2', reporterId)

  if (conn2Error) {
    console.error('❌ Error fetching connections2:', conn2Error)
  } else {
    console.log('✅ Query 2 result:', connections2?.length || 0, 'connections')
  }

  // Combine results
  const allConnections = [
    ...(connections1 || []),
    ...(connections2 || [])
  ]

  console.log('Total connections found:', allConnections.length)

  // Prefer active connections (status = 'active' or null), but show any if exists
  const activeConnection = allConnections.find(c => !c.status || c.status === 'active')
  const connection = activeConnection || (allConnections.length > 0 ? allConnections[0] : null)

  console.log(connection ? '✅ Connection found!' : '❌ No connection found')
  console.log('=== CONNECTION SEARCH END ===')

  // Fetch friend requests between reporter and reported user (both directions)
  // Use admin client to bypass RLS
  const { data: friendRequests1, error: fr1Error } = await connectionsClient
    .from('friend_requests')
    .select('*')
    .eq('from_user_id', report.reporter_user_id)
    .eq('to_user_id', report.reported_user_id)

  if (fr1Error) {
    console.error('Error fetching friend requests 1:', fr1Error)
  }

  const { data: friendRequests2, error: fr2Error } = await connectionsClient
    .from('friend_requests')
    .select('*')
    .eq('from_user_id', report.reported_user_id)
    .eq('to_user_id', report.reporter_user_id)

  if (fr2Error) {
    console.error('Error fetching friend requests 2:', fr2Error)
  }

  const allFriendRequests = [
    ...(friendRequests1 || []),
    ...(friendRequests2 || []),
  ].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
    return dateB - dateA
  })

  return {
    ...report,
    reporter_profile: profileMap.get(report.reporter_user_id) || null,
    reported_profile: profileMap.get(report.reported_user_id) || null,
    reviewer_profile: report.reviewed_by ? (profileMap.get(report.reviewed_by) || null) : null,
    connection: connection || null,
    friend_requests: allFriendRequests || [],
  } as ReportWithProfiles
}

export async function updateReportStatus(
  id: string,
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed',
  reviewerId: string
): Promise<Report> {
  const supabase = await createClient()
  
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  // If moving from pending to reviewed/resolved/dismissed, set reviewed_at and reviewed_by
  if (status !== 'pending') {
    updateData.reviewed_at = new Date().toISOString()
    updateData.reviewed_by = reviewerId
  }

  const { data, error } = await supabase
    .from('reports')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update report status: ${error.message}`)
  }

  return data as Report
}

export interface ReportStats {
  total: number
  open: number
  closed: number
  recentCount: number // Reports in last 7 days
}

export async function getReportStats(): Promise<ReportStats> {
  const supabase = await createClient()
  
  // Get total count
  const { count: total, error: totalError } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true })

  if (totalError) {
    throw new Error(`Failed to fetch report stats: ${totalError.message}`)
  }

  // Get counts by status
  const { data: statusData, error: statusError } = await supabase
    .from('reports')
    .select('status')

  if (statusError) {
    throw new Error(`Failed to fetch status stats: ${statusError.message}`)
  }

  let open = 0
  let closed = 0

  statusData?.forEach((report) => {
    if (report.status === 'pending' || report.status === 'reviewed') {
      open++
    } else if (report.status === 'resolved' || report.status === 'dismissed') {
      closed++
    }
  })

  // Get recent count (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  
  const { count: recentCount, error: recentError } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo.toISOString())

  if (recentError) {
    throw new Error(`Failed to fetch recent stats: ${recentError.message}`)
  }

  return {
    total: total || 0,
    open,
    closed,
    recentCount: recentCount || 0,
  }
}

export async function generateEvidenceImageSignedUrl(
  storagePath: string,
  expiresIn: number = 31536000 // 1 year in seconds
): Promise<string> {
  const supabase = await createClient()
  
  const { data, error } = await supabase.storage
    .from('report-evidence')
    .createSignedUrl(storagePath, expiresIn)

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`)
  }

  return data.signedUrl
}

