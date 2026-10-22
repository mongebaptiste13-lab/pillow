/**
 * Types de la base Supabase de Pillow.
 * À régénérer avec `supabase gen types typescript` si le schéma change
 * (la source de vérité du schéma est supabase-setup.sql).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type NotificationType = "snooze" | "follow_up" | "restart" | "stock" | "reminder" | "nag"

export type ProfileRow = {
  id: string
  name: string | null
  pill_name: string | null
  pill_time: string | null
  boxes_remaining: number | null
  days_remaining: number | null
  stock_alert_days: number | null
  timezone: string
  pack_start_date: string | null
  notif_reminder: boolean
  notif_nag: boolean
  notif_stock: boolean
  notif_restart: boolean
  created_at: string | null
  updated_at: string | null
}

export type PillLogRow = {
  id: string
  user_id: string
  date: string
  taken: boolean
  taken_at: string | null
  created_at: string | null
}

export type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string | null
  updated_at: string | null
}

export type NotificationScheduleRow = {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  scheduled_at: string
  sent_at: string | null
  created_at: string | null
}

export type NotificationStateRow = {
  user_id: string
  /** `${jour local}|${heure de prise}` du dernier rappel envoyé : changer l'heure re-déclenche un rappel */
  reminder_key: string | null
  nag_count: number
  last_sent_at: string | null
  stock_date: string | null
  restart_date: string | null
  updated_at: string | null
}

type Table<Row, Required extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id">
      pill_logs: Table<PillLogRow, "user_id" | "date">
      push_subscriptions: Table<PushSubscriptionRow, "user_id" | "endpoint" | "p256dh" | "auth">
      notification_schedules: Table<NotificationScheduleRow, "user_id" | "type" | "title" | "body" | "scheduled_at">
      notification_state: Table<NotificationStateRow, "user_id">
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
