'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  OUTREACH_CONTACT_KINDS,
  type CreatorContactKind,
  type EmailTemplate,
  type OutreachRuleAction,
  type SendFromAddress,
} from '@/lib/creator-outreach/types'
import { contactKindLabel } from '@/lib/creator-outreach/store'
import { cn } from '@/lib/utils'

const clauseSelectClass =
  'h-9 rounded-lg border-gray-200 bg-white text-sm shadow-none focus:ring-1 focus:ring-gray-300'

/** Fixed widths so every Then row aligns (enum: creator | manager | agency | other). */
const conditionFieldBadgeClass =
  'inline-flex h-9 w-[7.25rem] shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 px-2 text-sm text-gray-600'
const conditionKindBadgeClass =
  'inline-flex h-9 w-[5.75rem] shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 px-2 text-sm font-medium text-gray-900'

export type ContactKindRuleDraft = {
  enabled: boolean
  action: OutreachRuleAction
  templateId: string | null
  sendFromId: string | null
}

type CreatorOutreachRulesBuilderProps = {
  drafts: Record<CreatorContactKind, ContactKindRuleDraft>
  templates: EmailTemplate[]
  sendFromAddresses: SendFromAddress[]
  ruleEnabled: boolean
  onRuleEnabledChange: (enabled: boolean) => void
  onKindChange: (kind: CreatorContactKind, patch: Partial<ContactKindRuleDraft>) => void
  dirty?: boolean
  saving?: boolean
  onSave?: () => void
  onReset?: () => void
}

function OutcomeRow({
  kind,
  draft,
  templates,
  sendFromAddresses,
  ruleEnabled,
  onChange,
}: {
  kind: CreatorContactKind
  draft: ContactKindRuleDraft
  templates: EmailTemplate[]
  sendFromAddresses: SendFromAddress[]
  ruleEnabled: boolean
  onChange: (patch: Partial<ContactKindRuleDraft>) => void
}) {
  const send = draft.action === 'send_email'
  const rowActive = ruleEnabled && draft.enabled
  const enabledSenders = sendFromAddresses.filter((s) => s.enabled)

  return (
    <div
      className={cn(
        'flex w-full max-w-full flex-wrap items-center gap-x-2 gap-y-2 py-2',
        !rowActive && 'opacity-50'
      )}
    >
      <div
        className="flex items-center gap-2 text-sm shrink-0"
        aria-label={`Contact type is ${contactKindLabel(kind)}`}
      >
        <span className={conditionFieldBadgeClass}>Contact type</span>
        <span className="text-gray-500 shrink-0">is</span>
        <span className={conditionKindBadgeClass}>{contactKindLabel(kind)}</span>
      </div>

      <span className="text-sm text-gray-500 text-center">→</span>

      <Select
        value={draft.action}
        onValueChange={(action: OutreachRuleAction) => {
          if (action === 'do_not_send') {
            onChange({ action, templateId: null, sendFromId: null })
          } else {
            const defaultTpl = templates.find((t) => t.isDefault) ?? templates[0]
            const defaultSender =
              enabledSenders.find((s) => s.isDefault) ?? enabledSenders[0]
            onChange({
              action,
              templateId: draft.templateId ?? defaultTpl?.id ?? null,
              sendFromId: draft.sendFromId ?? defaultSender?.id ?? null,
            })
          }
        }}
        disabled={!rowActive}
      >
        <SelectTrigger className={cn(clauseSelectClass, 'w-full')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="send_email">📧 Send email using</SelectItem>
          <SelectItem value="do_not_send">❌ Do not send email</SelectItem>
        </SelectContent>
      </Select>

      {send ? (
        <>
          <Select
            value={draft.templateId ?? undefined}
            onValueChange={(templateId) => onChange({ action: 'send_email', templateId })}
            disabled={!rowActive}
          >
            <SelectTrigger className={cn(clauseSelectClass, 'w-[11rem]')}>
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-400">from</span>
          <Select
            value={draft.sendFromId ?? undefined}
            onValueChange={(sendFromId) => onChange({ action: 'send_email', sendFromId })}
            disabled={!rowActive}
          >
            <SelectTrigger className={cn(clauseSelectClass, 'min-w-[12rem] max-w-[16rem]')}>
              <SelectValue placeholder="Sender" />
            </SelectTrigger>
            <SelectContent>
              {enabledSenders.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.displayName ? `${s.displayName} · ${s.address}` : s.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : null}

      <div className="flex justify-end">
        <Switch
          checked={draft.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
          disabled={!ruleEnabled}
          aria-label={`Enable outcome for ${kind}`}
        />
      </div>
    </div>
  )
}

export function CreatorOutreachRulesBuilder({
  drafts,
  templates,
  sendFromAddresses,
  ruleEnabled,
  onRuleEnabledChange,
  onKindChange,
  dirty = false,
  saving = false,
  onSave,
  onReset,
}: CreatorOutreachRulesBuilderProps) {
  return (
    <article
      className={cn(
        'w-fit max-w-full rounded-xl border border-gray-200/90 bg-white p-5 shadow-sm',
        !ruleEnabled && 'opacity-60'
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-sm font-medium text-gray-900">New email on contact</h2>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500">Rule enabled</span>
          <Switch
            checked={ruleEnabled}
            onCheckedChange={onRuleEnabledChange}
            aria-label="Enable outreach rule"
          />
        </div>
      </div>

      <section className="space-y-2">
        <p className="text-sm font-medium text-gray-900">Conditions</p>
        <p className="text-sm text-gray-600">
          <span className="text-gray-400">When · </span>
          New email on contact
          <span className="text-gray-400 text-xs block mt-1 font-normal">
            Contact created with an email, or an email is added or changed later.
          </span>
        </p>
      </section>

      <section className="space-y-1 mt-6 pt-5 border-t border-gray-100">
        <p className="text-sm font-medium text-gray-900 mb-2">Then</p>
        <p className="text-xs text-gray-500 mb-3">
          Each row is fixed to a contact type (left). Choose template and sender for outbound email.
        </p>
        <div className="divide-y divide-gray-100 w-full max-w-full">
          {OUTREACH_CONTACT_KINDS.map((kind) => (
            <OutcomeRow
              key={kind}
              kind={kind}
              draft={drafts[kind]}
              templates={templates}
              sendFromAddresses={sendFromAddresses}
              ruleEnabled={ruleEnabled}
              onChange={(patch) => onKindChange(kind, patch)}
            />
          ))}
        </div>
      </section>

      {onSave ? (
        <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-3">
          <Button disabled={!dirty || saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save rules'}
          </Button>
          {dirty && onReset ? (
            <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
              Reset
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
