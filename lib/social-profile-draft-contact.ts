import type { OutreachPlatform } from '@/lib/creator-outreach/types'
import { extractEmailsFromText } from '@/lib/extract-emails-from-text'
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type ProfileEmailSource = 'business_email' | 'public_email' | 'bio'

export type DraftContactFromProfile = {
  email: string
  name: string
  source: ProfileEmailSource
  biography: string | null
}

function sourceLabel(source: ProfileEmailSource, platform: OutreachPlatform): string {
  const network = platform === 'instagram' ? 'Instagram' : 'TikTok'
  switch (source) {
    case 'business_email':
      return `${network} contact button`
    case 'public_email':
      return `${network} public email`
    case 'bio':
      return `${network} bio`
  }
}

export function draftContactSourceLabel(
  source: ProfileEmailSource,
  platform: OutreachPlatform
): string {
  return sourceLabel(source, platform)
}

function pickEmail(
  businessEmail: string | null | undefined,
  publicEmail: string | null | undefined,
  biography: string | null | undefined
): { email: string; source: ProfileEmailSource } | null {
  const business = businessEmail?.trim()
  if (business) {
    const normalized = normalizeEmail(business)
    if (normalized.includes('@')) {
      return { email: normalized, source: 'business_email' }
    }
  }

  const pub = publicEmail?.trim()
  if (pub) {
    const normalized = normalizeEmail(pub)
    if (normalized.includes('@')) {
      return { email: normalized, source: 'public_email' }
    }
  }

  const fromBio = extractEmailsFromText(biography ?? '')[0]
  if (fromBio) {
    return { email: fromBio, source: 'bio' }
  }

  return null
}

/** Build a draft CRM contact from scraped profile metadata. */
export function buildDraftContactFromProfileMeta(opts: {
  platform: OutreachPlatform
  displayName: string
  handle: string
  biography?: string | null
  businessEmail?: string | null
  publicEmail?: string | null
}): DraftContactFromProfile | null {
  const picked = pickEmail(opts.businessEmail, opts.publicEmail, opts.biography)
  if (!picked) return null

  const name = opts.displayName.trim() || opts.handle.trim()
  if (!name) return null

  return {
    email: picked.email,
    name,
    source: picked.source,
    biography: opts.biography?.trim() || null,
  }
}

export function draftContactNotes(
  draft: DraftContactFromProfile,
  platform: OutreachPlatform,
  handle: string
): string {
  return `Email scraped from ${draftContactSourceLabel(draft.source, platform)} (@${handle.replace(/^@/, '')}).`
}
