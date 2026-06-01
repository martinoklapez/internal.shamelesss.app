import { parseSocialProfileUrl } from './parse-url.js'

const AUTO_PANEL_KEY = 'autoOpenPanel'
const TRACKED_TABS_KEY = 'sidePanelOpenTabIds'

/** Instagram / TikTok profile URL (not feed, reel, etc.). */
export function isSocialProfilePage(url) {
  return parseSocialProfileUrl(url ?? '') !== null
}

async function getAutoOpenEnabled() {
  const stored = await chrome.storage.local.get(AUTO_PANEL_KEY)
  return stored[AUTO_PANEL_KEY] !== false
}

async function getTrackedTabIds() {
  const stored = await chrome.storage.local.get(TRACKED_TABS_KEY)
  const ids = stored[TRACKED_TABS_KEY]
  return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id)) : []
}

async function setTrackedTabIds(ids) {
  await chrome.storage.local.set({ [TRACKED_TABS_KEY]: ids })
}

/**
 * Enable side panel only on profile tabs; open when active, disable (closes) when not.
 */
export async function syncSidePanelForTab(tabId, url, { isActive = false } = {}) {
  if (!chrome.sidePanel?.setOptions) return

  const autoOpen = await getAutoOpenEnabled()
  if (!autoOpen) return

  const isProfile = isSocialProfilePage(url)
  let tracked = await getTrackedTabIds()

  try {
    if (isProfile) {
      await chrome.sidePanel.setOptions({
        tabId,
        path: 'sidepanel.html',
        enabled: true,
      })
      if (isActive) {
        await chrome.sidePanel.open({ tabId })
        if (!tracked.includes(tabId)) {
          tracked = [...tracked, tabId]
          await setTrackedTabIds(tracked)
        }
      }
      return
    }

    await chrome.sidePanel.setOptions({ tabId, enabled: false })

    if (tracked.includes(tabId)) {
      tracked = tracked.filter((id) => id !== tabId)
      await setTrackedTabIds(tracked)
    }
  } catch (err) {
    console.warn('syncSidePanelForTab:', tabId, err)
  }
}

export async function syncActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url) return
  await syncSidePanelForTab(tab.id, tab.url, { isActive: true })
}

export function notifyTabContextChanged(tabId, url) {
  chrome.runtime
    .sendMessage({ type: 'TAB_CONTEXT_CHANGED', tabId, url })
    .catch(() => {})
}
