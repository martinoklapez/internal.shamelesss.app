const SIGNED_URL_TTL_SEC = 3600
const SIGNED_URL_PATH_CHUNK = 50

/**
 * Batch-sign private bucket paths per message id (e.g. chat-images, explicit-photos).
 * Uses `storage_bucket` from each row only — never inferred from the path.
 */
export async function signedImageUrlsByMessageId(
  admin: any,
  msgs: Record<string, unknown>[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()

  type Item = { messageId: string; path: string }
  const byBucket = new Map<string, Item[]>()

  for (const m of msgs) {
    const id = typeof m.id === 'string' ? m.id : ''
    const pathRaw = m.storage_path
    const bucketRaw = m.storage_bucket
    const path = typeof pathRaw === 'string' ? pathRaw.trim() : ''
    const bucket = typeof bucketRaw === 'string' ? bucketRaw.trim() : ''
    if (!id || !path || !bucket) continue

    const list = byBucket.get(bucket) ?? []
    list.push({ messageId: id, path })
    byBucket.set(bucket, list)
  }

  for (const [bucket, items] of byBucket) {
    const pathToMessageIds = new Map<string, string[]>()
    for (const it of items) {
      const arr = pathToMessageIds.get(it.path) ?? []
      arr.push(it.messageId)
      pathToMessageIds.set(it.path, arr)
    }

    const uniquePaths = [...pathToMessageIds.keys()]
    for (let i = 0; i < uniquePaths.length; i += SIGNED_URL_PATH_CHUNK) {
      const slice = uniquePaths.slice(i, i + SIGNED_URL_PATH_CHUNK)
      const { data, error } = await admin.storage.from(bucket).createSignedUrls(slice, SIGNED_URL_TTL_SEC)

      if (error) {
        console.error('signedImageUrlsByMessageId createSignedUrls:', bucket, error.message)
        continue
      }

      type SignedRow = { path?: string; signedUrl?: string; error?: string }
      const rows = (data ?? []) as SignedRow[]

      for (let j = 0; j < slice.length; j++) {
        const requestedPath = slice[j]
        const row = rows[j]
        const url = typeof row?.signedUrl === 'string' ? row.signedUrl.trim() : ''
        if (!url || row?.error) continue
        const ids = pathToMessageIds.get(requestedPath) ?? []
        for (const mid of ids) out.set(mid, url)
      }
    }
  }

  return out
}
