import {
  notifyTabContextChanged,
  syncActiveTab,
  syncSidePanelForTab,
} from './lib/side-panel-sync.js'

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  }
  void syncActiveTab()
})

function handleTabUrl(tabId, url, isActive) {
  notifyTabContextChanged(tabId, url)
  void syncSidePanelForTab(tabId, url, { isActive })
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url ?? (changeInfo.status === 'complete' ? tab.url : null)
  if (!url) return

  chrome.tabs.query({ active: true, currentWindow: true }).then(([active]) => {
    const isActive = active?.id === tabId
    handleTabUrl(tabId, url, isActive)
  })
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (tab.url) {
      handleTabUrl(activeInfo.tabId, tab.url, true)
    }
  } catch {
    // tab closed
  }
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const stored = await chrome.storage.local.get('sidePanelOpenTabIds')
  const ids = stored.sidePanelOpenTabIds
  if (!Array.isArray(ids) || !ids.includes(tabId)) return
  await chrome.storage.local.set({
    sidePanelOpenTabIds: ids.filter((id) => id !== tabId),
  })
})
