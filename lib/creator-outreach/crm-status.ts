import type { ContactCrmStatus, CreatorOutreachStore } from './types'

const CRM_STATUS_RANK: Record<ContactCrmStatus, number> = {
  new: 0,
  contacted: 1,
  reached: 2,
  in_talks: 3,
  test_phase: 4,
  active_partnership: 5,
  blocked: 6,
}

/** Roll up the furthest contact CRM stage onto the creator. */
export function deriveCreatorCrmStatusFromContacts(
  store: Pick<CreatorOutreachStore, 'contacts'>,
  creatorId: string
): ContactCrmStatus {
  const list = store.contacts.filter((c) => c.creatorId === creatorId)
  if (list.length === 0) return 'new'
  return list.reduce<ContactCrmStatus>(
    (best, c) => (CRM_STATUS_RANK[c.status] > CRM_STATUS_RANK[best] ? c.status : best),
    'new'
  )
}
