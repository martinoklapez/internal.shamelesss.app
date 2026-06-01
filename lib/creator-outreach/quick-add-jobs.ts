import type { ResolvedSocialProfile } from '@/lib/social-profile-url'
import { parseSocialProfileUrl } from '@/lib/social-profile-url'
import type { QuickAddPlan } from './quick-add'
import type { QuickAddPlanWarning } from './quick-add-integrity'
import type { QuickAddJobRow, QuickAddJobStatus } from '@/lib/database/creator-pipeline/quick-add-job-rows'

export type { QuickAddJobStatus }

/** Client/UI view of a server quick-add job. */
export type QuickAddJobView = {
  id: string
  url: string
  status: QuickAddJobStatus
  errorMessage: string | null
  notes: string
  createdAt: string
  createdBy: string
  resolved: ResolvedSocialProfile | null
  resultProfileId: string | null
  resultCreatorId: string | null
  resultContactId: string | null
  reviewRequired: boolean
  autoConfirmEligible: boolean
  warnings: QuickAddPlanWarning[]
  plan: QuickAddPlan | null
  optimistic?: boolean
  fifoPosition?: number
  readyAhead?: number
}

export function normalizeQuickAddJobUrl(url: string): string {
  const trimmed = url.trim()
  const parsed = parseSocialProfileUrl(trimmed)
  if (!parsed) return trimmed.toLowerCase()
  return `${parsed.platform}:${parsed.handle.replace(/^@/, '').toLowerCase()}`
}

export function mapQuickAddJobRow(row: QuickAddJobRow): QuickAddJobView {
  return {
    id: row.id,
    url: row.url,
    status: row.status,
    errorMessage: row.error_message,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    createdBy: row.created_by,
    resolved: (row.resolved_payload as ResolvedSocialProfile | null) ?? null,
    resultProfileId: row.result_profile_id,
    resultCreatorId: row.result_creator_id,
    resultContactId: row.result_contact_id,
    reviewRequired: row.review_required ?? true,
    autoConfirmEligible: row.auto_confirm_eligible ?? false,
    warnings: (row.plan_warnings ?? []) as QuickAddPlanWarning[],
    plan: (row.plan_payload as QuickAddPlan | null) ?? null,
  }
}

export function optimisticQuickAddJob(url: string, createdBy: string): QuickAddJobView {
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    url,
    status: 'pending',
    errorMessage: null,
    notes: '',
    createdAt: new Date().toISOString(),
    createdBy,
    resolved: null,
    resultProfileId: null,
    resultCreatorId: null,
    resultContactId: null,
    reviewRequired: true,
    autoConfirmEligible: false,
    warnings: [],
    plan: null,
    optimistic: true,
  }
}

export type StoredQuickAddPlan = QuickAddPlan

export function serializeQuickAddPlan(plan: QuickAddPlan): StoredQuickAddPlan {
  return structuredClone(plan)
}
