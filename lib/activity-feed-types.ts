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
