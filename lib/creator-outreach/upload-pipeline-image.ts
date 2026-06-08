import type { PipelineAssetScope } from '@/lib/database/creator-pipeline/pipeline-assets'

export async function uploadPipelineImage(
  file: File,
  scope: PipelineAssetScope,
  ownerId: string
): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('scope', scope)
  form.append('ownerId', ownerId)

  const res = await fetch('/api/creator-pipeline/upload-image', {
    method: 'POST',
    body: form,
  })

  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? `Upload failed (${res.status})`)
  }
  if (!data.url) {
    throw new Error('Upload succeeded but no URL was returned')
  }
  return data.url
}
