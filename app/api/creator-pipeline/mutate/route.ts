import { NextResponse } from 'next/server'
import { loadCreatorOutreachStoreFromDb } from '@/lib/database/creator-pipeline/load-store'
import { persistCreatorOutreachStoreToDb } from '@/lib/database/creator-pipeline/persist-store'
import {
  saveOutreachRulesInDb,
  type SaveOutreachRuleInput,
} from '@/lib/database/creator-pipeline/save-outreach-rules'
import {
  deleteEmailTemplateInDb,
  saveEmailTemplateInDb,
  type SaveEmailTemplateInput,
} from '@/lib/database/creator-pipeline/save-email-templates'
import {
  deleteSendFromAddressInDb,
  saveSendFromAddressInDb,
  type SaveSendFromAddressInput,
} from '@/lib/database/creator-pipeline/save-send-from-addresses'
import { invokeOutreachProcessor } from '@/lib/creator-outreach/invoke-outreach-processor'
import type { EvaluateOutreachResult } from '@/lib/creator-outreach/rules-engine'
import type { CreatorOutreachStore } from '@/lib/creator-outreach/types'
import {
  addCreatorContact,
  createCreator,
  linkProfileToCreator,
  removeCreator,
  removeCreatorContact,
  removeProfile,
  scoutProfile,
  unlinkContactFromCreator,
  unlinkProfileFromCreator,
  updateCreator,
  updateCreatorContact,
  updateProfile,
  type AddCreatorContactInput,
  type ScoutProfileInput,
  type UpdateCreatorContactInput,
} from '@/lib/creator-outreach/store'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'
import { getCreatorPipelineSupabase } from '@/lib/database/creator-pipeline/supabase'
import {
  deleteContactFromDb,
  deleteCreatorFromDb,
  deleteProfileAvatarFromStorage,
  deleteProfileFromDb,
} from '@/lib/database/creator-pipeline/delete-entities'
import { downloadAndUploadProfileAvatar } from '@/lib/database/creator-pipeline/upload-profile-avatar'
import {
  quickAddProfile,
  type QuickAddProfileInput,
} from '@/lib/creator-outreach/quick-add'

export const dynamic = 'force-dynamic'

type MutateBody =
  | { action: 'scoutProfile'; input: ScoutProfileInput }
  | { action: 'quickAddProfile'; input: QuickAddProfileInput }
  | { action: 'createCreator'; displayName: string }
  | {
      action: 'updateCreator'
      creatorId: string
      patch: { displayName?: string; notes?: string; avatarProfileId?: string | null }
    }
  | { action: 'linkProfile'; profileId: string; creatorId: string }
  | { action: 'unlinkProfile'; profileId: string }
  | { action: 'unlinkContact'; contactId: string }
  | {
      action: 'updateProfile'
      profileId: string
      patch: {
        notes?: string
        followerCount?: number | null
        handle?: string
        displayName?: string
      }
    }
  | { action: 'addContact'; input: AddCreatorContactInput }
  | { action: 'updateContact'; contactId: string; patch: UpdateCreatorContactInput }
  | { action: 'removeContact'; contactId: string }
  | { action: 'deleteCreator'; creatorId: string }
  | { action: 'deleteProfile'; profileId: string }
  | { action: 'saveOutreachRules'; rules: SaveOutreachRuleInput[] }
  | { action: 'saveEmailTemplate'; template: SaveEmailTemplateInput }
  | { action: 'deleteEmailTemplate'; templateId: string }
  | { action: 'saveSendFromAddress'; address: SaveSendFromAddressInput }
  | { action: 'deleteSendFromAddress'; addressId: string }
  | { action: 'replaceStore'; store: CreatorOutreachStore }

function cloneStore(store: CreatorOutreachStore): CreatorOutreachStore {
  return structuredClone(store)
}

function mergeOutreachRules(
  persisted: CreatorOutreachStore,
  incoming: CreatorOutreachStore
): CreatorOutreachStore {
  return { ...incoming, outreachRules: persisted.outreachRules }
}

export async function POST(request: Request) {
  const auth = await requireCreatorCrmApi(request)
  if (auth instanceof NextResponse) return auth

  let supabase
  try {
    supabase = getCreatorPipelineSupabase()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server not configured' },
      { status: 500 }
    )
  }

  let body: MutateBody
  try {
    body = (await request.json()) as MutateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const persisted = await loadCreatorOutreachStoreFromDb(supabase)
    let outreach: EvaluateOutreachResult | undefined
    let contactIdsToProcess: string[] = []

    if (body.action === 'saveOutreachRules') {
      const savedRules = await saveOutreachRulesInDb(supabase, body.rules)
      const store = await loadCreatorOutreachStoreFromDb(supabase)
      store.outreachRules = savedRules
      return NextResponse.json({ store })
    }

    if (body.action === 'saveEmailTemplate') {
      const templates = await saveEmailTemplateInDb(supabase, body.template)
      const store = await loadCreatorOutreachStoreFromDb(supabase)
      store.templates = templates
      return NextResponse.json({ store })
    }

    if (body.action === 'deleteEmailTemplate') {
      const templates = await deleteEmailTemplateInDb(supabase, body.templateId)
      const store = await loadCreatorOutreachStoreFromDb(supabase)
      store.templates = templates
      return NextResponse.json({ store })
    }

    if (body.action === 'saveSendFromAddress') {
      const sendFromAddresses = await saveSendFromAddressInDb(supabase, body.address)
      const store = await loadCreatorOutreachStoreFromDb(supabase)
      store.sendFromAddresses = sendFromAddresses
      return NextResponse.json({ store })
    }

    if (body.action === 'deleteSendFromAddress') {
      const sendFromAddresses = await deleteSendFromAddressInDb(supabase, body.addressId)
      const store = await loadCreatorOutreachStoreFromDb(supabase)
      store.sendFromAddresses = sendFromAddresses
      return NextResponse.json({ store })
    }

    const store = cloneStore(persisted)

    switch (body.action) {
      case 'scoutProfile': {
        const result = scoutProfile(store, { ...body.input, scoutedBy: auth.userId })
        Object.assign(store, result.store)
        if (result.emailReadyContactId) {
          contactIdsToProcess.push(result.emailReadyContactId)
        }
        const sourceUrl = body.input.profilePictureSourceUrl?.trim()
        if (sourceUrl) {
          const avatarUrl = await downloadAndUploadProfileAvatar(result.profile.id, sourceUrl)
          if (avatarUrl) {
            updateProfile(store, result.profile.id, { avatarUrl })
          } else {
            console.warn(
              `Profile avatar not stored for ${result.profile.id} (download failed or URL blocked)`
            )
          }
        }
        break
      }
      case 'quickAddProfile': {
        const result = quickAddProfile(store, { ...body.input, scoutedBy: auth.userId })
        Object.assign(store, result.store)
        if (result.emailReadyContactId) {
          contactIdsToProcess.push(result.emailReadyContactId)
        }
        const sourceUrl = body.input.profilePictureSourceUrl?.trim()
        if (sourceUrl) {
          const avatarUrl = await downloadAndUploadProfileAvatar(result.profile.id, sourceUrl)
          if (avatarUrl) {
            updateProfile(store, result.profile.id, { avatarUrl })
          } else {
            console.warn(
              `Profile avatar not stored for ${result.profile.id} (download failed or URL blocked)`
            )
          }
        }
        break
      }
      case 'createCreator':
        createCreator(store, body.displayName)
        break
      case 'updateCreator':
        updateCreator(store, body.creatorId, body.patch)
        break
      case 'linkProfile':
        linkProfileToCreator(store, body.profileId, body.creatorId)
        break
      case 'unlinkProfile':
        unlinkProfileFromCreator(store, body.profileId)
        break
      case 'unlinkContact':
        unlinkContactFromCreator(store, body.contactId)
        break
      case 'updateProfile':
        updateProfile(store, body.profileId, body.patch)
        break
      case 'addContact': {
        const result = addCreatorContact(store, body.input)
        Object.assign(store, result.store)
        if (result.emailReadyContactId) {
          contactIdsToProcess.push(result.emailReadyContactId)
        }
        break
      }
      case 'updateContact': {
        const result = updateCreatorContact(store, body.contactId, body.patch)
        Object.assign(store, result.store)
        if (result.emailReadyContactId) {
          contactIdsToProcess.push(result.emailReadyContactId)
        }
        break
      }
      case 'removeContact':
        removeCreatorContact(store, body.contactId)
        await deleteContactFromDb(supabase, body.contactId)
        break
      case 'deleteCreator': {
        const { store: updated, deletedContactIds } = removeCreator(store, body.creatorId)
        Object.assign(store, updated)
        await deleteCreatorFromDb(supabase, body.creatorId, deletedContactIds)
        break
      }
      case 'deleteProfile':
        removeProfile(store, body.profileId)
        await deleteProfileFromDb(supabase, body.profileId)
        void deleteProfileAvatarFromStorage(body.profileId)
        break
      case 'replaceStore': {
        const merged = mergeOutreachRules(persisted, cloneStore(body.store))
        await persistCreatorOutreachStoreToDb(supabase, merged)
        const processed = await invokeOutreachProcessor(supabase)
        const saved = await loadCreatorOutreachStoreFromDb(supabase)
        return NextResponse.json({
          store: saved,
          outreach: processed.outreach,
        })
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    await persistCreatorOutreachStoreToDb(supabase, store)

    if (contactIdsToProcess.length > 0) {
      const processed = await invokeOutreachProcessor(supabase, {
        contactIds: contactIdsToProcess,
      })
      outreach = processed.outreach
    }

    const saved = await loadCreatorOutreachStoreFromDb(supabase)
    return NextResponse.json({
      store: saved,
      outreach,
    })
  } catch (error) {
    console.error('POST /api/creator-pipeline/mutate:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mutation failed' },
      { status: 500 }
    )
  }
}
