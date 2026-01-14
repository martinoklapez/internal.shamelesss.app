import { createClient } from '@/lib/supabase/server'
import { SupportTicket, SupportTicketWithProfile } from '@/types/database'

export async function getSupportTickets(
  filters: {
    status?: string
    search?: string
  } = {},
  page: number = 1,
  pageSize: number = 20
): Promise<{ tickets: SupportTicketWithProfile[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const supabase = await createClient()

  let query = supabase
    .from('support_tickets')
    .select('*', { count: 'exact' })

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.search) {
    query = query.or(`subject.ilike.%${filters.search}%,message.ilike.%${filters.search}%`)
  }

  // Apply pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  query = query.order('created_at', { ascending: false }).range(from, to)

  const { data: tickets, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch support tickets: ${error.message}`)
  }

  // Fetch user profiles
  const userIds = new Set<string>()
  tickets?.forEach((ticket) => {
    userIds.add(ticket.user_id)
    if (ticket.resolved_by) {
      userIds.add(ticket.resolved_by)
    }
  })

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, username, profile_picture_url')
    .in('user_id', Array.from(userIds))

  const profileMap = new Map(
    (profiles || []).map((p) => [p.user_id, p])
  )

  // Combine tickets with profiles
  const ticketsWithProfiles: SupportTicketWithProfile[] = (tickets || []).map((ticket: SupportTicket) => ({
    ...ticket,
    user_profile: profileMap.get(ticket.user_id) || null,
    resolver_profile: ticket.resolved_by ? (profileMap.get(ticket.resolved_by) || null) : null,
  }))

  const total = count || 0
  const totalPages = Math.ceil(total / pageSize)

  return {
    tickets: ticketsWithProfiles,
    total,
    page,
    pageSize,
    totalPages,
  }
}

export async function getSupportTicketById(id: string): Promise<SupportTicketWithProfile | null> {
  const supabase = await createClient()

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch support ticket: ${error.message}`)
  }

  // Fetch user profiles
  const userIds = new Set<string>()
  userIds.add(ticket.user_id)
  if (ticket.resolved_by) {
    userIds.add(ticket.resolved_by)
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, username, profile_picture_url')
    .in('user_id', Array.from(userIds))

  const profileMap = new Map(
    (profiles || []).map((p) => [p.user_id, p])
  )

  return {
    ...ticket,
    user_profile: profileMap.get(ticket.user_id) || null,
    resolver_profile: ticket.resolved_by ? (profileMap.get(ticket.resolved_by) || null) : null,
  } as SupportTicketWithProfile
}

export async function updateSupportTicketStatus(
  id: string,
  status: 'open' | 'in_progress' | 'resolved' | 'closed',
  resolverId: string
): Promise<SupportTicket> {
  const supabase = await createClient()

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  // If resolving or closing, set resolved_at and resolved_by
  if (status === 'resolved' || status === 'closed') {
    updateData.resolved_at = new Date().toISOString()
    updateData.resolved_by = resolverId
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update support ticket status: ${error.message}`)
  }

  return data as SupportTicket
}

export async function updateSupportTicketAdminResponse(
  id: string,
  adminResponse: string
): Promise<SupportTicket> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('support_tickets')
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

  return data as SupportTicket
}

export async function getSupportTicketStats(): Promise<{
  total: number
  open: number
  in_progress: number
  resolved: number
  closed: number
}> {
  const supabase = await createClient()

  const { count: total } = await supabase
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })

  const { count: open } = await supabase
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')

  const { count: inProgress } = await supabase
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'in_progress')

  const { count: resolved } = await supabase
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'resolved')

  const { count: closed } = await supabase
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'closed')

  return {
    total: total || 0,
    open: open || 0,
    in_progress: inProgress || 0,
    resolved: resolved || 0,
    closed: closed || 0,
  }
}
