import type { ContactCrmStatus } from './types'

export const PARTNERSHIP_CRM_STATUSES = [
  'in_talks',
  'test_phase',
  'active_partnership',
] as const satisfies readonly ContactCrmStatus[]

export type PartnershipCrmStatus = (typeof PARTNERSHIP_CRM_STATUSES)[number]

export const PARTNERSHIP_CRM_STATUS_OPTIONS: {
  value: PartnershipCrmStatus
  label: string
  description: string
}[] = [
  {
    value: 'in_talks',
    label: 'In talks',
    description: 'Active conversation with the creator',
  },
  {
    value: 'test_phase',
    label: 'Test phase',
    description: 'Agreed to try the app / trial content',
  },
  {
    value: 'active_partnership',
    label: 'Active partnership',
    description: 'Live or committed paid collaboration',
  },
]

export function isPartnershipCrmStatus(status: ContactCrmStatus): status is PartnershipCrmStatus {
  return (PARTNERSHIP_CRM_STATUSES as readonly ContactCrmStatus[]).includes(status)
}

export function canSetPartnershipCrmStatus(status: ContactCrmStatus): boolean {
  return status === 'contacted' || isPartnershipCrmStatus(status) || status === 'reached'
}

/** Kanban uses four columns; partnership stages group under reached. */
export const CRM_KANBAN_STATUS_COLUMNS = [
  'new',
  'contacted',
  'reached',
  'blocked',
] as const satisfies readonly ContactCrmStatus[]

export function crmStatusForKanbanColumn(status: ContactCrmStatus): ContactCrmStatus {
  if (status === 'in_talks' || status === 'test_phase' || status === 'active_partnership') {
    return 'reached'
  }
  if ((CRM_KANBAN_STATUS_COLUMNS as readonly ContactCrmStatus[]).includes(status)) {
    return status
  }
  return 'new'
}

export const CONTACT_CRM_STATUS_STYLES: Record<
  ContactCrmStatus,
  { chip: string; dot: string }
> = {
  new: { chip: 'bg-gray-100 text-gray-700 ring-gray-200/90', dot: 'bg-gray-400' },
  contacted: { chip: 'bg-sky-50 text-sky-800 ring-sky-200/80', dot: 'bg-sky-500' },
  reached: { chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80', dot: 'bg-emerald-500' },
  in_talks: { chip: 'bg-violet-50 text-violet-800 ring-violet-200/80', dot: 'bg-violet-500' },
  test_phase: { chip: 'bg-amber-50 text-amber-900 ring-amber-200/80', dot: 'bg-amber-500' },
  active_partnership: {
    chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  blocked: { chip: 'bg-red-50 text-red-800 ring-red-200/80', dot: 'bg-red-500' },
}

export function contactCrmStatusLabel(status: ContactCrmStatus): string {
  if (status === 'new') return 'New'
  if (status === 'contacted') return 'Contacted'
  if (status === 'reached') return 'Reached'
  if (status === 'in_talks') return 'In talks'
  if (status === 'test_phase') return 'Test phase'
  if (status === 'active_partnership') return 'Active partnership'
  return 'Blocked'
}
