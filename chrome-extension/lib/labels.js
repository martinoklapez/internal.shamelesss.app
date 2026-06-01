export function contactCrmStatusLabel(status) {
  if (status === 'new') return 'New'
  if (status === 'contacted') return 'Contacted'
  if (status === 'reached') return 'Reached'
  return 'Blocked'
}

export function contactKindLabel(kind) {
  if (kind === 'creator') return 'Creator'
  if (kind === 'manager') return 'Manager'
  if (kind === 'agency') return 'Agency'
  return 'Other'
}

export function jobStatusLabel(status) {
  if (status === 'pending') return 'Queued…'
  if (status === 'scraping') return 'Loading profile…'
  if (status === 'confirming') return 'Saving to CRM…'
  if (status === 'ready') return 'Ready'
  if (status === 'failed') return 'Failed'
  if (status === 'completed') return 'Completed'
  return status
}
