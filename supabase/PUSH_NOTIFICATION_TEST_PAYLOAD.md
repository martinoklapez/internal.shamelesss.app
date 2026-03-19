# Admin test pushes → `notification_jobs`

Production rows are normally created by **database triggers**; the Edge Function only **processes** pending jobs. The admin API inserts a row with the **same shape**:

| Column | Type | Purpose |
|--------|------|---------|
| `user_id` | uuid | Push recipient |
| `notification_type` | text | e.g. `friend_request`, `message`, … |
| `title` | text | Notification title (lock screen / header) |
| `body` | text | Notification body copy |
| `data` | jsonb | Deep-link payload (`action`, ids, `senderProfilePictureUrl` as storage path, …) |
| `status` | text | `pending` (default) |

Optional env: `NOTIFICATION_JOBS_TEXT_BODY_COLUMN` (default `body`), `NOTIFICATION_JOBS_DATA_COLUMN` (default `data`), plus schema/table overrides — see `lib/notification-jobs-queue.ts`.

## `data` jsonb shapes (reference)

- **friend_request**: `requestId`, `fromUserId`, `senderId`, `senderName`, `senderProfilePictureUrl`, `action: "view_request"`
- **friend_request_accepted**: `requestId`, `senderId`, `senderName`, `senderProfilePictureUrl`, `action: "view_chat"`
- **message**: `messageId`, `connectionId`, `senderId`, `senderProfilePictureUrl`, `action: "view_chat"`
- **refund_request_status**: `requestId`, `status`, `action: "view_refund"`
- **report_status**: `reportId`, `status`, `action: "view_report"`
- **support_ticket_status**: `ticketId`, `status`, `action: "view_support"`

Admin tests use **random UUIDs** for ids unless you pass `test_connection_id` (messages). Deep links may not resolve to real rows.

## API: `POST /api/notification-templates/send-test`

| Field | Description |
|--------|-------------|
| `user_id` | Recipient |
| `notification_type` | One of the types above |
| `context_user_id` | Other user (sender / accepter) when the type needs it |
| `test_message_preview` | Message body text + `{message_preview}` in templates |
| `test_refund_status` | `approved` \| `rejected` \| `processed` |
| `test_report_status` | `resolved` \| `dismissed` |
| `test_support_status` | `resolved` \| `in_progress` \| `closed` |
| `test_connection_id` | Optional real `connectionId` for message tests |

Title/body text come from **`notification_content_templates`** when present, else defaults matching the samples above; `{sender_name}`, `{recipient_name}`, `{message_preview}` are substituted.
