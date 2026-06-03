import type { MissiveEmailDetail, MissiveSentEmail } from './fetch-missive-sent-emails'
import type { CreatorOutreachStore } from './types'
import type { EvaluateOutreachResult } from './rules-engine'
import type { QuickAddJobView } from './quick-add-jobs'

export async function fetchCreatorOutreachStore(): Promise<CreatorOutreachStore> {
  const res = await fetch('/api/creator-pipeline', { cache: 'no-store' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Failed to load pipeline (${res.status})`)
  }
  return res.json() as Promise<CreatorOutreachStore>
}

export async function mutateCreatorOutreach<T extends Record<string, unknown>>(
  body: T
): Promise<{
  store: CreatorOutreachStore
  outreach?: EvaluateOutreachResult
  missiveSent?: number
  missiveFailed?: number
  lastMissiveError?: string
  lastMissiveWarning?: string
  lastMissiveWarning?: string
}> {
  const res = await fetch('/api/creator-pipeline/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Pipeline update failed (${res.status})`)
  }
  return res.json() as Promise<{
    store: CreatorOutreachStore
    outreach?: EvaluateOutreachResult
    missiveSent?: number
    missiveFailed?: number
    lastMissiveError?: string
  lastMissiveWarning?: string
  }>
}

export async function fetchMissiveSentEmails(
  conversationIds: string[]
): Promise<{ emails: MissiveSentEmail[]; error?: string }> {
  if (conversationIds.length === 0) {
    return { emails: [] }
  }
  const params = new URLSearchParams({
    conversationIds: conversationIds.join(','),
  })
  const res = await fetch(`/api/creator-pipeline/missive-messages?${params}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Failed to load Missive emails (${res.status})`)
  }
  return res.json() as Promise<{ emails: MissiveSentEmail[]; error?: string }>
}

export async function fetchMissiveEmailDetail(
  messageId: string,
  conversationId: string,
  missiveWebUrl: string | null
): Promise<MissiveEmailDetail> {
  const params = new URLSearchParams({
    messageId,
    conversationId,
  })
  if (missiveWebUrl) params.set('missiveWebUrl', missiveWebUrl)

  const res = await fetch(`/api/creator-pipeline/missive-messages?${params}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Failed to load email (${res.status})`)
  }
  const data = (await res.json()) as { detail: MissiveEmailDetail }
  return data.detail
}

export async function fetchQuickAddJobs(): Promise<QuickAddJobView[]> {
  const res = await fetch('/api/creator-pipeline/quick-add/jobs', { cache: 'no-store' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Failed to load quick add queue (${res.status})`)
  }
  const data = (await res.json()) as { jobs: QuickAddJobView[] }
  return data.jobs
}

export async function enqueueQuickAddUrls(
  url: string
): Promise<{ jobs: QuickAddJobView[]; skipped: string[] }> {
  const res = await fetch('/api/creator-pipeline/quick-add/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Failed to enqueue (${res.status})`)
  }
  return res.json() as Promise<{ jobs: QuickAddJobView[]; skipped: string[] }>
}

export async function confirmQuickAddJob(
  jobId: string,
  notes: string,
  options?: { force?: boolean; allowAuto?: boolean }
): Promise<{
  store: CreatorOutreachStore
  job: QuickAddJobView
  outreach?: EvaluateOutreachResult
  missiveSent?: number
  missiveFailed?: number
  lastMissiveError?: string
  lastMissiveWarning?: string
}> {
  const res = await fetch(`/api/creator-pipeline/quick-add/jobs/${jobId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notes,
      force: options?.force,
      allowAuto: options?.allowAuto,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Confirm failed (${res.status})`)
  }
  return res.json() as Promise<{
    store: CreatorOutreachStore
    job: QuickAddJobView
    outreach?: EvaluateOutreachResult
    missiveSent?: number
    missiveFailed?: number
    lastMissiveError?: string
  lastMissiveWarning?: string
  }>
}

export async function retryQuickAddJob(jobId: string): Promise<QuickAddJobView> {
  const res = await fetch(`/api/creator-pipeline/quick-add/jobs/${jobId}/retry`, {
    method: 'POST',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Retry failed (${res.status})`)
  }
  const data = (await res.json()) as { job: QuickAddJobView }
  return data.job
}
