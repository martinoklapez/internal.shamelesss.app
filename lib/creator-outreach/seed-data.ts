import { deriveCreatorCrmStatusFromContacts } from './crm-status'
import type {
  ActivityEvent,
  CreatorContact,
  CreatorContactKind,
  CreatorOutreachStore,
  CreatorPerson,
  EmailTemplate,
  EmailTouchpoint,
  OutreachPlatform,
  OutreachSend,
  ContactCrmStatus,
  SocialMediaProfile,
} from './types'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const CREATOR_COUNT = 248
const UNLINKED_PROFILE_COUNT = 112
const ACTIVITY_LIMIT = 200

const FIRST_NAMES = [
  'Maya', 'Jordan', 'Luna', 'Alex', 'Sam', 'Riley', 'Casey', 'Taylor', 'Morgan', 'Quinn',
  'Avery', 'Blake', 'Cameron', 'Dakota', 'Emery', 'Finley', 'Harper', 'Indie', 'Jules', 'Kai',
  'Logan', 'Noah', 'Parker', 'Reese', 'Sage', 'Skyler', 'Tatum', 'Wren', 'Zoe', 'Nina',
  'Elena', 'Marco', 'Sofia', 'Diego', 'Priya', 'Amir', 'Yuki', 'Hana', 'Omar', 'Leila',
]

const LAST_NAMES = [
  'Chen', 'Blake', 'Rivera', 'Kim', 'Patel', 'Nguyen', 'Brooks', 'Hayes', 'Cole', 'Reed',
  'Shaw', 'Lane', 'West', 'Fox', 'Stone', 'Marsh', 'Vale', 'Cross', 'Hart', 'Wells',
  'Soto', 'Diaz', 'Morris', 'Grant', 'Banks', 'Sharp', 'Knight', 'Day', 'Ray', 'Snow',
]

const SCOUTERS = ['Alex', 'Sam', 'Riley', 'Jordan', 'Casey', 'Morgan', 'Taylor']
const CRM_STATUSES: ContactCrmStatus[] = ['new', 'contacted', 'reached', 'blocked']
const CRM_STATUS_WEIGHTS = [0.35, 0.4, 0.18, 0.07]

const AGENCY_NAMES = [
  'Talent Box Media',
  'Northwind Collective',
  'Pulse Creator Co',
  'Bridge Management',
  'Spotlight Partners',
]

const MANAGER_FIRST = ['Chris', 'Jamie', 'Taylor', 'Robin', 'Ash', 'Devon', 'Quinn']

const NOTE_SNIPPETS = [
  'Strong US audience.',
  'Dating + lifestyle niche.',
  'High engagement, smaller following.',
  'Agency email in bio.',
  'Worth a follow-up after series posts.',
  'Requested rates via DM.',
  'Previously worked with competitor apps.',
  '',
  '',
]

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rand: () => number, items: T[]): T {
  return items[Math.floor(rand() * items.length)]
}

function pickCrmStatus(rand: () => number): ContactCrmStatus {
  const r = rand()
  let acc = 0
  for (let i = 0; i < CRM_STATUSES.length; i++) {
    acc += CRM_STATUS_WEIGHTS[i]
    if (r < acc) return CRM_STATUSES[i]
  }
  return 'contacted'
}

function missiveIdsForContact(rand: () => number, status: ContactCrmStatus): string[] {
  if (status !== 'contacted' && status !== 'reached') return []
  if (rand() > 0.42) return []
  const count = rand() < 0.85 ? 1 : 2
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    ids.push(`conv_${Math.floor(rand() * 1e9).toString(36)}`)
  }
  return ids
}

function daysAgoIso(rand: () => number, maxDays: number): string {
  const days = Math.floor(rand() * maxDays)
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(Math.floor(rand() * 24), Math.floor(rand() * 60), 0, 0)
  return d.toISOString()
}

function profileUrl(platform: OutreachPlatform, handle: string): string {
  return platform === 'tiktok'
    ? `https://www.tiktok.com/@${handle}`
    : `https://www.instagram.com/${handle}`
}

function buildTemplates(): EmailTemplate[] {
  return [
    {
      id: 'tpl-partnership',
      name: 'Partnership intro',
      subject: 'Collaboration idea for {{creator_name}}',
      bodyPreview:
        'Hi {{creator_name}}, we love your content on {{platform}} (@{{handle}}). We built Shamelesss and think your audience would resonate…',
      isDefault: true,
    },
    {
      id: 'tpl-followup',
      name: 'Follow-up (7 days)',
      subject: 'Quick follow-up — Shamelesss x {{creator_name}}',
      bodyPreview:
        'Hi again — wanted to bump this in case it got buried. Happy to share more details on the collab…',
      isDefault: false,
    },
  ]
}

/** Large realistic mock dataset for UI scale testing. */
export function buildLargeSeedStore(): CreatorOutreachStore {
  const rand = mulberry32(42)
  const templates = buildTemplates()
  const defaultTpl = templates.find((t) => t.isDefault) ?? templates[0]
  const baseTime = nowIso()

  const creators: CreatorPerson[] = []
  const profiles: SocialMediaProfile[] = []
  const contacts: CreatorContact[] = []

  // Anchor rows (stable IDs for demos)
  const creatorA: CreatorPerson = {
    id: 'creator-seed-1',
    displayName: 'Maya Chen',
    notes: 'Lifestyle + dating content. Strong US audience.',
    avatarProfileId: null,
    status: 'new',
    createdAt: baseTime,
    updatedAt: baseTime,
  }
  const creatorB: CreatorPerson = {
    id: 'creator-seed-2',
    displayName: 'Jordan Blake',
    notes: 'Agency representation — booking via Agency Box contact.',
    avatarProfileId: null,
    status: 'new',
    createdAt: baseTime,
    updatedAt: baseTime,
  }
  creators.push(creatorA, creatorB)

  profiles.push(
    {
      id: 'profile-seed-1',
      platform: 'tiktok',
      handle: 'mayachen',
      displayName: 'Maya Chen',
      profileUrl: profileUrl('tiktok', 'mayachen'),
      avatarUrl: null,
      followerCount: 284000,
      creatorId: creatorA.id,
      notes: 'Primary TikTok',
      scoutedAt: baseTime,
      scoutedBy: 'Alex',
    },
    {
      id: 'profile-seed-2',
      platform: 'instagram',
      handle: 'maya.chen.life',
      displayName: 'Maya Chen',
      profileUrl: profileUrl('instagram', 'maya.chen.life'),
      avatarUrl: null,
      followerCount: 92000,
      creatorId: creatorA.id,
      notes: 'IG secondary account',
      scoutedAt: baseTime,
      scoutedBy: 'Alex',
    },
    {
      id: 'profile-seed-3',
      platform: 'tiktok',
      handle: 'jordanblake',
      displayName: 'Jordan Blake',
      profileUrl: profileUrl('tiktok', 'jordanblake'),
      avatarUrl: null,
      followerCount: 510000,
      creatorId: creatorB.id,
      notes: '',
      scoutedAt: baseTime,
      scoutedBy: 'Sam',
    },
    {
      id: 'profile-seed-4',
      platform: 'instagram',
      handle: 'jordan.blake.official',
      displayName: 'Jordan Blake',
      profileUrl: profileUrl('instagram', 'jordan.blake.official'),
      avatarUrl: null,
      followerCount: 180000,
      creatorId: creatorB.id,
      notes: 'Instagram',
      scoutedAt: baseTime,
      scoutedBy: 'Sam',
    }
  )

  contacts.push(
    {
      id: 'contact-seed-1',
      creatorId: creatorA.id,
      kind: 'manager',
      name: 'Priya Nair',
      company: '',
      email: 'priya.nair@creatormail.com',
      phone: '',
      notes: 'Day-to-day manager',
      status: 'contacted',
      missiveConversationIds: ['conv_demo_maya_manager'],
      createdAt: baseTime,
    },
    {
      id: 'contact-seed-2',
      creatorId: creatorB.id,
      kind: 'agency',
      name: 'Agency Box',
      company: 'Agency Box',
      email: 'bookings@agencybox.io',
      phone: '',
      notes: 'Primary booking inbox',
      status: 'reached',
      missiveConversationIds: ['conv_demo_agency_jordan'],
      createdAt: baseTime,
    }
  )

  for (let i = 0; i < CREATOR_COUNT; i++) {
    const id = `creator-gen-${i}`
    const first = pick(rand, FIRST_NAMES)
    const last = pick(rand, LAST_NAMES)
    const scoutedAt = daysAgoIso(rand, 120)
    creators.push({
      id,
      displayName: `${first} ${last}`,
      notes: pick(rand, NOTE_SNIPPETS),
      avatarProfileId: null,
      status: 'new',
      createdAt: scoutedAt,
      updatedAt: scoutedAt,
    })

    const profileCount = 1 + Math.floor(rand() * 3)

    for (let p = 0; p < profileCount; p++) {
      const platform: OutreachPlatform = rand() < 0.52 ? 'tiktok' : 'instagram'
      const slug = `${first}${last}${i}`
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
      const handle =
        platform === 'tiktok'
          ? `${slug}${p > 0 ? p : ''}`
          : `${slug.replace(/([a-z])([A-Z])/g, '$1.$2')}${p > 0 ? `.${p}` : ''}`

      profiles.push({
        id: `profile-gen-${i}-${p}`,
        platform,
        handle,
        displayName: `${first} ${last}`,
        profileUrl: profileUrl(platform, handle),
        avatarUrl: null,
        followerCount:
          rand() < 0.08 ? null : Math.floor(8_000 + rand() * 2_400_000),
        creatorId: id,
        notes: rand() < 0.25 ? pick(rand, NOTE_SNIPPETS) : '',
        scoutedAt: daysAgoIso(rand, 90),
        scoutedBy: pick(rand, SCOUTERS),
      })
    }

    if (rand() < 0.38) {
      const agency = pick(rand, AGENCY_NAMES)
      const manager = pick(rand, MANAGER_FIRST)
      const displayName = `${first} ${last}`
      const roll = rand()
      const kind: CreatorContactKind =
        roll < 0.2
          ? 'creator'
          : roll < 0.5
            ? 'agency'
            : roll < 0.8
              ? 'manager'
              : 'other'
      const name =
        kind === 'creator'
          ? displayName
          : kind === 'agency'
            ? agency
            : kind === 'manager'
              ? `${manager} ${last}`
              : `${manager} (Rep)`
      const email =
        kind === 'creator'
          ? `${first.toLowerCase()}.${last.toLowerCase()}@gmail.com`
          : kind === 'agency'
            ? `bookings@${agency.toLowerCase().replace(/[^a-z0-9]+/g, '')}.demo`
            : `${manager.toLowerCase()}.${last.toLowerCase()}@mgmt.demo`
      const contactStatus = pickCrmStatus(rand)
      contacts.push({
        id: `contact-gen-${i}`,
        creatorId: id,
        kind,
        name,
        company: kind === 'agency' ? agency : '',
        email: rand() < 0.82 ? normalizeEmail(email) : '',
        phone: '',
        notes: rand() < 0.2 ? 'Found in link-in-bio' : '',
        status: contactStatus,
        missiveConversationIds: missiveIdsForContact(rand, contactStatus),
        createdAt: scoutedAt,
      })
      if (rand() < 0.18) {
        const secondStatus = pickCrmStatus(rand)
        contacts.push({
          id: `contact-gen-${i}-b`,
          creatorId: id,
          kind: 'manager',
          name: `${pick(rand, MANAGER_FIRST)} ${last}`,
          company: '',
          email:
            rand() < 0.6
              ? normalizeEmail(`${last.toLowerCase()}.mgmt${i}@demo.io`)
              : '',
          phone: '',
          notes: '',
          status: secondStatus,
          missiveConversationIds: missiveIdsForContact(rand, secondStatus),
          createdAt: scoutedAt,
        })
      }
    }
  }

  for (let u = 0; u < UNLINKED_PROFILE_COUNT; u++) {
    const platform: OutreachPlatform = rand() < 0.5 ? 'tiktok' : 'instagram'
    const handle = `scout${u}${pick(rand, ['', '_', '.'])}${pick(rand, FIRST_NAMES).toLowerCase()}`
    profiles.push({
      id: `profile-unlinked-${u}`,
      platform,
      handle,
      displayName: pick(rand, FIRST_NAMES),
      profileUrl: profileUrl(platform, handle),
      avatarUrl: null,
      followerCount: Math.floor(5_000 + rand() * 800_000),
      creatorId: null,
      notes: rand() < 0.4 ? 'Unlinked — verify identity' : '',
      scoutedAt: daysAgoIso(rand, 60),
      scoutedBy: pick(rand, SCOUTERS),
    })
  }

  profiles.push({
    id: 'profile-seed-5',
    platform: 'tiktok',
    handle: 'fitwithluna',
    displayName: 'Luna Fit',
    profileUrl: profileUrl('tiktok', 'fitwithluna'),
    avatarUrl: null,
    followerCount: 67000,
    creatorId: null,
    notes: 'Unlinked scout — verify if same person as another entry',
    scoutedAt: daysAgoIso(rand, 14),
    scoutedBy: 'Alex',
  })

  const emailTouchpoints: EmailTouchpoint[] = []
  const outreachSends: OutreachSend[] = []
  const sentEmails = new Set<string>()

  for (const contact of contacts) {
    if (!contact.email) continue
    const email = normalizeEmail(contact.email)
    emailTouchpoints.push({
      id: `touch-${contact.id}`,
      email,
      profileId: null,
      contactId: contact.id,
      creatorId: contact.creatorId,
      addedAt: contact.createdAt,
    })
  }

  for (const contact of contacts) {
    if (!contact.email) continue
    const email = normalizeEmail(contact.email)
    if (sentEmails.has(email)) continue
    if (rand() < 0.45) {
      sentEmails.add(email)
      outreachSends.push({
        id: `send-contact-${contact.id}`,
        email,
        templateId: defaultTpl.id,
        templateName: defaultTpl.name,
        fromAddress: 'creators@shamelesss.app',
        fromDisplayName: 'Shamelesss',
        profileId: null,
        contactId: contact.id,
        creatorId: contact.creatorId,
        status: 'sent',
        sentAt: contact.createdAt,
      })
    }
  }

  outreachSends.sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  )

  const activity: ActivityEvent[] = []
  const addActivity = (
    type: ActivityEvent['type'],
    message: string,
    createdAt: string
  ) => {
    if (activity.length >= ACTIVITY_LIMIT) return
    activity.push({
      id: `act-${activity.length}`,
      type,
      message,
      createdAt,
    })
  }

  for (const profile of profiles.slice(0, 80)) {
    addActivity(
      'profile_scouted',
      `Scouted @${profile.handle} on ${profile.platform === 'tiktok' ? 'TikTok' : 'Instagram'}${profile.creatorId ? '' : ' (unlinked)'}`,
      profile.scoutedAt
    )
  }
  for (const send of outreachSends.slice(0, 60)) {
    if (send.status === 'sent') {
      addActivity(
        'outreach_sent',
        `Sent "${send.templateName}" to ${send.email}`,
        send.sentAt
      )
    }
  }
  for (let i = 0; i < 40; i++) {
    const c = pick(rand, creators)
    addActivity('creator_created', `Created creator "${c.displayName}"`, c.createdAt)
  }

  activity.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const seedStore = { creators, profiles, contacts }
  for (const creator of creators) {
    creator.status = deriveCreatorCrmStatusFromContacts(seedStore, creator.id)
  }

  return {
    creators,
    profiles,
    contacts,
    emailTouchpoints,
    templates,
    sendFromAddresses: [
      {
        id: 'sender-seed-1',
        address: 'creators@shamelesss.app',
        displayName: 'Shamelesss',
        enabled: true,
        isDefault: true,
      },
    ],
    outreachRules: [],
    outreachSends,
    activity,
  }
}

function nowIso(): string {
  return new Date().toISOString()
}
