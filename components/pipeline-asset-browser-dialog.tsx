'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { PipelineAssetItem } from '@/lib/database/creator-pipeline/list-pipeline-assets'
import type { PipelineAssetScope } from '@/lib/database/creator-pipeline/pipeline-assets'
import { fetchPipelineAssets } from '@/lib/creator-outreach/list-pipeline-images'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type PipelineAssetBrowserDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (url: string) => void
  scope?: PipelineAssetScope
  title?: string
}

export function PipelineAssetBrowserDialog({
  open,
  onOpenChange,
  onSelect,
  scope,
  title = 'Choose image',
}: PipelineAssetBrowserDialogProps) {
  const [assets, setAssets] = useState<PipelineAssetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | PipelineAssetScope>(scope ?? 'all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (filter === 'all') {
        setAssets(await fetchPipelineAssets())
        return
      }
      setAssets(await fetchPipelineAssets({ scope: filter }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images')
      setAssets([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  useEffect(() => {
    if (open) {
      setFilter(scope ?? 'all')
    }
  }, [open, scope])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Images from the pipeline assets bucket.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'All'],
              ['senders', 'Senders'],
              ['signatures', 'Signatures'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={filter === key ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading images…
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-600">{error}</p>
        ) : assets.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            No images yet. Upload one to add it here.
          </p>
        ) : (
          <div className="grid max-h-[24rem] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {assets.map((asset) => (
              <button
                key={asset.path}
                type="button"
                onClick={() => {
                  onSelect(asset.url)
                  onOpenChange(false)
                }}
                className={cn(
                  'group overflow-hidden rounded-lg border border-gray-200 bg-white p-1 text-left',
                  'transition-colors hover:border-gray-400 hover:bg-gray-50'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt={asset.name}
                  className="aspect-square w-full rounded-md object-cover"
                />
                <span className="mt-1 block truncate px-0.5 text-[10px] text-gray-500">
                  {asset.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
