import type { CreatorOutreachStore, OutreachRule, SendFromAddress } from './types'

export function defaultSendFromAddress(store: CreatorOutreachStore): SendFromAddress | undefined {
  return (
    store.sendFromAddresses.find((s) => s.enabled && s.isDefault) ??
    store.sendFromAddresses.find((s) => s.enabled)
  )
}

export function resolveSendFromForRule(
  store: CreatorOutreachStore,
  rule: OutreachRule
): SendFromAddress | undefined {
  if (rule.action !== 'send_email') return undefined

  if (rule.sendFromId) {
    const found = store.sendFromAddresses.find(
      (s) => s.id === rule.sendFromId && s.enabled
    )
    if (found) return found
  }

  return defaultSendFromAddress(store)
}
