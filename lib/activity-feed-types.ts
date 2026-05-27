export type ActivityProfileMini = {
  user_id: string
  name: string | null
  username: string | null
  profile_picture_url: string | null
}

export type ActivityConnectionRow = {
  id: string
  user_id_1: string | null
  user_id_2: string | null
  status: string | null
  created_at: string | null
  user_1: ActivityProfileMini | null
  user_2: ActivityProfileMini | null
  /** `friend_requests.source` for this pair when we can resolve it (usually accepted → connection). */
  friend_request_source: string | null
}

export type ActivityConnectionChatMessageRow = {
  id: string
  connection_id: string | null
  sender_id: string | null
  content: string | null
  image_url: string | null
  storage_path: string | null
  storage_bucket: string | null
  /** Service-role signed URL for private bucket images (~1h). Refetch by reopening chat. */
  signed_image_url: string | null
  created_at: string | null
  is_read: boolean | null
  sender: ActivityProfileMini | null
}

export type ActivityConnectionChatPayload = {
  connection: {
    id: string
    user_id_1: string | null
    user_id_2: string | null
    status: string | null
    created_at: string | null
    user_1: ActivityProfileMini | null
    user_2: ActivityProfileMini | null
  }
  messages: ActivityConnectionChatMessageRow[]
}

export type ActivityFriendRequestRow = {
  id: string
  from_user_id: string
  to_user_id: string
  status: string
  message: string | null
  created_at: string | null
  updated_at: string | null
  source: string | null
  from_user: ActivityProfileMini | null
  to_user: ActivityProfileMini | null
}

export type ActivityMessageRow = {
  id: string
  connection_id: string | null
  /** Matches `connections.user_id_1` / `user_id_2` when `connection_id` is present (chat bubble alignment). */
  connection_user_id_1: string | null
  connection_user_id_2: string | null
  sender_id: string | null
  content_preview: string | null
  has_image: boolean
  /** Legacy / public image URL when present. */
  image_url: string | null
  /** Service-role signed URL for private bucket images (~1h). */
  signed_image_url: string | null
  created_at: string | null
  sender: ActivityProfileMini | null
  other_user: ActivityProfileMini | null
}

export type ActivityProfileViewRow = {
  id: string
  viewer_id: string
  viewed_user_id: string
  viewed_at: string
  viewer: ActivityProfileMini | null
  viewed_user: ActivityProfileMini | null
}

/** Latest rows from `explicit_photos` (Upload screen); images signed from `explicit-photos` bucket. */
export type ActivityUploadRow = {
  id: string
  user_id: string
  storage_path: string
  file_size: number | null
  content_type: string | null
  is_revealed: boolean | null
  revealed_at: string | null
  created_at: string | null
  user: ActivityProfileMini | null
  signed_image_url: string | null
}

/** Rows from `position_diary`. Image priority in UI: legacy column → gallery (`diary_memory_images`) → catalog (`positions.image_url`). */
export type ActivityPositionDiaryRow = {
  id: string
  user_id: string
  position_id: string
  rating: number | null
  feeling_for_her: string | null
  feeling_for_him: string | null
  notes: string | null
  worth_repeat: boolean | null
  memory_image_path: string | null
  created_at: string | null
  updated_at: string | null
  user: ActivityProfileMini | null
  /** Deprecated column `position_diary.memory_image_path` when signed. */
  signed_memory_image_url: string | null
  /** Latest row in `diary_memory_images` for this entry (same signing as Memory photos table). */
  entry_memory_preview_url: string | null
  /** Catalog art from `positions` / `date_roulette_positions` (`image_url`). */
  position_image_url: string | null
}

/** Rows from `diary_memory_images`; `memory_image_path` is object key in private `memories` bucket (service-role signed URL in Activity API). */
export type ActivityDiaryMemoryImageRow = {
  id: string
  diary_entry_id: string
  user_id: string
  memory_image_path: string
  created_at: string | null
  is_visible: boolean
  position_id: string | null
  user: ActivityProfileMini | null
  signed_image_url: string | null
}
