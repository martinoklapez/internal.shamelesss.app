const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** UUID of the in-app account whose messages appear as “support” in chats (server-only env). */
export function getSupportChatUserId(): string | null {
  const raw = process.env.SUPPORT_CHAT_USER_ID?.trim()
  if (!raw || !UUID_RE.test(raw)) return null
  return raw.toLowerCase()
}

export function isSupportChatConfigured(): boolean {
  return getSupportChatUserId() !== null
}
