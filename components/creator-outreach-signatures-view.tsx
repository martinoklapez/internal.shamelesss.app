'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAppDialogs } from '@/components/app-dialogs-provider'
import { CreatorOutreachLoading } from '@/components/creator-outreach-loading'
import { fetchCreatorOutreachStore, mutateCreatorOutreach } from '@/lib/creator-outreach/client-api'
import { formatSignatureHtmlForEditing } from '@/lib/creator-outreach/format-signature-html'
import { signatureHtmlForPreview } from '@/lib/creator-outreach/signature-preview-html'
import type { CreatorOutreachStore, SendFromAddress } from '@/lib/creator-outreach/types'
import { cn } from '@/lib/utils'
import { PipelineImageUpload } from '@/components/pipeline-image-upload'
import { notifyError, notifySuccess } from '@/lib/notify'

export default function CreatorOutreachSignaturesView() {
  const { confirm } = useAppDialogs()
  const [store, setStore] = useState<CreatorOutreachStore | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [signatureHtml, setSignatureHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('preview')

  const reload = useCallback(async () => {
    const data = await fetchCreatorOutreachStore()
    setStore(data)
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
        setLoadError(err instanceof Error ? err.message : 'Failed to load signatures')
      }
    })
    return () => {
      cancelled = true
    }
  }, [reload])

  const selected = useMemo(
    () => store?.sendFromAddresses.find((s) => s.id === selectedId) ?? null,
    [store, selectedId]
  )

  const baselineHtml = useMemo(
    () => formatSignatureHtmlForEditing(selected?.signatureHtml ?? ''),
    [selected?.signatureHtml]
  )

  useEffect(() => {
    setSignatureHtml(baselineHtml)
    setActiveTab('preview')
  }, [selected?.id, baselineHtml])

  const dirty = baselineHtml !== signatureHtml

  const previewHtml = useMemo(
    () => signatureHtmlForPreview(signatureHtml.trim()),
    [signatureHtml]
  )

  const save = async () => {
    if (!selected || !store) return
    setSaving(true)
    try {
      const { store: saved } = await mutateCreatorOutreach({
        action: 'saveSendFromAddress',
        address: senderPayload(selected, signatureHtml),
      })
      setStore(saved)
      const updated = saved.sendFromAddresses.find((s) => s.id === selected.id)
      setSignatureHtml(formatSignatureHtmlForEditing(updated?.signatureHtml ?? ''))
      notifySuccess('Signature saved.')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to save signature')
    } finally {
      setSaving(false)
    }
  }

  const selectSender = async (id: string) => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        description: 'Switch sender and lose your current signature edits.',
        confirmLabel: 'Continue',
      })
      if (!ok) return
    }
    setSelectedId(id)
    const sender = store?.sendFromAddresses.find((s) => s.id === id)
    setSignatureHtml(formatSignatureHtmlForEditing(sender?.signatureHtml ?? ''))
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
      <h1 className="text-lg font-semibold text-gray-900 mb-2">Signatures</h1>
      <p className="text-xs text-gray-500 mb-8 max-w-2xl leading-relaxed">
        HTML signature appended after every outreach template for the matching sender. Copy from
        Missive → Settings → Signatures (HTML mode). Manage From addresses under{' '}
        <Link href="/pipeline/senders" className="text-gray-700 underline">
          Senders
        </Link>
        .
      </p>

      {store.sendFromAddresses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center text-sm text-gray-500">
          No senders yet.{' '}
          <Link href="/pipeline/senders" className="text-gray-900 underline">
            Add a sender
          </Link>{' '}
          first.
        </div>
      ) : (
        <div className="flex min-h-[32rem] flex-col gap-6 lg:flex-row lg:items-start">
          <aside className="w-full shrink-0 lg:w-64">
            <div className="rounded-xl border border-gray-200/90 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-medium text-gray-900">By sender</p>
              </div>
              <ul className="divide-y divide-gray-100">
                {store.sendFromAddresses.map((sender) => (
                  <li key={sender.id}>
                    <button
                      type="button"
                      onClick={() => void selectSender(sender.id)}
                      className={cn(
                        'w-full px-4 py-3 text-left transition-colors',
                        sender.id === selectedId ? 'bg-gray-50' : 'hover:bg-gray-50/70'
                      )}
                    >
                      <span className="block truncate text-sm font-medium text-gray-900">
                        {sender.address}
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        {sender.signatureHtml ? 'Signature set' : 'No signature'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {!selected ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center text-sm text-gray-500">
                Select a sender.
              </div>
            ) : (
              <article className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-sm font-medium text-gray-900">Edit signature</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {selected.address}
                    {selected.displayName ? ` · ${selected.displayName}` : ''} — appended after
                    outreach templates on send.
                  </p>
                </div>

                <div className="mt-6">
                  <div
                    className="flex gap-5 border-b border-gray-100"
                    role="tablist"
                    aria-label="Signature sections"
                  >
                    {(
                      [
                        ['edit', 'Signature editing'],
                        ['preview', 'Preview'],
                      ] as const
                    ).map(([tab, label]) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          '-mb-px border-b-2 pb-2.5 text-xs font-medium transition-colors',
                          activeTab === tab
                            ? 'border-gray-900 text-gray-900'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'edit' ? (
                    <div role="tabpanel" className="space-y-5 pt-5">
                      <div className="space-y-2">
                        <Label htmlFor="signature-html" className="text-xs">
                          HTML
                        </Label>
                        <Textarea
                          id="signature-html"
                          value={signatureHtml}
                          onChange={(e) => setSignatureHtml(e.target.value)}
                          rows={16}
                          spellCheck={false}
                          className={cn(
                            'min-h-[20rem] font-mono text-[13px] leading-relaxed',
                            'whitespace-pre bg-gray-50/80 [tab-size:2]',
                            'resize-y'
                          )}
                          placeholder="Paste HTML from Missive → Settings → Signatures"
                        />
                        <PipelineImageUpload
                          scope="signatures"
                          ownerId={selected.id}
                          label="Logo / image"
                          hint="Uploads to the pipeline assets bucket and appends an img tag to your signature HTML."
                          onUploaded={(url) => {
                            const img = `<img src="${url}" alt="" width="120" style="display:block;max-width:120px;height:auto;" />`
                            setSignatureHtml((prev) => (prev.trim() ? `${prev.trim()}\n${img}` : img))
                          }}
                        />
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          Gmail <span className="font-mono">mail-sig</span> images are proxied for
                          preview only. Upload logos here or use a public HTTPS URL in the HTML.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div role="tabpanel" className="space-y-5 pt-5">
                      <p className="text-xs text-gray-500">
                        Signature only — the outreach template is added above this when sent.
                      </p>
                      {previewHtml ? (
                        <div className="rounded-lg border border-gray-100 bg-gray-50/40 p-4">
                          <div
                            className="text-sm leading-relaxed text-gray-700 [&_a]:text-blue-600 [&_img]:max-w-full"
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                          />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-gray-200 px-6 py-12 text-center text-sm text-gray-500">
                          No signature HTML yet. Add content under Signature editing.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
                  <Button disabled={!dirty || saving} onClick={() => void save()}>
                    {saving ? 'Saving…' : 'Save signature'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!signatureHtml}
                    onClick={() => setSignatureHtml('')}
                  >
                    Clear
                  </Button>
                </div>
              </article>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function senderPayload(sender: SendFromAddress, signatureHtml: string) {
  return {
    id: sender.id,
    address: sender.address,
    displayName: sender.displayName,
    missiveAccountId: sender.missiveAccountId,
    signatureHtml: signatureHtml.trim() || undefined,
    enabled: sender.enabled,
    isDefault: sender.isDefault,
  }
}
