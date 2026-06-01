import type { SupabaseClient } from '@supabase/supabase-js'
import { creatorPipelineDb } from './client'
import {
  CREATOR_PIPELINE_AVATARS_BUCKET,
} from './upload-profile-avatar'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'

export async function deleteContactFromDb(
  supabase: SupabaseClient,
  contactId: string
): Promise<void> {
  const db = creatorPipelineDb(supabase)
  const { error } = await db.from('contacts').delete().eq('id', contactId)
  if (error) throw new Error(`Failed to delete contact: ${error.message}`)
}

export async function deleteProfileFromDb(
  supabase: SupabaseClient,
  profileId: string
): Promise<void> {
  const db = creatorPipelineDb(supabase)
  const { error } = await db.from('profiles').delete().eq('id', profileId)
  if (error) throw new Error(`Failed to delete profile: ${error.message}`)
}

export async function deleteCreatorFromDb(
  supabase: SupabaseClient,
  creatorId: string,
  contactIds: string[]
): Promise<void> {
  const db = creatorPipelineDb(supabase)
  if (contactIds.length > 0) {
    const { error: contactsError } = await db.from('contacts').delete().in('id', contactIds)
    if (contactsError) {
      throw new Error(`Failed to delete creator contacts: ${contactsError.message}`)
    }
  }
  const { error } = await db.from('creators').delete().eq('id', creatorId)
  if (error) throw new Error(`Failed to delete creator: ${error.message}`)
}

/** Best-effort removal of cached avatar objects for a profile. */
export async function deleteProfileAvatarFromStorage(profileId: string): Promise<void> {
  try {
    const admin = getAdminSupabaseClient()
    const { data: files, error: listError } = await admin.storage
      .from(CREATOR_PIPELINE_AVATARS_BUCKET)
      .list(profileId)
    if (listError || !files?.length) return
    const paths = files.map((f) => `${profileId}/${f.name}`)
    await admin.storage.from(CREATOR_PIPELINE_AVATARS_BUCKET).remove(paths)
  } catch (error) {
    console.error(`Failed to delete avatar storage for profile ${profileId}:`, error)
  }
}
