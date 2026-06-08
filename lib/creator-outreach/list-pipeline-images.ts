import type { PipelineAssetItem } from '@/lib/database/creator-pipeline/list-pipeline-assets'
import type { PipelineAssetScope } from '@/lib/database/creator-pipeline/pipeline-assets'

export async function fetchPipelineAssets(options?: {
  scope?: PipelineAssetScope
  ownerId?: string
}): Promise<PipelineAssetItem[]> {
  const params = new URLSearchParams()
  if (options?.scope) params.set('scope', options.scope)
  if (options?.ownerId) params.set('ownerId', options.ownerId)

  const query = params.toString()
  const res = await fetch(`/api/creator-pipeline/assets${query ? `?${query}` : ''}`, {
    cache: 'no-store',
  })

  const data = (await res.json().catch(() => ({}))) as {
    assets?: PipelineAssetItem[]
    error?: string
  }

  if (!res.ok) {
    throw new Error(data.error ?? `Failed to load images (${res.status})`)
  }

  return data.assets ?? []
}
