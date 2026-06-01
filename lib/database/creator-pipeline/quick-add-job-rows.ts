export type QuickAddJobStatus =
  | 'pending'
  | 'scraping'
  | 'ready'
  | 'confirming'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type QuickAddJobRow = {
  id: string
  created_by: string
  url: string
  url_normalized: string
  status: QuickAddJobStatus
  resolved_payload: Record<string, unknown> | null
  plan_payload: Record<string, unknown> | null
  notes: string
  error_message: string | null
  result_profile_id: string | null
  result_creator_id: string | null
  result_contact_id: string | null
  review_required: boolean
  auto_confirm_eligible: boolean
  plan_warnings: { code: string; message: string; severity: string }[]
  confirmed_by: string | null
  created_at: string
  updated_at: string
  scraped_at: string | null
  completed_at: string | null
}
