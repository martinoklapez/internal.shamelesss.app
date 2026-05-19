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
