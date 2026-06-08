import { getAdminSupabaseClient } from '@/lib/supabase/admin'

export const CREATOR_PIPELINE_ASSETS_BUCKET = 'creator-pipeline-assets'

export const MAX_PIPELINE_ASSET_BYTES = 5 * 1024 * 1024

export type PipelineAssetScope = 'senders' | 'signatures'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

export function isPipelineAssetScope(value: string): value is PipelineAssetScope {
  return value === 'senders' || value === 'signatures'
}

export function assertPipelineAssetOwnerId(ownerId: string): void {
  if (!UUID_RE.test(ownerId.trim())) {
    throw new Error('Invalid owner id')
  }
}

function extensionForUpload(contentType: string, fileName: string): string {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (normalized.includes('svg')) return 'svg'
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('webp')) return 'webp'
  if (normalized.includes('gif')) return 'gif'
  const fromName = fileName.split('.').pop()?.toLowerCase()
  if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  return 'jpg'
}

export function buildPipelineAssetPath(
  scope: PipelineAssetScope,
  ownerId: string,
  fileName: string,
  contentType: string
): string {
  assertPipelineAssetOwnerId(ownerId)
  const ext = extensionForUpload(contentType, fileName)
  const prefix = scope === 'senders' ? 'host' : 'image'
  return `${scope}/${ownerId.trim()}/${prefix}-${Date.now()}.${ext}`
}

export function validatePipelineAssetFile(file: File): void {
  const contentType = file.type.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!contentType.startsWith('image/') && !ALLOWED_MIME.has(contentType)) {
    throw new Error('File must be an image')
  }
  if (file.size > MAX_PIPELINE_ASSET_BYTES) {
    throw new Error('Image must be 5MB or smaller')
  }
}

export async function uploadPipelineAssetFile(
  scope: PipelineAssetScope,
  ownerId: string,
  file: File
): Promise<string> {
  validatePipelineAssetFile(file)
  const path = buildPipelineAssetPath(scope, ownerId, file.name, file.type)
  const admin = getAdminSupabaseClient()
  const contentType = file.type.split(';')[0]?.trim() || 'image/jpeg'

  const { error: uploadError } = await admin.storage
    .from(CREATOR_PIPELINE_ASSETS_BUCKET)
    .upload(path, file, {
      contentType,
      upsert: false,
      cacheControl: '31536000',
    })

  if (uploadError) {
    if (
      uploadError.message?.includes('Bucket not found') ||
      uploadError.message?.includes('not found')
    ) {
      throw new Error(
        `Storage bucket "${CREATOR_PIPELINE_ASSETS_BUCKET}" not found. Run Supabase migrations.`
      )
    }
    throw new Error(uploadError.message)
  }

  const { data } = admin.storage.from(CREATOR_PIPELINE_ASSETS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export function isCreatorPipelineAssetUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.pathname.includes(`/storage/v1/object/public/${CREATOR_PIPELINE_ASSETS_BUCKET}/`)
  } catch {
    return false
  }
}
