import { fetchProfilePictureBytes } from '@/lib/social-profile-picture-fetch'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'

export const CREATOR_PIPELINE_AVATARS_BUCKET = 'creator-pipeline-avatars'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function extensionForContentType(contentType: string): string {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('webp')) return 'webp'
  if (normalized.includes('gif')) return 'gif'
  return 'jpg'
}

/**
 * Download a social profile picture and store it in Supabase Storage.
 * Returns the public URL saved on `creator_pipeline.profiles.avatar_url`.
 */
export async function downloadAndUploadProfileAvatar(
  profileId: string,
  sourceUrl: string
): Promise<string | null> {
  try {
    const fetched = await fetchProfilePictureBytes(sourceUrl)
    if (!fetched) return null

    const { bytes, contentType } = fetched
    if (bytes.length > MAX_AVATAR_BYTES) {
      console.error(`Profile avatar rejected: size ${bytes.length} bytes`)
      return null
    }

    const ext = extensionForContentType(contentType)
    const path = `${profileId}/avatar.${ext}`
    const admin = getAdminSupabaseClient()

    const { error: uploadError } = await admin.storage
      .from(CREATOR_PIPELINE_AVATARS_BUCKET)
      .upload(path, bytes, {
        contentType: contentType.split(';')[0]?.trim() || 'image/jpeg',
        upsert: true,
        cacheControl: '31536000',
      })

    if (uploadError) {
      console.error('Profile avatar upload failed:', uploadError.message)
      return null
    }

    const { data } = admin.storage.from(CREATOR_PIPELINE_AVATARS_BUCKET).getPublicUrl(path)
    return data.publicUrl
  } catch (error) {
    console.error('Profile avatar download/upload error:', error)
    return null
  }
}
