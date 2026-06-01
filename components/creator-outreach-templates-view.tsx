'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { CreatorOutreachStore } from '@/lib/creator-outreach/types'
import { CreatorOutreachLoading } from '@/components/creator-outreach-loading'
import { fetchCreatorOutreachStore } from '@/lib/creator-outreach/client-api'

export default function CreatorOutreachTemplatesView() {
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
          setLoadError(err instanceof Error ? err.message : 'Failed to load templates')
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
    return <CreatorOutreachLoading variant="templates" />
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-5 sm:px-8 lg:px-10 py-8">
      <Link
        href="/pipeline"
        className="text-xs text-gray-400 hover:text-gray-700 mb-2 inline-block"
      >
        Creator Pipeline
      </Link>
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Templates</h1>
      <p className="text-xs text-gray-400 mb-6">Email templates used for outreach · Supabase creator_pipeline</p>

      <ul className="divide-y divide-gray-100">
        {store.templates.map((t) => (
          <li key={t.id} className="py-4">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-gray-900">{t.name}</span>
              {t.isDefault && (
                <span className="text-[10px] text-gray-400 uppercase">default</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{t.subject}</p>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{t.bodyPreview}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
