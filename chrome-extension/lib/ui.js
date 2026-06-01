import { formatFollowerCountShort, initialsFromName } from './format.js'
import { contactCrmStatusLabel, contactKindLabel } from './labels.js'
import { SI_INSTAGRAM_PATH, SI_TIKTOK_PATH } from './platform-icons.js'
import { platformLabel } from './parse-url.js'

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

const CRM_STATUS_STYLES = {
  new: { chip: 'crm-badge crm-badge-new', dot: 'dot-gray' },
  contacted: { chip: 'crm-badge crm-badge-contacted', dot: 'dot-sky' },
  reached: { chip: 'crm-badge crm-badge-reached', dot: 'dot-emerald' },
  blocked: { chip: 'crm-badge crm-badge-blocked', dot: 'dot-red' },
}

/** Same glyphs as PlatformIcon (react-icons/si, h-3 w-3 in the app). */
export function platformIconSvg(platform, className = 'platform-icon') {
  const path = platform === 'tiktok' ? SI_TIKTOK_PATH : SI_INSTAGRAM_PATH
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`
}

function avatarFallbackClass(platform) {
  return platform === 'tiktok' ? 'avatar-fallback avatar-fallback-tiktok' : 'avatar-fallback avatar-fallback-instagram'
}

export function renderAvatar({ platform, displayName, handle, imageSrc, size = 'md' }) {
  const label = displayName?.trim() || handle?.replace(/^@/, '') || '??'
  const initials = initialsFromName(label)
  const sizeClass = size === 'sm' ? 'avatar avatar-sm' : 'avatar'
  const img = imageSrc
    ? `<img class="avatar-img" src="${escapeAttr(imageSrc)}" alt="" />`
    : ''
  return `
    <div class="${sizeClass}">
      ${img}
      <span class="${avatarFallbackClass(platform)}">${escapeHtml(initials)}</span>
    </div>
  `
}

/** Matches PipelinePreviewCard / ImportProfilePreviewRow in creator-outreach-manager. */
export function renderPreviewCard({
  platform,
  displayName,
  handle,
  followerCount,
  imageSrc,
  badgeHtml = '',
  extraHtml = '',
}) {
  const cleanHandle = String(handle).replace(/^@/, '')
  const title = displayName?.trim() || cleanHandle
  const followers =
    followerCount != null
      ? `<span class="text-muted"> · ${escapeHtml(formatFollowerCountShort(followerCount))} followers</span>`
      : ''

  return `
    <div class="preview-card">
      ${renderAvatar({ platform, displayName: title, handle: cleanHandle, imageSrc })}
      <div class="preview-card-body">
        <p class="preview-card-title">${escapeHtml(title)} ${badgeHtml}</p>
        <p class="preview-card-subtitle">
          ${platformIconSvg(platform)}
          <span>@${escapeHtml(cleanHandle)}</span>
          ${followers}
        </p>
        ${extraHtml}
      </div>
    </div>
  `
}

export function renderCrmStatusBadge(status) {
  const styles = CRM_STATUS_STYLES[status] ?? CRM_STATUS_STYLES.new
  return `
    <span class="${styles.chip}">
      <span class="crm-badge-dot ${styles.dot}" aria-hidden="true"></span>
      <span>${escapeHtml(contactCrmStatusLabel(status))}</span>
    </span>
  `
}

export function renderCreatorCard(creator) {
  const title = creator.displayName?.trim() || 'Creator'
  const img = creator.avatarImageSrc
    ? `<img class="avatar-img" src="${escapeAttr(creator.avatarImageSrc)}" alt="" />`
    : ''
  return `
    <div class="preview-card">
      <div class="avatar">
        ${img}
        <span class="avatar-fallback avatar-fallback-neutral">${escapeHtml(initialsFromName(title))}</span>
      </div>
      <div class="preview-card-body">
        <p class="preview-card-title">
          ${escapeHtml(title)}
          ${renderCrmStatusBadge(creator.status)}
        </p>
        <p class="preview-card-meta">Creator</p>
      </div>
    </div>
  `
}

export function renderProfileCard(profile, { linked = false } = {}) {
  const badge = linked
    ? ''
    : '<span class="pill pill-muted">Profile only</span>'
  return renderPreviewCard({
    platform: profile.platform,
    displayName: profile.displayName,
    handle: profile.handle,
    followerCount: profile.followerCount,
    imageSrc: profile.avatarUrl,
    badgeHtml: badge,
    extraHtml: linked
      ? `<p class="preview-card-meta">${escapeHtml(platformLabel(profile.platform))} · linked</p>`
      : `<p class="preview-card-meta">${escapeHtml(platformLabel(profile.platform))} · in CRM, not linked to a creator</p>`,
  })
}

export function renderContactRow(contact) {
  return `
    <div class="contact-row">
      <p class="contact-row-title">
        <span>${escapeHtml(contact.name || contact.email || 'Contact')}</span>
        <span class="contact-kind">${escapeHtml(contactKindLabel(contact.kind))}</span>
        ${renderCrmStatusBadge(contact.status)}
      </p>
      ${contact.email ? `<p class="contact-row-email">${escapeHtml(contact.email)}</p>` : ''}
    </div>
  `
}

export function renderJobStatusDot(status) {
  if (status === 'pending' || status === 'scraping' || status === 'confirming') {
    return '<span class="job-dot job-dot-busy" aria-hidden="true"></span>'
  }
  if (status === 'failed') return '<span class="job-dot job-dot-failed" aria-hidden="true"></span>'
  if (status === 'ready') return '<span class="job-dot job-dot-ready" aria-hidden="true"></span>'
  return '<span class="job-dot job-dot-idle" aria-hidden="true"></span>'
}

export function plusIconSvg() {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>'
}

export function externalLinkIconSvg() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>'
}

const PIPELINE_SUBTITLE = 'Creator Pipeline'

function profilePrimaryLabel(profile) {
  const name = profile.displayName?.trim()
  return name || `@${profile.handle.replace(/^@/, '')}`
}

function profileFollowerLine(count) {
  if (count == null) return ''
  return `<p class="sheet-meta">${escapeHtml(formatFollowerCountShort(count))} followers</p>`
}

function renderNotesBlock(notes) {
  const trimmed = notes?.trim()
  if (!trimmed) {
    return `
      <div class="sheet-block">
        <p class="section-label">Notes</p>
        <p class="sheet-meta">No notes</p>
      </div>
    `
  }
  return `
    <div class="sheet-block">
      <p class="section-label">Notes</p>
      <p class="notes-body">${escapeHtml(trimmed)}</p>
    </div>
  `
}

/** Panel header when viewing a linked creator (CreatorSheetHeader). */
export function renderPanelHeaderCreator(creator) {
  const title = creator.displayName?.trim() || 'Creator'
  const img = creator.avatarImageSrc
    ? `<img class="avatar-img" src="${escapeAttr(creator.avatarImageSrc)}" alt="" />`
    : ''
  return `
    <div class="sheet-header-title-row">
      <div class="avatar avatar-header">
        ${img}
        <span class="avatar-fallback avatar-fallback-neutral">${escapeHtml(initialsFromName(title))}</span>
      </div>
      <div class="sheet-header-title min-w-0">
        <p class="panel-title panel-title-inline">${escapeHtml(title)}</p>
        <p class="panel-subtitle">${PIPELINE_SUBTITLE}</p>
      </div>
    </div>
  `
}

/** Panel header for profile-only CRM row. */
export function renderPanelHeaderProfile(profile) {
  const title = profilePrimaryLabel(profile)
  return `
    <div class="sheet-header-title-row">
      ${renderAvatar({
        platform: profile.platform,
        displayName: title,
        handle: profile.handle,
        imageSrc: profile.avatarUrl,
        size: 'sm',
      })}
      <div class="sheet-header-title min-w-0">
        <p class="panel-title panel-title-inline">${escapeHtml(title)}</p>
        <p class="panel-subtitle">${PIPELINE_SUBTITLE}</p>
      </div>
    </div>
  `
}

export function renderPanelHeaderQuickAdd() {
  return `
    <div>
      <p class="panel-title">Quick Add</p>
      <p class="panel-subtitle">${PIPELINE_SUBTITLE}</p>
    </div>
  `
}

function renderProfileListItem(profile, { highlight = false } = {}) {
  const title = profilePrimaryLabel(profile)
  const cleanHandle = profile.handle.replace(/^@/, '')
  return `
    <li class="sheet-list-item${highlight ? ' sheet-list-item-active' : ''}">
      ${renderAvatar({
        platform: profile.platform,
        displayName: title,
        handle: cleanHandle,
        imageSrc: profile.avatarUrl,
        size: 'sm',
      })}
      <div class="sheet-list-body min-w-0">
        <p class="sheet-list-title">
          ${platformIconSvg(profile.platform)}
          <span>${escapeHtml(title)}</span>
        </p>
        <p class="sheet-meta">@${escapeHtml(cleanHandle)}</p>
        ${profileFollowerLine(profile.followerCount)}
      </div>
    </li>
  `
}

/** Creator detail sheet (read-only) — matches CreatorDetailPanel layout. */
export function renderCreatorSheet(context) {
  const { creator, profile, linkedProfiles, contacts } = context
  const currentProfileId = profile?.id
  const profiles = linkedProfiles?.length
    ? linkedProfiles
    : profile
      ? [profile]
      : []

  const profilesHtml =
    profiles.length > 0
      ? `<ul class="sheet-list">${profiles.map((p) => renderProfileListItem(p, { highlight: p.id === currentProfileId })).join('')}</ul>`
      : '<p class="sheet-meta">No profiles linked</p>'

  const contactsHtml =
    contacts?.length > 0
      ? contacts.map(renderContactRow).join('')
      : '<p class="sheet-meta">No contacts</p>'

  return `
    <div class="creator-sheet space-y-4">
      <div class="sheet-block">
        <div class="sheet-status-row">
          <p class="section-label section-label-inline">CRM status</p>
          ${renderCrmStatusBadge(creator.status)}
        </div>
      </div>
      ${renderNotesBlock(creator.notes)}
      <div class="sheet-block">
        <p class="section-label">Profiles</p>
        ${profilesHtml}
      </div>
      <div class="sheet-block">
        <p class="section-label">Contacts</p>
        ${contactsHtml}
      </div>
    </div>
  `
}

/** Profile detail sheet (no creator) — matches ProfileDetailPanel. */
export function renderProfileSheet(profile) {
  const title = profilePrimaryLabel(profile)
  const cleanHandle = profile.handle.replace(/^@/, '')
  return `
    <div class="profile-sheet space-y-4">
      <div class="preview-card">
        ${renderAvatar({
          platform: profile.platform,
          displayName: title,
          handle: cleanHandle,
          imageSrc: profile.avatarUrl,
        })}
        <div class="preview-card-body">
          <p class="preview-card-title">
            ${platformIconSvg(profile.platform)}
            <span>${escapeHtml(title)}</span>
          </p>
          <a class="sheet-link" href="${escapeAttr(profile.profileUrl)}" target="_blank" rel="noopener">@${escapeHtml(cleanHandle)}</a>
          ${profileFollowerLine(profile.followerCount)}
        </div>
      </div>
      <p class="sheet-hint">This profile is not linked to a creator. Link it in the Pipeline app.</p>
      ${renderNotesBlock(profile.notes)}
    </div>
  `
}

/** Quick Add: profile not in CRM yet. */
export function renderQuickAddTabPreview(parsed) {
  return renderPreviewCard({
    platform: parsed.platform,
    displayName: parsed.handle,
    handle: parsed.handle,
    followerCount: null,
    imageSrc: null,
    extraHtml: `<p class="preview-card-meta">Not in CRM yet · ${escapeHtml(platformLabel(parsed.platform))}</p>`,
  })
}

function userAvatarImageSrc(user, staffProfile) {
  const fromProfile = staffProfile?.profile_picture_url?.trim()
  if (fromProfile) return fromProfile
  const meta = user?.user_metadata ?? {}
  return (
    meta.avatar_url?.trim() ||
    meta.picture?.trim() ||
    meta.photo_url?.trim() ||
    null
  )
}

function userAvatarLabel(user, staffProfile) {
  const fromProfile = staffProfile?.name?.trim()
  if (fromProfile) return fromProfile
  const meta = user?.user_metadata ?? {}
  const name = meta.full_name?.trim() || meta.name?.trim()
  if (name) return name
  const email = user?.email?.trim()
  if (email) return email.split('@')[0]
  return 'User'
}

function renderUserAvatarMarkup(user, staffProfile = null) {
  const label = userAvatarLabel(user, staffProfile)
  const initials = initialsFromName(label)
  const imageSrc = userAvatarImageSrc(user, staffProfile)
  const img = imageSrc
    ? `<img class="avatar-img" src="${escapeAttr(imageSrc)}" alt="" />`
    : ''
  return `
    <span class="avatar avatar-shadcn avatar-user">
      ${img}
      <span class="avatar-fallback avatar-fallback-shadcn">${escapeHtml(initials)}</span>
    </span>
  `
}

/** Bottom sidebar account row: shadcn Avatar + name (click to sign out). */
export function renderUserAccountFooter(user, staffProfile = null) {
  const label = userAvatarLabel(user, staffProfile)
  const email = user?.email?.trim()
  const emailLine =
    email && email.toLowerCase() !== label.toLowerCase()
      ? `<span class="account-email">${escapeHtml(email)}</span>`
      : ''

  return `
    ${renderUserAvatarMarkup(user, staffProfile)}
    <span class="account-footer-text">
      <span class="account-name">${escapeHtml(label)}</span>
      ${emailLine}
    </span>
    <span class="sr-only">Sign out</span>
  `
}
