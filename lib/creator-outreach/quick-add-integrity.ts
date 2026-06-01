import {
  findCrossPlatformProfileByHandle,
  findProfileByPlatformHandle,
  normalizeHandle,
  planQuickAdd,
  type QuickAddPlan,
} from './quick-add'
import { platformLabel } from './store'
import type { QuickAddJobRow, QuickAddJobStatus } from '@/lib/database/creator-pipeline/quick-add-job-rows'
import type { ResolvedSocialProfile } from '@/lib/social-profile-url'
import { parseSocialProfileUrl } from '@/lib/social-profile-url'
import { normalizeEmail } from './store'
import type {
  CreatorContact,
  CreatorOutreachStore,
  CreatorPerson,
  OutreachPlatform,
  SocialMediaProfile,
} from './types'

const SHADOW_PREFIX = 'queue-shadow:'

export type QuickAddPlanWarning = {
  code:
    | 'queue_email_conflict'
    | 'queue_creator_name_conflict'
    | 'queue_handle_pending'
    | 'fuzzy_creator_name'
    | 'ambiguous_email'
    | 'profile_unlinked'
    | 'plan_stale'
    | 'out_of_fifo_order'
    | 'queue_cross_platform_handle'
  message: string
  severity: 'info' | 'warn' | 'block'
}

export type QuickAddIntegrityAssessment = {
  plan: QuickAddPlan
  reviewRequired: boolean
  autoConfirmEligible: boolean
  warnings: QuickAddPlanWarning[]
  fifoPosition: number
  readyAhead: number
}

export type QuickAddQueuePeer = {
  jobId: string
  status: QuickAddJobStatus
  url: string
  urlNormalized: string
  createdAt: string
  resolved: ResolvedSocialProfile | null
  plan: QuickAddPlan | null
}

export function quickAddJobRowToPeer(row: QuickAddJobRow): QuickAddQueuePeer {
  return {
    jobId: row.id,
    status: row.status,
    url: row.url,
    urlNormalized: row.url_normalized,
    createdAt: row.created_at,
    resolved: (row.resolved_payload as ResolvedSocialProfile | null) ?? null,
    plan: (row.plan_payload as QuickAddPlan | null) ?? null,
  }
}

function peerPlatformHandle(peer: QuickAddQueuePeer): {
  platform: OutreachPlatform
  handle: string
} | null {
  if (peer.resolved) {
    return {
      platform: peer.resolved.platform,
      handle: normalizeHandle(peer.resolved.username),
    }
  }
  const parts = peer.urlNormalized.split(':')
  if (parts.length !== 2) {
    const parsed = parseSocialProfileUrl(peer.url)
    if (!parsed) return null
    return { platform: parsed.platform, handle: normalizeHandle(parsed.handle) }
  }
  const platform = parts[0] as OutreachPlatform
  if (platform !== 'instagram' && platform !== 'tiktok') return null
  return { platform, handle: normalizeHandle(parts[1]) }
}

function shadowCreatorId(jobId: string): string {
  return `${SHADOW_PREFIX}creator:${jobId}`
}

function shadowProfileId(jobId: string): string {
  return `${SHADOW_PREFIX}profile:${jobId}`
}

function shadowContactId(jobId: string): string {
  return `${SHADOW_PREFIX}contact:${jobId}`
}

/** Overlay in-queue intents onto a clone of the CRM store for planning only. */
export function buildPlanningStoreWithQueue(
  store: CreatorOutreachStore,
  peers: QuickAddQueuePeer[],
  forJobId: string
): CreatorOutreachStore {
  const next = structuredClone(store)
  const ordered = [...peers]
    .filter((p) => p.jobId !== forJobId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  for (const peer of ordered) {
    if (!['pending', 'scraping', 'ready', 'confirming'].includes(peer.status)) continue

    const ph = peerPlatformHandle(peer)
    if (!ph) continue

    const plan =
      peer.plan ??
      (peer.resolved
        ? planQuickAdd(next, {
            platform: peer.resolved.platform,
            handle: peer.resolved.username,
            displayName: peer.resolved.name.trim() || peer.resolved.username,
            draftContact: peer.resolved.draftContact,
          })
        : null)

    const existing = findProfileByPlatformHandle(next, ph.platform, ph.handle)
    const crossSibling = findCrossPlatformProfileByHandle(next, ph.platform, ph.handle)
    if (!existing && (!plan || plan.profile.action === 'create')) {
      const displayName =
        peer.resolved?.name.trim() ||
        peer.resolved?.username ||
        ph.handle
      const profile: SocialMediaProfile = {
        id: shadowProfileId(peer.jobId),
        platform: ph.platform,
        handle: ph.handle,
        displayName,
        profileUrl: peer.resolved?.profileUrl ?? peer.url,
        avatarUrl: null,
        followerCount: peer.resolved?.followerCount ?? null,
        creatorId: null,
        notes: '',
        scoutedAt: peer.createdAt,
        scoutedBy: '',
      }
      next.profiles.push(profile)
    }

    if (!plan) continue

    let creatorId: string | null = null
    if (plan.creator.action === 'link') {
      creatorId = plan.creator.creator.id
    } else {
      const cid = shadowCreatorId(peer.jobId)
      if (!next.creators.some((c) => c.id === cid)) {
        const creator: CreatorPerson = {
          id: cid,
          displayName: plan.creator.displayName,
          status: 'new',
          notes: '',
          avatarProfileId: null,
          createdAt: peer.createdAt,
          updatedAt: peer.createdAt,
        }
        next.creators.push(creator)
      }
      creatorId = cid
    }

    const profile =
      plan.profile.action === 'existing'
        ? plan.profile.profile
        : findProfileByPlatformHandle(next, ph.platform, ph.handle)

    if (profile && creatorId && !profile.creatorId) {
      profile.creatorId = creatorId
    }

    if (
      crossSibling &&
      !crossSibling.creatorId &&
      creatorId &&
      plan?.profile.action === 'create'
    ) {
      crossSibling.creatorId = creatorId
    }

    if (plan.contact.action === 'create') {
      const email = normalizeEmail(plan.contact.draft.email)
      const duplicate = next.contacts.some(
        (c) => c.email && normalizeEmail(c.email) === email
      )
      if (!duplicate) {
        const contact: CreatorContact = {
          id: shadowContactId(peer.jobId),
          creatorId,
          kind: 'creator',
          name:
            plan.contact.draft.name.trim() ||
            (plan.creator.action === 'create'
              ? plan.creator.displayName
              : plan.creator.creator.displayName),
          company: '',
          email,
          phone: '',
          notes: '',
          status: 'new',
          missiveConversationIds: [],
          createdAt: peer.createdAt,
        }
        next.contacts.push(contact)
      }
    } else if (
      plan.contact.action === 'link' &&
      plan.contact.contact.creatorId &&
      creatorId
    ) {
      const linked = plan.contact.contact
      const contact = next.contacts.find((c) => c.id === linked.id)
      if (contact && !contact.creatorId) contact.creatorId = creatorId
    }
  }

  return next
}

function plansMateriallyDiffer(a: QuickAddPlan, b: QuickAddPlan): boolean {
  if (a.profile.action !== b.profile.action) return true
  if (a.profile.action === 'existing' && b.profile.action === 'existing') {
    if (a.profile.profile.id !== b.profile.profile.id) return true
  }
  if (a.creator.action !== b.creator.action) return true
  if (a.creator.action === 'link' && b.creator.action === 'link') {
    if (a.creator.creator.id !== b.creator.creator.id) return true
  } else if (a.creator.action === 'create' && b.creator.action === 'create') {
    if (a.creator.displayName.trim().toLowerCase() !== b.creator.displayName.trim().toLowerCase()) {
      return true
    }
  }
  if (a.contact.action !== b.contact.action) return true
  if (a.contact.action === 'link' && b.contact.action === 'link') {
    if (a.contact.contact.id !== b.contact.contact.id) return true
  }
  if (a.contact.action === 'create' && b.contact.action === 'create') {
    if (normalizeEmail(a.contact.draft.email) !== normalizeEmail(b.contact.draft.email)) {
      return true
    }
  }
  return false
}

function collectQueueWarnings(
  plan: QuickAddPlan,
  peers: QuickAddQueuePeer[],
  forJobId: string,
  input: {
    platform: OutreachPlatform
    handle: string
    displayName: string
    email: string | null
  }
): QuickAddPlanWarning[] {
  const warnings: QuickAddPlanWarning[] = []
  const others = peers.filter((p) => p.jobId !== forJobId)

  const normalizedInputHandle = normalizeHandle(input.handle)

  for (const peer of others) {
    const ph = peerPlatformHandle(peer)
    if (
      ph &&
      ph.platform !== input.platform &&
      ph.handle === normalizedInputHandle
    ) {
      warnings.push({
        code: 'queue_cross_platform_handle',
        message: `@${normalizedInputHandle} is also queued on ${platformLabel(ph.platform)} — will link to the same creator when possible.`,
        severity: 'info',
      })
    }
    if (
      ph &&
      ph.platform === input.platform &&
      ph.handle === normalizedInputHandle &&
      ['pending', 'scraping'].includes(peer.status)
    ) {
      warnings.push({
        code: 'queue_handle_pending',
        message: 'Same handle is still loading earlier in the queue.',
        severity: 'warn',
      })
    }
  }

  if (input.email) {
    const normalized = normalizeEmail(input.email)
    for (const peer of others) {
      const peerEmail =
        peer.resolved?.draftContact?.email ??
        (peer.plan?.contact.action === 'create'
          ? peer.plan.contact.draft.email
          : peer.plan?.contact.action === 'link'
            ? peer.plan.contact.contact.email
            : null)
      if (!peerEmail || normalizeEmail(peerEmail) !== normalized) continue

      const peerCreatorKey =
        peer.plan?.creator.action === 'link'
          ? peer.plan.creator.creator.id
          : peer.plan?.creator.action === 'create'
            ? peer.plan.creator.displayName.trim().toLowerCase()
            : null
      const thisCreatorKey =
        plan.creator.action === 'link'
          ? plan.creator.creator.id
          : plan.creator.displayName.trim().toLowerCase()

      if (peerCreatorKey && thisCreatorKey && peerCreatorKey !== thisCreatorKey) {
        warnings.push({
          code: 'queue_email_conflict',
          message: `Email ${normalized} is queued for a different creator on another profile.`,
          severity: 'block',
        })
      }
    }
  }

  const createName = plan.creator.action === 'create' ? plan.creator.displayName.trim().toLowerCase() : null
  if (createName) {
    for (const peer of others) {
      if (peer.plan?.creator.action !== 'create') continue
      if (peer.plan.creator.displayName.trim().toLowerCase() === createName) {
        warnings.push({
          code: 'queue_creator_name_conflict',
          message: `Another queued profile will also create creator “${peer.plan.creator.displayName}”.`,
          severity: 'block',
        })
      }
    }
  }

  if (
    plan.creator.action === 'link' &&
    plan.creator.reason === 'Creator with matching display name'
  ) {
    warnings.push({
      code: 'fuzzy_creator_name',
      message: 'Creator matched by display name only — confirm this is the same person.',
      severity: 'warn',
    })
  }

  if (plan.profile.action === 'existing' && !plan.profile.profile.creatorId && plan.creator.action === 'create') {
    warnings.push({
      code: 'profile_unlinked',
      message: 'Profile exists in CRM but is unlinked; a new creator will be created unless you adjust.',
      severity: 'warn',
    })
  }

  return warnings
}

export function assessQuickAddJob(
  store: CreatorOutreachStore,
  peers: QuickAddQueuePeer[],
  forJobId: string,
  input: {
    platform: OutreachPlatform
    handle: string
    displayName: string
    draftContact?: ResolvedSocialProfile['draftContact']
  },
  options?: { storedPlan?: QuickAddPlan | null }
): QuickAddIntegrityAssessment {
  const planningStore = buildPlanningStoreWithQueue(store, peers, forJobId)
  const plan = planQuickAdd(planningStore, {
    platform: input.platform,
    handle: input.handle,
    displayName: input.displayName,
    draftContact: input.draftContact,
  })

  const email = input.draftContact?.email?.trim() ?? null
  const queueWarnings = collectQueueWarnings(plan, peers, forJobId, {
    platform: input.platform,
    handle: input.handle,
    displayName: input.displayName,
    email,
  })

  const warnings = [...queueWarnings]
  if (options?.storedPlan && plansMateriallyDiffer(plan, options.storedPlan)) {
    warnings.push({
      code: 'plan_stale',
      message: 'Plan changed because the queue or CRM was updated — review again.',
      severity: 'warn',
    })
  }

  const readyPeers = peers
    .filter((p) => p.status === 'ready')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const fifoIndex = readyPeers.findIndex((p) => p.jobId === forJobId)
  const readyAhead = fifoIndex > 0 ? fifoIndex : 0
  if (readyAhead > 0) {
    warnings.push({
      code: 'out_of_fifo_order',
      message: `${readyAhead} other profile(s) are ready ahead of this one — confirm in order when possible.`,
      severity: 'info',
    })
  }

  const hasBlock = warnings.some((w) => w.severity === 'block')
  const hasWarn = warnings.some((w) => w.severity === 'warn')

  /** Aggressive auto-accept: no hard queue conflicts, FIFO head only. Warnings still shown in UI. */
  const autoConfirmEligible = !hasBlock && readyAhead === 0

  /** Manual review recommended (warnings/blocks); auto-accept ignores warns when eligible. */
  const reviewRequired = hasBlock || hasWarn

  return {
    plan,
    reviewRequired,
    autoConfirmEligible,
    warnings,
    fifoPosition: fifoIndex >= 0 ? fifoIndex + 1 : readyPeers.length + 1,
    readyAhead,
  }
}

export function assessQuickAddFromRow(
  store: CreatorOutreachStore,
  allRows: QuickAddJobRow[],
  row: QuickAddJobRow
): QuickAddIntegrityAssessment | null {
  const resolved = row.resolved_payload as ResolvedSocialProfile | null
  if (!resolved) return null
  const peers = allRows.map(quickAddJobRowToPeer)
  return assessQuickAddJob(
    store,
    peers,
    row.id,
    {
      platform: resolved.platform,
      handle: resolved.username,
      displayName: resolved.name.trim() || resolved.username,
      draftContact: resolved.draftContact,
    },
    { storedPlan: (row.plan_payload as QuickAddPlan | null) ?? null }
  )
}

export { plansMateriallyDiffer }
