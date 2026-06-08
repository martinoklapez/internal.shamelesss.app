import {
  CREATOR_PIPELINE_ASSETS_BUCKET,
  type PipelineAssetScope,
  assertPipelineAssetOwnerId,
  isPipelineAssetScope,
} from './pipeline-assets'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'

export type PipelineAssetItem = {
  path: string
  url: string
  name: string
  scope: PipelineAssetScope
  ownerId: string
  createdAt: string | null
}

function publicUrlForPath(path: string): string {
  const { data } = getAdminSupabaseClient()
    .storage.from(CREATOR_PIPELINE_ASSETS_BUCKET)
    .getPublicUrl(path)
  return data.publicUrl
}

function parseAssetPath(path: string): { scope: PipelineAssetScope; ownerId: string } | null {
  const parts = path.split('/').filter(Boolean)
  if (parts.length < 3) return null
  const scope = parts[0]
  const ownerId = parts[1]
  if (!isPipelineAssetScope(scope)) return null
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) return null
  return { scope, ownerId }
}

async function listFilesAtPrefix(prefix: string): Promise<PipelineAssetItem[]> {
  const admin = getAdminSupabaseClient()
  const { data, error } = await admin.storage.from(CREATOR_PIPELINE_ASSETS_BUCKET).list(prefix, {
    limit: 200,
    sortBy: { column: 'created_at', order: 'desc' },
  })

  if (error) {
    throw new Error(error.message)
  }

  const items: PipelineAssetItem[] = []

  for (const entry of data ?? []) {
    const fullPath = `${prefix}/${entry.name}`
    const isFile = entry.metadata !== null && entry.metadata !== undefined

    if (isFile) {
      const parsed = parseAssetPath(fullPath)
      if (!parsed) continue
      items.push({
        path: fullPath,
        url: publicUrlForPath(fullPath),
        name: entry.name,
        scope: parsed.scope,
        ownerId: parsed.ownerId,
        createdAt: entry.created_at ?? null,
      })
      continue
    }

    const nested = await listFilesAtPrefix(fullPath)
    items.push(...nested)
  }

  return items
}

export async function listPipelineAssets(options?: {
  scope?: PipelineAssetScope
  ownerId?: string
}): Promise<PipelineAssetItem[]> {
  const scope = options?.scope
  const ownerId = options?.ownerId?.trim()

  if (scope && ownerId) {
    assertPipelineAssetOwnerId(ownerId)
    return listFilesAtPrefix(`${scope}/${ownerId}`)
  }

  if (scope) {
    return listFilesAtPrefix(scope)
  }

  const [senders, signatures] = await Promise.all([
    listFilesAtPrefix('senders'),
    listFilesAtPrefix('signatures'),
  ])

  return [...senders, ...signatures].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0
    return bTime - aTime
  })
}
