'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { CreatorOutreachStore } from '@/lib/creator-outreach/types'
import { CreatorOutreachLoading } from '@/components/creator-outreach-loading'
import { fetchCreatorOutreachStore } from '@/lib/creator-outreach/client-api'
import { formatDate } from '@/lib/utils/date'

export default function CreatorOutreachLogView() {
  const [store, setStore] = useState<CreatorOutreachStore | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCreatorOutreachStore()
      .then((data) => {
        if (!cancelled) setStore(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load log')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!store) {
    if (loadError) {
      return (
        <div className="px-5 sm:px-8 lg:px-10 py-12 text-sm text-red-600">{loadError}</div>
      )
    }
    return <CreatorOutreachLoading variant="log" />
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-5 sm:px-8 lg:px-10 py-8">
      <Link
        href="/creator-crm"
        className="text-xs text-gray-400 hover:text-gray-700 mb-2 inline-block"
      >
        Creator CRM
      </Link>
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Log</h1>
      <p className="text-xs text-gray-400 mb-6">
        Outreach sends and CRM activity · Supabase creator_pipeline
      </p>

      <div className="space-y-8">
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">Outreach</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {store.outreachSends.length === 0 ? (
              <li className="py-6 text-gray-400">Empty</li>
            ) : (
              store.outreachSends.map((s) => (
                <li key={s.id} className="py-2 flex gap-3 items-baseline">
                  <span className="font-mono text-xs text-gray-800 min-w-0 truncate flex-1">
                    {s.email}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {s.status === 'sent'
                      ? s.templateName
                      : s.status === 'skipped_duplicate'
                        ? 'skipped'
                        : 'queued'}
                  </span>
                  <span className="text-xs text-gray-300 shrink-0 w-20 text-right">
                    {formatDate(s.sentAt)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">Activity</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {store.activity.map((e) => (
              <li key={e.id} className="py-2 flex gap-3">
                <span className="text-xs text-gray-300 shrink-0 w-20">
                  {formatDate(e.createdAt)}
                </span>
                <span className="text-gray-700">{e.message}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
