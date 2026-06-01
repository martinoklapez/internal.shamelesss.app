export const AUTO_ACCEPT_STORAGE_KEY = 'creator-pipeline-quick-add-auto-accept'
export const AUTO_ACCEPT_MAX_CHAIN = 25

export function pickAutoAcceptCandidate(jobs) {
  return (
    jobs
      .filter(
        (j) =>
          j.status === 'ready' &&
          j.autoConfirmEligible &&
          !j.optimistic
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null
  )
}

export function jobHasBlockingWarning(job) {
  return job.warnings?.some((w) => w.severity === 'block') ?? false
}

export async function loadAutoAcceptEnabled() {
  const stored = await chrome.storage.local.get(AUTO_ACCEPT_STORAGE_KEY)
  return stored[AUTO_ACCEPT_STORAGE_KEY] === '1'
}

export async function saveAutoAcceptEnabled(enabled) {
  await chrome.storage.local.set({
    [AUTO_ACCEPT_STORAGE_KEY]: enabled ? '1' : '0',
  })
}
