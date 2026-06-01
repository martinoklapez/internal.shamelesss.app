'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CreatorOutreachRulesBuilder,
  type ContactKindRuleDraft,
} from '@/components/creator-outreach-rule-block'
import {
  OUTREACH_CONTACT_KINDS,
  type CreatorContactKind,
  type CreatorOutreachStore,
} from '@/lib/creator-outreach/types'
import { CreatorOutreachLoading } from '@/components/creator-outreach-loading'
import { fetchCreatorOutreachStore, mutateCreatorOutreach } from '@/lib/creator-outreach/client-api'
import { notifyError, notifySuccess } from '@/lib/notify'

type RulesDraft = {
  ruleEnabled: boolean
  byKind: Record<CreatorContactKind, ContactKindRuleDraft>
}

function buildDrafts(store: CreatorOutreachStore): RulesDraft {
  const byKind = {} as Record<CreatorContactKind, ContactKindRuleDraft>
  const defaultTpl = store.templates.find((t) => t.isDefault) ?? store.templates[0]

  for (const kind of OUTREACH_CONTACT_KINDS) {
    const rule = store.outreachRules.find((r) => r.contactKind === kind)
    byKind[kind] = {
      enabled: rule?.enabled ?? true,
      action: rule?.action ?? (kind === 'other' ? 'do_not_send' : 'send_email'),
      templateId:
        rule?.action === 'send_email'
          ? rule.templateId
          : rule?.templateId ?? defaultTpl?.id ?? null,
    }
  }

  const ruleEnabled = store.outreachRules.some((r) => r.enabled)

  return { ruleEnabled, byKind }
}

function draftsEqual(a: RulesDraft, b: RulesDraft): boolean {
  if (a.ruleEnabled !== b.ruleEnabled) return false
  return OUTREACH_CONTACT_KINDS.every((kind) => {
    // per-kind enabled is stored in DB; master flag is derived on load but edited separately
    const x = a.byKind[kind]
    const y = b.byKind[kind]
    return (
      x.enabled === y.enabled &&
      x.action === y.action &&
      x.templateId === y.templateId
    )
  })
}

export default function CreatorOutreachRulesView() {
  const [store, setStore] = useState<CreatorOutreachStore | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<RulesDraft | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    const data = await fetchCreatorOutreachStore()
    setStore(data)
    setDrafts(buildDrafts(data))
    setLoadError(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    reload().catch((err) => {
      if (!cancelled) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load rules')
      }
    })
    return () => {
      cancelled = true
    }
  }, [reload])

  const baseline = useMemo(() => (store ? buildDrafts(store) : null), [store])

  const dirty = useMemo(() => {
    if (!drafts || !baseline) return false
    return !draftsEqual(drafts, baseline)
  }, [drafts, baseline])

  const updateKind = (kind: CreatorContactKind, patch: Partial<ContactKindRuleDraft>) => {
    setDrafts((prev) => {
      if (!prev) return prev
      const next = { ...prev.byKind[kind], ...patch }
      if (patch.action === 'do_not_send') {
        next.templateId = null
      } else if (patch.action === 'send_email' && !next.templateId && store) {
        const defaultTpl = store.templates.find((t) => t.isDefault) ?? store.templates[0]
        next.templateId = defaultTpl?.id ?? null
      }
      return { ...prev, byKind: { ...prev.byKind, [kind]: next } }
    })
  }

  const setRuleEnabled = (enabled: boolean) => {
    setDrafts((prev) => (prev ? { ...prev, ruleEnabled: enabled } : prev))
  }

  const save = async () => {
    if (!drafts) return
    setSaving(true)
    try {
      const { store: saved } = await mutateCreatorOutreach({
        action: 'saveOutreachRules',
        rules: OUTREACH_CONTACT_KINDS.map((contactKind) => ({
          contactKind,
          enabled: drafts.ruleEnabled && drafts.byKind[contactKind].enabled,
          action: drafts.byKind[contactKind].action,
          templateId:
            drafts.byKind[contactKind].action === 'send_email'
              ? drafts.byKind[contactKind].templateId
              : null,
        })),
      })
      setStore(saved)
      setDrafts(buildDrafts(saved))
      notifySuccess('Rules saved.')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to save rules')
    } finally {
      setSaving(false)
    }
  }

  if (!store || !drafts) {
    if (loadError) {
      return (
        <div className="px-5 sm:px-8 lg:px-10 py-12 text-sm text-red-600">{loadError}</div>
      )
    }
    return <CreatorOutreachLoading variant="rules" />
  }

  if (store.outreachRules.length === 0) {
    return (
      <div className="px-5 sm:px-8 lg:px-10 py-12 text-sm text-gray-600">
        No rules in database. Run migration{' '}
        <code className="text-xs">20260528160000_creator_pipeline_outreach_rules.sql</code>.
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-5 sm:px-8 lg:px-10 py-8">
      <Link
        href="/pipeline"
        className="text-xs text-gray-400 hover:text-gray-700 mb-2 inline-block"
      >
        Creator Pipeline
      </Link>
      <h1 className="text-lg font-semibold text-gray-900 mb-2">Rules</h1>
      <p className="text-xs text-gray-500 mb-8 max-w-2xl leading-relaxed">
        One rule with a fixed trigger (new email on contact). Under{' '}
        <span className="font-medium text-gray-600">Then</span> set a different outcome per contact
        type.
      </p>

      <CreatorOutreachRulesBuilder
        drafts={drafts.byKind}
        templates={store.templates}
        ruleEnabled={drafts.ruleEnabled}
        onRuleEnabledChange={setRuleEnabled}
        onKindChange={updateKind}
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        onReset={baseline ? () => setDrafts(baseline) : undefined}
      />
    </div>
  )
}
