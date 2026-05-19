/**
 * User IDs excluded from Activity feed counts/lists, connection chat modal/API,
 * and Support Chat threads when either participant matches.
 *
 * Normalized to lowercase UUID strings for comparisons.
 */
export const ACTIVITY_HIDDEN_USER_IDS: ReadonlyArray<string> = [
  'b3652351-f25a-45ed-938f-19904b52feec',
].map((id) => id.trim().toLowerCase())

const HIDDEN_SET = new Set(ACTIVITY_HIDDEN_USER_IDS)

export function hasActivityHiddenUsers(): boolean {
  return ACTIVITY_HIDDEN_USER_IDS.length > 0
}

export function isActivityHiddenUserId(userId: string | null | undefined): boolean {
  if (!userId) return false
  return HIDDEN_SET.has(String(userId).trim().toLowerCase())
}

/** Either participant on the connection is a hidden activity user. */
export function activityConnectionTouchesHiddenUser(
  user_id_1: string | null | undefined,
  user_id_2: string | null | undefined
): boolean {
  return isActivityHiddenUserId(user_id_1) || isActivityHiddenUserId(user_id_2)
}
