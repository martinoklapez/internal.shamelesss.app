import { SHAMELESSS_CONFIG } from './config.js'
import { apiFetch, crmWebUrl } from './lib/api.js'
import { parseSocialProfileUrl } from './lib/parse-url.js'
import {
  fetchAuthUser,
  fetchStaffProfile,
  fetchUserRole,
  refreshSession,
  signInWithPassword,
} from './lib/supabase-auth.js'
import { jobStatusLabel } from './lib/labels.js'
import {
  jobHasBlockingWarning,
  loadAutoAcceptEnabled,
  pickAutoAcceptCandidate,
  saveAutoAcceptEnabled,
  AUTO_ACCEPT_MAX_CHAIN,
} from './lib/quick-add-auto-accept.js'
import {
  escapeHtml,
  externalLinkIconSvg,
  plusIconSvg,
  renderCreatorSheet,
  renderJobStatusDot,
  renderPanelHeaderCreator,
  renderPanelHeaderProfile,
  renderPanelHeaderQuickAdd,
  renderProfileSheet,
  renderQuickAddTabPreview,
  renderUserAccountFooter,
} from './lib/ui.js'

const CRM_ROLES = new Set(['admin', 'dev', 'developer'])
const SESSION_KEY = 'creatorCrmSession'
const POLL_MS = 5000

/** @typedef {'empty' | 'quick-add' | 'creator' | 'profile'} PanelViewMode */

const els = {
  bootError: document.getElementById('boot-error'),
  configMissing: document.getElementById('config-missing'),
  authSection: document.getElementById('auth-section'),
  mainPanel: document.getElementById('main-panel'),
  panelHeaderMain: document.getElementById('panel-header-main'),
  signInForm: document.getElementById('sign-in-form'),
  signInBtn: document.getElementById('sign-in-btn'),
  signOutBtn: document.getElementById('sign-out-btn'),
  panelAccountFooter: document.getElementById('panel-account-footer'),
  authError: document.getElementById('auth-error'),
  tabHint: document.getElementById('tab-hint'),
  sheetContent: document.getElementById('sheet-content'),
  sectionQuickAdd: document.getElementById('section-quick-add'),
  quickAddUrl: document.getElementById('quick-add-url'),
  urlError: document.getElementById('url-error'),
  enqueueBtn: document.getElementById('enqueue-btn'),
  enqueueIcon: document.getElementById('enqueue-icon'),
  readyCount: document.getElementById('ready-count'),
  queueList: document.getElementById('queue-list'),
  queueEmpty: document.getElementById('queue-empty'),
  openCrmLink: document.getElementById('open-crm-link'),
  autoAcceptToggle: document.getElementById('auto-accept-toggle'),
  autoAcceptRow: document.getElementById('auto-accept-row'),
}

let accessToken = null
let currentUser = null
let currentStaffProfile = null
let currentTabUrl = null
let pollTimer = null
let autoAcceptEnabled = false
let autoAcceptInFlight = false
let confirmInFlight = false
/** @type {PanelViewMode} */
let currentViewMode = 'empty'

function configReady() {
  const c = SHAMELESSS_CONFIG
  return Boolean(
    c?.appUrl &&
      c?.supabaseUrl &&
      c?.supabaseAnonKey &&
      !String(c.supabaseUrl).includes('YOUR_PROJECT')
  )
}

function showBootError(message) {
  els.bootError.textContent = message
  els.bootError.classList.remove('hidden')
}

function showInlineError(el, message) {
  if (!message) {
    el.classList.add('hidden')
    el.textContent = ''
    return
  }
  el.textContent = message
  el.classList.remove('hidden')
}

function resolveViewMode(context) {
  const parsed = context.parsed ?? parseSocialProfileUrl(currentTabUrl ?? '')
  if (!parsed) return 'empty'
  if (context.creator) return 'creator'
  if (context.profile) return 'profile'
  return 'quick-add'
}

function applyPanelHeader(mode, context) {
  if (mode === 'creator' && context.creator) {
    els.panelHeaderMain.innerHTML = renderPanelHeaderCreator(context.creator)
    return
  }
  if (mode === 'profile' && context.profile) {
    els.panelHeaderMain.innerHTML = renderPanelHeaderProfile(context.profile)
    return
  }
  els.panelHeaderMain.innerHTML = renderPanelHeaderQuickAdd()
}

function applyView(context) {
  const mode = resolveViewMode(context)
  currentViewMode = mode

  applyPanelHeader(mode, context)

  const showQuickAdd = mode === 'quick-add'
  els.sectionQuickAdd.classList.toggle('hidden', !showQuickAdd)
  if (showQuickAdd && accessToken) {
    void fetchQueue()
  }

  if (mode === 'empty') {
    els.tabHint.classList.remove('hidden')
    els.sheetContent.innerHTML = ''
    return
  }

  els.tabHint.classList.add('hidden')

  if (mode === 'creator') {
    els.sheetContent.innerHTML = renderCreatorSheet(context)
    return
  }

  if (mode === 'profile') {
    els.sheetContent.innerHTML = renderProfileSheet(context.profile)
    return
  }

  const parsed = context.parsed ?? parseSocialProfileUrl(currentTabUrl ?? '')
  els.sheetContent.innerHTML = parsed ? renderQuickAddTabPreview(parsed) : ''
}

function validateUrlInput(url) {
  const trimmed = url.trim()
  if (!trimmed) return { ok: false, error: 'Profile URL is required.' }
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      ok: false,
      error: 'Paste a TikTok or Instagram profile URL (https://…).',
    }
  }
  const parsed = parseSocialProfileUrl(trimmed)
  if (!parsed) {
    return {
      ok: false,
      error: 'Use a profile URL like tiktok.com/@user or instagram.com/user.',
    }
  }
  return { ok: true, parsed }
}

async function getActiveTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.url ?? null
}

function syncUrlInputFromTab() {
  if (currentViewMode !== 'quick-add') return
  const parsed = parseSocialProfileUrl(currentTabUrl ?? '')
  if (parsed) {
    els.quickAddUrl.value = parsed.profileUrl
    showInlineError(els.urlError, null)
  }
}

async function persistSession(session) {
  accessToken = session.access_token
  await chrome.storage.local.set({
    [SESSION_KEY]: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    },
  })
}

async function clearSession() {
  accessToken = null
  currentUser = null
  currentStaffProfile = null
  await chrome.storage.local.remove(SESSION_KEY)
}

async function restoreSession() {
  const stored = await chrome.storage.local.get(SESSION_KEY)
  const saved = stored[SESSION_KEY]
  if (!saved?.access_token) return null

  let token = saved.access_token
  let user = await fetchAuthUser(token)

  if (!user && saved.refresh_token) {
    const refreshed = await refreshSession(saved.refresh_token)
    if (refreshed) {
      await persistSession(refreshed)
      token = refreshed.access_token
      user = refreshed.user ?? (await fetchAuthUser(token))
    }
  }

  if (!user) {
    await clearSession()
    return null
  }

  accessToken = token
  return { access_token: token, refresh_token: saved.refresh_token, user }
}

function updateAccountFooter(user, staffProfile = null) {
  currentUser = user ?? null
  currentStaffProfile = staffProfile
  if (!user) return
  els.signOutBtn.innerHTML = renderUserAccountFooter(user, staffProfile)
  const email = user.email?.trim()
  els.signOutBtn.setAttribute('aria-label', email ? `Sign out (${email})` : 'Sign out')
}

async function loadStaffProfileForUser(user) {
  if (!accessToken || !user?.id) return null
  try {
    return await fetchStaffProfile(accessToken, user.id)
  } catch {
    return null
  }
}

async function setSignedInUi(user) {
  els.authSection.classList.add('hidden')
  els.mainPanel.classList.remove('hidden')
  els.panelAccountFooter.classList.remove('hidden')
  const staffProfile = await loadStaffProfileForUser(user)
  updateAccountFooter(user, staffProfile)
  els.openCrmLink.href = crmWebUrl('/pipeline')
}

function setSignedOutUi() {
  els.authSection.classList.remove('hidden')
  els.mainPanel.classList.add('hidden')
  els.panelAccountFooter.classList.add('hidden')
  els.signOutBtn.innerHTML = ''
  currentUser = null
  currentStaffProfile = null
  currentViewMode = 'empty'
}

async function verifyCrmRole(userId) {
  const role = await fetchUserRole(accessToken, userId)
  if (!role || !CRM_ROLES.has(role)) {
    throw new Error('Access denied. Admin, dev, or developer role required.')
  }
}

async function handleSignIn(event) {
  event.preventDefault()
  showInlineError(els.authError, null)
  els.signInBtn.disabled = true
  els.signInBtn.textContent = 'Signing in…'

  try {
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value
    const session = await signInWithPassword(email, password)
    await persistSession(session)
    await verifyCrmRole(session.user.id)
    await setSignedInUi(session.user)
    await refreshAll()
    startPolling()
  } catch (err) {
    await clearSession()
    setSignedOutUi()
    showInlineError(els.authError, err.message ?? 'Sign in failed')
  } finally {
    els.signInBtn.disabled = false
    els.signInBtn.textContent = 'Sign in'
  }
}

async function handleSignOut() {
  await clearSession()
  setSignedOutUi()
  stopPolling()
}

async function fetchTabContext() {
  if (!accessToken) return
  currentTabUrl = await getActiveTabUrl()

  const parsed = parseSocialProfileUrl(currentTabUrl ?? '')
  if (!parsed) {
    applyView({ parsed: null })
    return
  }

  try {
    const params = new URLSearchParams({ url: currentTabUrl })
    const context = await apiFetch(`/api/creator-pipeline/context?${params}`, {
      accessToken,
    })
    applyView(context)
    syncUrlInputFromTab()
  } catch (err) {
    els.sheetContent.innerHTML = `<p class="alert-error-inline">${escapeHtml(err.message)}</p>`
    els.tabHint.classList.add('hidden')
    els.sectionQuickAdd.classList.add('hidden')
    els.panelHeaderMain.innerHTML = renderPanelHeaderQuickAdd()
  }
}

function shouldShowManualConfirm(job) {
  if (job.status !== 'ready') return false
  if (autoAcceptEnabled && job.autoConfirmEligible && !jobHasBlockingWarning(job)) {
    return false
  }
  return true
}

function renderQueue(jobs) {
  const active = jobs.filter(
    (j) => j.status !== 'completed' && j.status !== 'cancelled'
  )
  const readyCount = jobs.filter((j) => j.status === 'ready').length

  if (readyCount > 0) {
    els.readyCount.textContent = `${readyCount} ready`
    els.readyCount.classList.remove('hidden')
  } else {
    els.readyCount.classList.add('hidden')
  }

  els.queueList.innerHTML = ''
  if (active.length === 0) {
    els.queueEmpty.classList.remove('hidden')
    return
  }
  els.queueEmpty.classList.add('hidden')

  for (const job of active) {
    const li = document.createElement('li')
    li.className = 'queue-item'
    const label =
      job.resolved?.name?.trim() ||
      job.resolved?.username ||
      job.url.replace(/^https?:\/\//, '').slice(0, 48)
    const meta = job.optimistic
      ? 'Saving to server queue…'
      : job.status === 'failed'
        ? job.errorMessage ?? 'Failed'
        : job.resolved
          ? `@${job.resolved.username.replace(/^@/, '')}`
          : jobStatusLabel(job.status)

    li.innerHTML = `
      ${renderJobStatusDot(job.status)}
      <div class="queue-item-body">
        <p class="queue-item-title">${escapeHtml(label)}</p>
        <p class="queue-item-meta">${escapeHtml(meta)}</p>
      </div>
    `

    if (shouldShowManualConfirm(job)) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'btn btn-ghost'
      btn.style.cssText = 'height:28px;font-size:12px;padding:0 8px'
      btn.textContent = 'Confirm'
      btn.addEventListener('click', () => confirmJob(job.id, btn))
      li.appendChild(btn)
    } else if (
      job.status === 'ready' &&
      autoAcceptEnabled &&
      job.autoConfirmEligible &&
      !jobHasBlockingWarning(job)
    ) {
      const tag = document.createElement('span')
      tag.className = 'pill pill-emerald'
      tag.textContent = 'Auto'
      li.appendChild(tag)
    }

    if (job.status === 'failed') {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'btn btn-ghost'
      btn.style.cssText = 'height:28px;font-size:12px;padding:0 8px'
      btn.textContent = 'Retry'
      btn.addEventListener('click', () => retryJob(job.id, btn))
      li.appendChild(btn)
    }

    els.queueList.appendChild(li)
  }
}

async function fetchJobsList() {
  if (!accessToken) return []
  const data = await apiFetch('/api/creator-pipeline/quick-add/jobs', { accessToken })
  return data.jobs ?? []
}

async function confirmJobApi(jobId, { allowAuto = false } = {}) {
  return apiFetch(`/api/creator-pipeline/quick-add/jobs/${jobId}/confirm`, {
    method: 'POST',
    accessToken,
    body: { notes: '', force: false, allowAuto },
  })
}

async function runAutoAcceptChain() {
  if (!accessToken || !autoAcceptEnabled || autoAcceptInFlight || confirmInFlight) {
    return 0
  }

  autoAcceptInFlight = true
  let processed = 0

  try {
    for (let i = 0; i < AUTO_ACCEPT_MAX_CHAIN; i++) {
      const jobs = await fetchJobsList()
      const candidate = pickAutoAcceptCandidate(jobs)
      if (!candidate) break

      confirmInFlight = true
      try {
        await confirmJobApi(candidate.id, { allowAuto: true })
        processed++
      } finally {
        confirmInFlight = false
      }

      if (currentViewMode === 'quick-add') {
        renderQueue(jobs)
      }
    }

    if (processed > 0) {
      await fetchTabContext()
    }
  } catch (err) {
    if (currentViewMode === 'quick-add') {
      showInlineError(els.urlError, err.message ?? 'Auto-accept failed')
    }
  } finally {
    autoAcceptInFlight = false
  }

  return processed
}

async function fetchQueue() {
  if (!accessToken) return []
  try {
    const jobs = await fetchJobsList()
    if (currentViewMode === 'quick-add') {
      renderQueue(jobs)
    }
    return jobs
  } catch (err) {
    if (currentViewMode === 'quick-add') {
      els.queueList.innerHTML = `<li class="queue-item"><p class="alert-error-inline">${escapeHtml(err.message)}</p></li>`
    }
    return []
  }
}

async function enqueueUrl() {
  const url = els.quickAddUrl.value.trim()
  const validation = validateUrlInput(url)
  if (!validation.ok) {
    showInlineError(els.urlError, validation.error)
    return
  }
  showInlineError(els.urlError, null)
  els.enqueueBtn.disabled = true
  try {
    await apiFetch('/api/creator-pipeline/quick-add/jobs', {
      method: 'POST',
      accessToken,
      body: { url: validation.parsed.profileUrl },
    })
    await fetchQueue()
    await fetchTabContext()
    if (autoAcceptEnabled) {
      await runAutoAcceptChain()
      await fetchQueue()
    }
  } catch (err) {
    showInlineError(els.urlError, err.message)
  } finally {
    els.enqueueBtn.disabled = false
  }
}

async function confirmJob(jobId, btn) {
  btn.disabled = true
  confirmInFlight = true
  try {
    await confirmJobApi(jobId, { allowAuto: false })
    await fetchQueue()
    await fetchTabContext()
    if (autoAcceptEnabled) {
      await runAutoAcceptChain()
    }
  } catch (err) {
    showInlineError(els.urlError, err.message)
  } finally {
    confirmInFlight = false
    btn.disabled = false
  }
}

async function retryJob(jobId, btn) {
  btn.disabled = true
  try {
    await apiFetch(`/api/creator-pipeline/quick-add/jobs/${jobId}/retry`, {
      method: 'POST',
      accessToken,
    })
    await fetchQueue()
  } catch (err) {
    showInlineError(els.urlError, err.message)
  } finally {
    btn.disabled = false
  }
}

async function refreshAll() {
  await fetchTabContext()
  await fetchQueue()
  if (autoAcceptEnabled) {
    await runAutoAcceptChain()
    await fetchQueue()
  }
}

async function initAutoAccept() {
  autoAcceptEnabled = await loadAutoAcceptEnabled()
  if (els.autoAcceptToggle) {
    els.autoAcceptToggle.checked = autoAcceptEnabled
  }
}

async function handleAutoAcceptToggle() {
  autoAcceptEnabled = Boolean(els.autoAcceptToggle?.checked)
  await saveAutoAcceptEnabled(autoAcceptEnabled)
  if (autoAcceptEnabled) {
    await runAutoAcceptChain()
    await fetchQueue()
  } else if (currentViewMode === 'quick-add') {
    const jobs = await fetchJobsList().catch(() => [])
    renderQueue(jobs)
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => void refreshAll(), POLL_MS)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function init() {
  if (els.enqueueIcon) els.enqueueIcon.innerHTML = plusIconSvg()
  if (els.openCrmLink) {
    els.openCrmLink.innerHTML = `<span>Open Pipeline</span>${externalLinkIconSvg()}`
  }

  if (!configReady()) {
    els.authSection.classList.add('hidden')
    els.configMissing.classList.remove('hidden')
    return
  }

  els.configMissing.classList.add('hidden')

  await initAutoAccept()

  els.signInForm.addEventListener('submit', handleSignIn)
  els.signOutBtn.addEventListener('click', handleSignOut)
  els.enqueueBtn.addEventListener('click', () => void enqueueUrl())
  els.autoAcceptToggle?.addEventListener('change', () => void handleAutoAcceptToggle())
  els.quickAddUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void enqueueUrl()
  })
  els.quickAddUrl.addEventListener('input', () => {
    const v = validateUrlInput(els.quickAddUrl.value)
    showInlineError(els.urlError, v.ok ? null : v.error)
  })

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TAB_CONTEXT_CHANGED') {
      currentTabUrl = msg.url
      if (accessToken) void fetchTabContext()
    }
  })

  const session = await restoreSession()
  if (session?.user) {
    try {
      await verifyCrmRole(session.user.id)
      await setSignedInUi(session.user)
      startPolling()
      await refreshAll()
    } catch {
      await clearSession()
      setSignedOutUi()
    }
  } else {
    setSignedOutUi()
  }
}

init().catch((err) => {
  console.error('Creator CRM sidepanel init failed:', err)
  showBootError(
    err?.message ??
      'Extension failed to start. Reload the extension on chrome://extensions and try again.'
  )
})
