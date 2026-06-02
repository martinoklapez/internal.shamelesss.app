'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  buildEmailTemplateDrafts,
  createEmptyEmailTemplateDraft,
  CreatorOutreachTemplatesBuilder,
  emailTemplateDraftEqual,
  type EmailTemplateDraft,
} from '@/components/creator-outreach-templates-builder'
import { useAppDialogs } from '@/components/app-dialogs-provider'
import { CreatorOutreachLoading } from '@/components/creator-outreach-loading'
import { fetchCreatorOutreachStore, mutateCreatorOutreach } from '@/lib/creator-outreach/client-api'
import type { CreatorOutreachStore } from '@/lib/creator-outreach/types'
import { notifyError, notifySuccess } from '@/lib/notify'

export default function CreatorOutreachTemplatesView() {
  const { confirm } = useAppDialogs()
  const [store, setStore] = useState<CreatorOutreachStore | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draftsById, setDraftsById] = useState<Record<string, EmailTemplateDraft>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(async () => {
    const data = await fetchCreatorOutreachStore()
    setStore(data)
    setDraftsById(buildEmailTemplateDrafts(data.templates))
    setSelectedId((current) => {
      if (current && data.templates.some((template) => template.id === current)) {
        return current
      }
      return data.templates[0]?.id ?? null
    })
    setLoadError(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    reload().catch((err) => {
      if (!cancelled) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load templates')
      }
    })
    return () => {
      cancelled = true
    }
  }, [reload])

  const draft = selectedId ? draftsById[selectedId] ?? null : null

  const baseline = useMemo(() => {
    if (!store || !selectedId) return null
    const template = store.templates.find((item) => item.id === selectedId)
    if (!template) return null
    return buildEmailTemplateDrafts([template])[selectedId]
  }, [store, selectedId])

  const dirty = useMemo(() => {
    if (!draft) return false
    if (draft.isNew) return true
    return !emailTemplateDraftEqual(draft, baseline)
  }, [draft, baseline])

  const updateDraft = (patch: Partial<EmailTemplateDraft>) => {
    if (!selectedId) return
    setDraftsById((prev) => ({
      ...prev,
      [selectedId]: { ...prev[selectedId], ...patch },
    }))
  }

  const createTemplate = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        description: 'Create a new template and lose your current edits.',
        confirmLabel: 'Continue',
      })
      if (!ok) return
    }

    const next = createEmptyEmailTemplateDraft()
    setDraftsById({ ...buildEmailTemplateDrafts(store?.templates ?? []), [next.id]: next })
    setSelectedId(next.id)
  }

  const resetDraft = () => {
    if (!selectedId) return
    if (baseline) {
      setDraftsById((prev) => ({ ...prev, [selectedId]: baseline }))
      return
    }
    setDraftsById((prev) => {
      const next = { ...prev }
      delete next[selectedId]
      return next
    })
    setSelectedId(store?.templates[0]?.id ?? null)
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const { store: saved } = await mutateCreatorOutreach({
        action: 'saveEmailTemplate',
        template: {
          id: draft.id,
          name: draft.name,
          subject: draft.subject,
          bodyPreview: draft.bodyPreview,
          isDefault: draft.isDefault,
        },
      })
      setStore(saved)
      setDraftsById(buildEmailTemplateDrafts(saved.templates))
      setSelectedId(draft.id)
      notifySuccess(draft.isNew ? 'Template created.' : 'Template saved.')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const deleteTemplate = async () => {
    if (!draft || draft.isNew) return
    const ok = await confirm({
      title: `Delete “${draft.name}”?`,
      description: 'This cannot be undone. Templates used by outreach rules or past sends cannot be deleted.',
      variant: 'destructive',
      confirmLabel: 'Delete',
    })
    if (!ok) return

    setDeleting(true)
    try {
      const { store: saved } = await mutateCreatorOutreach({
        action: 'deleteEmailTemplate',
        templateId: draft.id,
      })
      setStore(saved)
      setDraftsById(buildEmailTemplateDrafts(saved.templates))
      setSelectedId(saved.templates[0]?.id ?? null)
      notifySuccess('Template deleted.')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to delete template')
    } finally {
      setDeleting(false)
    }
  }

  const selectTemplate = async (id: string) => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        description: 'Switch templates and lose your current edits.',
        confirmLabel: 'Continue',
      })
      if (!ok) return
    }
    setSelectedId(id)
    if (store?.templates.some((template) => template.id === id)) {
      setDraftsById(buildEmailTemplateDrafts(store.templates))
    }
  }

  if (!store) {
    if (loadError) {
      return (
        <div className="px-5 sm:px-8 lg:px-10 py-12 text-sm text-red-600">{loadError}</div>
      )
    }
    return <CreatorOutreachLoading variant="templates" />
  }

  const sidebarTemplates = store.templates
  const selectedDraftIsNew = draft?.isNew === true
  const sidebarItems = selectedDraftIsNew && draft
    ? [...sidebarTemplates, { id: draft.id, name: draft.name, subject: draft.subject, bodyPreview: draft.bodyPreview, isDefault: draft.isDefault }]
    : sidebarTemplates

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-5 sm:px-8 lg:px-10 py-8">
      <Link
        href="/pipeline"
        className="text-xs text-gray-400 hover:text-gray-700 mb-2 inline-block"
      >
        Creator Pipeline
      </Link>
      <h1 className="text-lg font-semibold text-gray-900 mb-2">Templates</h1>
      <p className="text-xs text-gray-500 mb-8 max-w-2xl leading-relaxed">
        Create and edit outreach email templates. Placeholders like{' '}
        <code className="text-[11px] text-gray-600">{'{{creator_name}}'}</code> are filled in when
        a rule sends the email.
      </p>

      <CreatorOutreachTemplatesBuilder
        templates={sidebarItems}
        selectedId={selectedId}
        draft={draft}
        dirty={dirty}
        saving={saving}
        deleting={deleting}
        onSelect={selectTemplate}
        onDraftChange={updateDraft}
        onCreate={createTemplate}
        onSave={() => void save()}
        onReset={resetDraft}
        onDelete={() => void deleteTemplate()}
      />
    </div>
  )
}
