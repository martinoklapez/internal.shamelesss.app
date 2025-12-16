export type QuizScreen = {
  id: string
  title: string | null
  description: string | null
  options: any | null // JSONB
  order_position: number | null
  created_at: string | null
  event_name: string | null
  should_show: boolean | null
  component_id: string | null
}

export type ConversionScreen = {
  id: string
  title: string
  description: string
  options: any // JSONB, default []
  order_position: number
  created_at: string
  event_name: string
  should_show: boolean | null
  component_id: string | null
}

