import { createClient } from '@/lib/supabase/server'
import type { NotificationContentTemplate } from '@/lib/notification-content-templates'

export type { NotificationContentTemplate }

export async function getNotificationContentTemplates(): Promise<NotificationContentTemplate[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notification_content_templates')
    .select('notification_type, title_template, body_template, updated_at')
    .order('notification_type', { ascending: true })

  if (error) {
    console.error('Error fetching notification content templates:', error)
    throw error
  }

  return data || []
}
