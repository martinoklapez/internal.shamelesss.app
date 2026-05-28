import { NextResponse } from 'next/server'
import { loadCreatorOutreachStoreFromDb } from '@/lib/database/creator-pipeline/load-store'
import { persistCreatorOutreachStoreToDb } from '@/lib/database/creator-pipeline/persist-store'
import type { CreatorOutreachStore } from '@/lib/creator-outreach/types'
import {
  addCreatorContact,
  createCreator,
  linkProfileToCreator,
  removeCreatorContact,
  scoutProfile,
  unlinkProfileFromCreator,
  updateCreator,
  updateCreatorContact,
  updateProfile,
  type AddCreatorContactInput,
  type EvaluateOutreachResult,
  type ScoutProfileInput,
  type UpdateCreatorContactInput,
} from '@/lib/creator-outreach/store'
import { requireCreatorCrmApi } from '@/lib/creator-outreach/require-creator-crm-api'

export const dynamic = 'force-dynamic'

type MutateBody =
  | { action: 'scoutProfile'; input: ScoutProfileInput }
  | { action: 'createCreator'; displayName: string }
  | { action: 'updateCreator'; creatorId: string; patch: { displayName?: string; notes?: string } }
  | { action: 'linkProfile'; profileId: string; creatorId: string }
  | { action: 'unlinkProfile'; profileId: string }
  | { action: 'updateProfile'; profileId: string; patch: { notes?: string; followerCount?: number | null; handle?: string } }
  | { action: 'addContact'; input: AddCreatorContactInput }
  | { action: 'updateContact'; contactId: string; patch: UpdateCreatorContactInput }
  | { action: 'removeContact'; contactId: string }
  | { action: 'replaceStore'; store: CreatorOutreachStore }

function cloneStore(store: CreatorOutreachStore): CreatorOutreachStore {
  return structuredClone(store)
}

export async function POST(request: Request) {
  const auth = await requireCreatorCrmApi()
  if (auth instanceof NextResponse) return auth

  let body: MutateBody
  try {
    body = (await request.json()) as MutateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const loaded = await loadCreatorOutreachStoreFromDb(auth.supabase)
    const store = cloneStore(loaded)
    let outreach: EvaluateOutreachResult | undefined

    switch (body.action) {
      case 'scoutProfile': {
        const result = scoutProfile(store, body.input)
        Object.assign(store, result.store)
        outreach = result.outreach
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
      case 'updateProfile':
        updateProfile(store, body.profileId, body.patch)
        break
      case 'addContact': {
        const result = addCreatorContact(store, body.input)
        Object.assign(store, result.store)
        outreach = result.outreach
        break
      }
      case 'updateContact': {
        const result = updateCreatorContact(store, body.contactId, body.patch)
        Object.assign(store, result.store)
        outreach = result.outreach
        break
      }
      case 'removeContact':
        removeCreatorContact(store, body.contactId)
        break
      case 'replaceStore':
        await persistCreatorOutreachStoreToDb(auth.supabase, body.store)
        return NextResponse.json({ store: body.store })
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    await persistCreatorOutreachStoreToDb(auth.supabase, store)

    return NextResponse.json({ store, outreach })
  } catch (error) {
    console.error('POST /api/creator-pipeline/mutate:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mutation failed' },
      { status: 500 }
    )
  }
}
