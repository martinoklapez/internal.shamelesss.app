export type MissiveEmailField = {
  name?: string | null
  address?: string | null
}

export type MissiveMessage = {
  subject?: string | null
  from_field?: MissiveEmailField | null
  to_fields?: MissiveEmailField[] | null
  cc_fields?: MissiveEmailField[] | null
  delivered_at?: number | null
}

export type MissiveConversation = {
  id: string
  subject?: string | null
  latest_message?: MissiveMessage | null
  link?: string | null
}

export type MissiveClient = {
  on: (event: string, callback: (...args: unknown[]) => void) => void
  fetchConversations: (
    ids: string[],
    fields?: string[]
  ) => Promise<MissiveConversation[]>
  storeGet: (key: string) => Promise<string | null>
  storeSet: (key: string, value: string) => Promise<void>
  storeRemove?: (key: string) => Promise<void>
}

declare global {
  interface Window {
    Missive?: MissiveClient
  }
}
