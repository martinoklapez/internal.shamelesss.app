'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAppDialogs } from '@/components/app-dialogs-provider'
import { CreatorOutreachLoading } from '@/components/creator-outreach-loading'
import { fetchCreatorOutreachStore, mutateCreatorOutreach } from '@/lib/creator-outreach/client-api'
import type { CreatorOutreachStore, SendFromAddress } from '@/lib/creator-outreach/types'
import { cn } from '@/lib/utils'
import { notifyError, notifySuccess } from '@/lib/notify'
import { Plus, Trash2 } from 'lucide-react'

type SenderDraft = SendFromAddress & { isNew?: boolean }

function draftFromSender(sender: SendFromAddress): SenderDraft {
  return { ...sender }
}

function draftsEqual(a: SenderDraft, b: SenderDraft): boolean {
  return (
    a.address === b.address &&
    a.displayName === b.displayName &&
    (a.missiveAccountId ?? '') === (b.missiveAccountId ?? '') &&
    a.enabled === b.enabled &&
    a.isDefault === b.isDefault
  )
}

function createEmptySenderDraft(): SenderDraft {
  return {
    id: crypto.randomUUID(),
    address: '',
    displayName: 'Shamelesss',
    enabled: true,
    isDefault: false,
    isNew: true,
  }
}

export default function CreatorOutreachSendersView() {
  const { confirm } = useAppDialogs()
  const [store, setStore] = useState<CreatorOutreachStore | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draftsById, setDraftsById] = useState<Record<string, SenderDraft>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tokenOwnerEmail, setTokenOwnerEmail] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const data = await fetchCreatorOutreachStore()
    setStore(data)
    setDraftsById(Object.fromEntries(data.sendFromAddresses.map((s) => [s.id, draftFromSender(s)])))
    setSelectedId((current) => {
      if (current && data.sendFromAddresses.some((s) => s.id === current)) return current
      return data.sendFromAddresses[0]?.id ?? null
    })
    setLoadError(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    reload().catch((err) => {
      if (!cancelled) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load senders')
      }
    })
    fetch('/api/creator-pipeline/missive-token-owner')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { tokenOwnerEmail?: string } | null) => {
        if (!cancelled && data?.tokenOwnerEmail) {
          setTokenOwnerEmail(data.tokenOwnerEmail)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [reload])

  const draft = selectedId ? draftsById[selectedId] ?? null : null

  const baseline = useMemo(() => {
    if (!store || !selectedId) return null
    const sender = store.sendFromAddresses.find((s) => s.id === selectedId)
    if (!sender) return null
    return draftFromSender(sender)
  }, [store, selectedId])

  const dirty = useMemo(() => {
    if (!draft) return false
    if (draft.isNew) return true
    return !baseline || !draftsEqual(draft, baseline)
  }, [draft, baseline])

  const sidebarItems = useMemo(() => {
    if (!store) return []
    const items = [...store.sendFromAddresses]
    if (draft?.isNew && !items.some((s) => s.id === draft.id)) {
      items.push(draft)
    }
    return items
  }, [store, draft])

  const save = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const { store: saved } = await mutateCreatorOutreach({
        action: 'saveSendFromAddress',
        address: {
          id: draft.id,
          address: draft.address,
          displayName: draft.displayName,
          missiveAccountId: draft.missiveAccountId,
          signatureHtml: draft.signatureHtml,
          enabled: draft.enabled,
          isDefault: draft.isDefault,
        },
      })
      setStore(saved)
      setDraftsById(Object.fromEntries(saved.sendFromAddresses.map((s) => [s.id, draftFromSender(s)])))
      setSelectedId(draft.id)
      notifySuccess(draft.isNew ? 'Sender added.' : 'Sender saved.')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to save sender')
    } finally {
      setSaving(false)
    }
  }

  const deleteSender = async () => {
    if (!draft || draft.isNew) return
    const ok = await confirm({
      title: `Delete ${draft.address}?`,
      description: 'Cannot delete while referenced by outreach rules.',
      variant: 'destructive',
      confirmLabel: 'Delete',
    })
    if (!ok) return

    setDeleting(true)
    try {
      const { store: saved } = await mutateCreatorOutreach({
        action: 'deleteSendFromAddress',
        addressId: draft.id,
      })
      setStore(saved)
      setDraftsById(Object.fromEntries(saved.sendFromAddresses.map((s) => [s.id, draftFromSender(s)])))
      setSelectedId(saved.sendFromAddresses[0]?.id ?? null)
      notifySuccess('Sender deleted.')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to delete sender')
    } finally {
      setDeleting(false)
    }
  }

  const createSender = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        description: 'Create a new sender and lose your current edits.',
        confirmLabel: 'Continue',
      })
      if (!ok) return
    }
    const next = createEmptySenderDraft()
    setDraftsById({ ...Object.fromEntries((store?.sendFromAddresses ?? []).map((s) => [s.id, draftFromSender(s)])), [next.id]: next })
    setSelectedId(next.id)
  }

  const selectSender = async (id: string) => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        description: 'Switch senders and lose your current edits.',
        confirmLabel: 'Continue',
      })
      if (!ok) return
    }
    setSelectedId(id)
    if (store?.sendFromAddresses.some((s) => s.id === id)) {
      setDraftsById(Object.fromEntries(store.sendFromAddresses.map((s) => [s.id, draftFromSender(s)])))
    }
  }

  if (!store) {
    if (loadError) {
      return <div className="px-5 sm:px-8 lg:px-10 py-12 text-sm text-red-600">{loadError}</div>
    }
    return <CreatorOutreachLoading variant="templates" />
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-5 sm:px-8 lg:px-10 py-8">
      <Link href="/pipeline" className="text-xs text-gray-400 hover:text-gray-700 mb-2 inline-block">
        Creator Pipeline
      </Link>
      <h1 className="text-lg font-semibold text-gray-900 mb-2">Senders</h1>
      <p className="text-xs text-gray-500 mb-4 max-w-2xl leading-relaxed">
        From addresses for automated outreach — usually aliases on a Missive shared email account
        (team inbox). Rules pick which sender to use per contact type. The Missive API only accepts
        addresses the API token user is allowed to send as, which is stricter than composing in the
        app. Email signatures are configured under{' '}
        <Link href="/pipeline/signatures" className="text-gray-700 underline">
          Signatures
        </Link>
        .
      </p>
      {tokenOwnerEmail ? (
        <p className="text-xs text-blue-900 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3 max-w-2xl leading-relaxed">
          Missive API token user: <span className="font-medium">{tokenOwnerEmail}</span>. Automated
          sends always fall back to this address if a Pipeline alias is rejected. Add it under
          Senders if you want it as the default From.
        </p>
      ) : null}
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-8 max-w-2xl leading-relaxed">
        For a <span className="font-medium">shared inbox</span>: Missive → Settings → Accounts →
        select the <span className="font-medium">shared email account</span> → Aliases → edit each
        Pipeline address → <span className="font-medium">Allow others to send</span> → add the API
        token user ({tokenOwnerEmail ?? 'see blue box above'}). Replying in the team inbox does not
        by itself grant API send for that alias.
      </p>

      <div className="flex min-h-[24rem] flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 lg:w-64">
          <div className="rounded-xl border border-gray-200/90 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-medium text-gray-900">Addresses</p>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => void createSender()}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                New
              </Button>
            </div>
            <ul className="divide-y divide-gray-100">
              {sidebarItems.map((sender) => (
                <li key={sender.id}>
                  <button
                    type="button"
                    onClick={() => void selectSender(sender.id)}
                    className={cn(
                      'w-full px-4 py-3 text-left transition-colors',
                      sender.id === selectedId ? 'bg-gray-50' : 'hover:bg-gray-50/70'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-gray-900">
                        {sender.address || 'New sender'}
                      </span>
                      {sender.isDefault ? (
                        <span className="shrink-0 text-[10px] uppercase text-gray-400">default</span>
                      ) : null}
                    </div>
                    {sender.displayName ? (
                      <p className="mt-1 truncate text-xs text-gray-500">{sender.displayName}</p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            {sidebarItems.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">No senders yet.</p>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {!draft ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center text-sm text-gray-500">
              Select a sender or create one.
            </div>
          ) : (
            <article className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-medium text-gray-900">Edit sender</h2>
              <p className="mt-1 text-xs text-gray-500">
                Recipients see this address and display name on outbound outreach.
              </p>

              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="sender-address" className="text-xs">
                    Email address
                  </Label>
                  <Input
                    id="sender-address"
                    type="email"
                    value={draft.address}
                    onChange={(e) =>
                      setDraftsById((prev) => ({
                        ...prev,
                        [draft.id]: { ...prev[draft.id], address: e.target.value },
                      }))
                    }
                    placeholder="creators@yourdomain.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sender-name" className="text-xs">
                    Display name
                  </Label>
                  <Input
                    id="sender-name"
                    value={draft.displayName}
                    onChange={(e) =>
                      setDraftsById((prev) => ({
                        ...prev,
                        [draft.id]: { ...prev[draft.id], displayName: e.target.value },
                      }))
                    }
                    placeholder="Shamelesss"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sender-missive-account" className="text-xs">
                    Missive account ID
                  </Label>
                  <Input
                    id="sender-missive-account"
                    value={draft.missiveAccountId ?? ''}
                    onChange={(e) =>
                      setDraftsById((prev) => ({
                        ...prev,
                        [draft.id]: {
                          ...prev[draft.id],
                          missiveAccountId: e.target.value.trim() || undefined,
                        },
                      }))
                    }
                    placeholder="46396c31-9a60-4c69-9693-79004c637731"
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Optional. Gmail sends use the email address + alias permissions; this ID is only
                    tried if the alias is rejected. Enable &quot;Allow others to send&quot; on the
                    alias for the API token user so sends use this address, not your personal email.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="sender-enabled"
                      checked={draft.enabled}
                      onCheckedChange={(enabled) =>
                        setDraftsById((prev) => ({
                          ...prev,
                          [draft.id]: { ...prev[draft.id], enabled },
                        }))
                      }
                    />
                    <Label htmlFor="sender-enabled" className="text-xs text-gray-600">
                      Enabled
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="sender-default"
                      checked={draft.isDefault}
                      onCheckedChange={(isDefault) =>
                        setDraftsById((prev) => ({
                          ...prev,
                          [draft.id]: { ...prev[draft.id], isDefault },
                        }))
                      }
                    />
                    <Label htmlFor="sender-default" className="text-xs text-gray-600">
                      Default sender
                    </Label>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
                <Button disabled={!dirty || saving} onClick={() => void save()}>
                  {saving ? 'Saving…' : draft.isNew ? 'Add sender' : 'Save sender'}
                </Button>
                {!draft.isNew ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => void deleteSender()}
                    disabled={deleting || saving}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {deleting ? 'Deleting…' : 'Delete'}
                  </Button>
                ) : null}
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  )
}
