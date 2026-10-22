import { createAdminClient } from "@/lib/supabase-admin"
import {
  DEFAULT_TIMEZONE,
  addDaysToKey,
  isValidTimezone,
  timeToMinutes,
  zonedParts,
} from "@/lib/date"
import { getPackStatus } from "@/lib/pack"
import { findPill } from "@/lib/pill-data"
import { STOCK_URGENT_DAYS, getPrescriptionInfo, getStockInfo } from "@/lib/supply"
import {
  getNagNotificationMessage,
  getPrescriptionNotificationMessage,
  getReminderNotificationMessage,
  getRestartNotificationMessage,
  getStockNotificationMessage,
} from "@/lib/notifications"
import { sendPushNotification, type PushKind, type PushPayload, type PushResult, type PushSubscriptionRecord } from "@/lib/web-push-server"
import type { Database, NotificationStateRow, ProfileRow } from "@/lib/database.types"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Cerveau des notifications. Appelé chaque minute par un cron (voir README) :
 *
 *  1. rappel à l'heure de prise (si la pilule n'est pas encore prise, hors jour de pause)
 *  2. relances toutes les 30 min (3 max) tant que la pilule n'est pas prise
 *  3. rappels ponctuels programmés (« plus tard »)
 *  4. alerte de stock à 9h : une fois en passant sous le seuil, puis chaque jour dès 3 jours restants
 *  5. rappel de reprise de plaquette la veille à 18h (pilules 21/7)
 *  6. fin d'ordonnance à 10h : une alerte par palier (30, 14, 7, 3 jours, dernier jour, expirée)
 *
 * Chaque envoi est « réservé » dans la base AVANT l'envoi (mise à jour conditionnelle) :
 * deux exécutions simultanées ne peuvent donc pas envoyer deux fois la même notification.
 */

const NAG_INTERVAL_MIN = 30
const MAX_NAGS = 3
const REMINDER_WINDOW_MIN = 6 * 60
const STOCK_ALERT_MINUTE = 9 * 60
const RESTART_ALERT_MINUTE = 18 * 60
const PRESCRIPTION_ALERT_MINUTE = 10 * 60
const STALE_SCHEDULE_MS = 3 * 60 * 60_000

export interface DispatchSummary {
  users: number
  sent: number
  reminders: number
  nags: number
  snoozes: number
  stock: number
  restart: number
  prescription: number
  removedSubscriptions: number
  errors: string[]
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Dépendances injectables (tests) : par défaut, la vraie base et le vrai envoi Web Push. */
export interface DispatchDeps {
  admin?: SupabaseClient<Database>
  send?: (sub: PushSubscriptionRecord, payload: PushPayload) => Promise<PushResult>
}

export async function runDispatch(now: Date = new Date(), deps: DispatchDeps = {}): Promise<DispatchSummary> {
  const admin = deps.admin ?? createAdminClient()
  const send = deps.send ?? sendPushNotification
  const summary: DispatchSummary = {
    users: 0, sent: 0, reminders: 0, nags: 0, snoozes: 0, stock: 0, restart: 0, prescription: 0, removedSubscriptions: 0, errors: [],
  }
  const nowIso = now.toISOString()

  /* ---- 1. Abonnements push (sans abonnement, personne à notifier) ---- */
  const { data: subRows, error: subErr } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
  if (subErr) {
    summary.errors.push(`subscriptions: ${subErr.message}`)
    return summary
  }

  const subsByUser = new Map<string, PushSubscriptionRecord[]>()
  for (const row of subRows ?? []) {
    const list = subsByUser.get(row.user_id) ?? []
    list.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth })
    subsByUser.set(row.user_id, list)
  }
  const userIds = [...subsByUser.keys()]
  summary.users = userIds.length

  /* ---- 2. Rappels ponctuels dus (traités même si plus aucun abonnement : on les purge) ---- */
  const { data: dueSchedules, error: schedErr } = await admin
    .from("notification_schedules")
    .select("*")
    .is("sent_at", null)
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(500)
  if (schedErr) summary.errors.push(`schedules: ${schedErr.message}`)

  if (userIds.length === 0 && !(dueSchedules?.length)) return summary

  const allUserIds = [...new Set([...userIds, ...(dueSchedules ?? []).map((s) => s.user_id)])]

  /* ---- 3. Données par utilisatrice ---- */
  const profiles = new Map<string, ProfileRow>()
  const taken = new Map<string, Set<string>>()
  const states = new Map<string, NotificationStateRow>()

  const todayUtc = nowIso.slice(0, 10)
  const from = addDaysToKey(todayUtc, -1)
  const to = addDaysToKey(todayUtc, 1)

  for (const ids of chunk(allUserIds, 100)) {
    const [p, l, s] = await Promise.all([
      admin.from("profiles").select("*").in("id", ids),
      admin.from("pill_logs").select("user_id, date").in("user_id", ids).eq("taken", true).gte("date", from).lte("date", to),
      admin.from("notification_state").select("*").in("user_id", ids),
    ])
    if (p.error) summary.errors.push(`profiles: ${p.error.message}`)
    if (l.error) summary.errors.push(`pill_logs: ${l.error.message}`)
    if (s.error) summary.errors.push(`state: ${s.error.message}`)
    for (const row of p.data ?? []) profiles.set(row.id, row)
    for (const row of l.data ?? []) {
      const set = taken.get(row.user_id) ?? new Set<string>()
      set.add(row.date)
      taken.set(row.user_id, set)
    }
    for (const row of s.data ?? []) states.set(row.user_id, row)
  }

  // Crée les lignes d'état manquantes (ignore les doublons → sûr en cas d'exécutions simultanées)
  const missingState = userIds.filter((id) => !states.has(id))
  if (missingState.length > 0) {
    const { error } = await admin
      .from("notification_state")
      .upsert(missingState.map((user_id) => ({ user_id })), { onConflict: "user_id", ignoreDuplicates: true })
    if (error) summary.errors.push(`state init: ${error.message}`)
    for (const user_id of missingState) {
      states.set(user_id, { user_id, reminder_key: null, nag_count: 0, last_sent_at: null, stock_date: null, restart_date: null, stock_key: null, rx_key: null, updated_at: null })
    }
  }

  /* ---- Envoi vers tous les appareils d'une utilisatrice ---- */
  async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
    const subs = subsByUser.get(userId) ?? []
    let ok = 0
    await Promise.all(
      subs.map(async (sub) => {
        const result = await send(sub, payload)
        if (result.ok) {
          ok++
        } else if (result.gone) {
          const { error } = await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
          if (!error) summary.removedSubscriptions++
        } else {
          summary.errors.push(`push ${userId.slice(0, 8)}: ${result.error}`)
        }
      }),
    )
    summary.sent += ok
    return ok
  }

  const payload = (kind: PushKind, body: string, tag: string, title = "Pillow 💊"): PushPayload => ({
    title, body, tag, kind, url: "/",
  })

  /* ---- 4. Rappels programmés ---- */
  for (const sched of dueSchedules ?? []) {
    // Réservation : une seule exécution peut gagner cette ligne
    const { data: claimed } = await admin
      .from("notification_schedules")
      .update({ sent_at: nowIso })
      .eq("id", sched.id)
      .is("sent_at", null)
      .select("id")
    if (!claimed || claimed.length === 0) continue

    const stale = now.getTime() - new Date(sched.scheduled_at).getTime() > STALE_SCHEDULE_MS
    if (stale) continue

    const profile = profiles.get(sched.user_id)
    const tz = isValidTimezone(profile?.timezone) ? profile!.timezone : DEFAULT_TIMEZONE
    const { dateKey } = zonedParts(now, tz)
    // « Plus tard » devient sans objet si la pilule a été prise entre-temps
    if (sched.type === "snooze" && taken.get(sched.user_id)?.has(dateKey)) continue

    const kind: PushKind = sched.type === "snooze" ? "snooze" : sched.type === "stock" ? "stock" : sched.type === "restart" ? "restart" : "info"
    const ok = await sendToUser(sched.user_id, payload(kind, sched.body, `pillow-${sched.type}`, sched.title))
    if (ok > 0) summary.snoozes++
  }

  /* ---- 5. Rappels quotidiens ---- */
  for (const userId of userIds) {
    const profile = profiles.get(userId)
    const state = states.get(userId)
    if (!profile || !state) continue

    const pillMin = timeToMinutes(profile.pill_time)
    if (pillMin === null || !profile.name) continue // onboarding non terminé

    const tz = isValidTimezone(profile.timezone) ? profile.timezone : DEFAULT_TIMEZONE
    const { dateKey, minutes } = zonedParts(now, tz)
    const pillType = findPill(profile.pill_name)?.pillType ?? "21_7"
    const pack = getPackStatus(pillType, profile.pack_start_date, dateKey)
    const takenToday = taken.get(userId)?.has(dateKey) ?? false
    // Clé du rappel du jour : si l'heure de prise change, un nouveau rappel peut partir
    const reminderKey = `${dateKey}|${profile.pill_time}`

    /* Rappel principal */
    if (
      profile.notif_reminder &&
      pack.phase === "active" &&
      !takenToday &&
      minutes >= pillMin &&
      minutes < pillMin + REMINDER_WINDOW_MIN &&
      state.reminder_key !== reminderKey
    ) {
      const { data: claimed } = await admin
        .from("notification_state")
        .update({ reminder_key: reminderKey, nag_count: 0, last_sent_at: nowIso, updated_at: nowIso })
        .eq("user_id", userId)
        .or(`reminder_key.is.null,reminder_key.neq.${reminderKey}`)
        .select("user_id")
      if (claimed && claimed.length > 0) {
        state.reminder_key = reminderKey
        state.nag_count = 0
        state.last_sent_at = nowIso
        if ((await sendToUser(userId, payload("reminder", getReminderNotificationMessage(), "pillow-reminder"))) > 0) summary.reminders++
      }
    }
    /* Relances */
    else if (
      profile.notif_reminder &&
      profile.notif_nag &&
      pack.phase === "active" &&
      !takenToday &&
      state.reminder_key === reminderKey &&
      state.nag_count < MAX_NAGS &&
      state.last_sent_at &&
      now.getTime() - new Date(state.last_sent_at).getTime() >= NAG_INTERVAL_MIN * 60_000 - 20_000
    ) {
      const { data: claimed } = await admin
        .from("notification_state")
        .update({ nag_count: state.nag_count + 1, last_sent_at: nowIso, updated_at: nowIso })
        .eq("user_id", userId)
        .eq("nag_count", state.nag_count)
        .select("user_id")
      if (claimed && claimed.length > 0) {
        state.nag_count += 1
        state.last_sent_at = nowIso
        if ((await sendToUser(userId, payload("nag", getNagNotificationMessage(), "pillow-reminder"))) > 0) summary.nags++
      }
    }

    /* Alerte de stock : une fois en passant sous le seuil, puis chaque jour quand il ne reste que quelques jours */
    const daysLeft = profile.days_remaining ?? 0
    const threshold = profile.stock_alert_days ?? 7
    if (profile.notif_stock && daysLeft > threshold && state.stock_key) {
      // Stock reconstitué : le prochain passage sous le seuil prévient de nouveau
      await admin.from("notification_state").update({ stock_key: null, updated_at: nowIso }).eq("user_id", userId)
      state.stock_key = null
    }
    if (profile.notif_stock && daysLeft <= threshold && minutes >= STOCK_ALERT_MINUTE) {
      const stockKey = daysLeft <= STOCK_URGENT_DAYS ? `d|${dateKey}` : `t|${threshold}`
      if (state.stock_key !== stockKey) {
        const { data: claimed } = await admin
          .from("notification_state")
          .update({ stock_key: stockKey, updated_at: nowIso })
          .eq("user_id", userId)
          .or(`stock_key.is.null,stock_key.neq.${stockKey}`)
          .select("user_id")
        if (claimed && claimed.length > 0) {
          state.stock_key = stockKey
          const stock = getStockInfo({
            pillType, packStartDate: profile.pack_start_date, perBox: findPill(profile.pill_name)?.daysPerBox ?? 21,
            daysLeft, todayKey: dateKey, takenToday,
          })
          const body = getStockNotificationMessage(daysLeft, stock.lastPillDate)
          if ((await sendToUser(userId, payload("stock", body, "pillow-stock", "Pillow 🛒"))) > 0) summary.stock++
        }
      }
    }

    /* Fin d'ordonnance : une alerte par palier */
    if (profile.notif_prescription && profile.prescription_end_date && minutes >= PRESCRIPTION_ALERT_MINUTE) {
      const rx = getPrescriptionInfo(profile.prescription_end_date, dateKey)
      if (rx.bucket !== null && rx.daysLeft !== null) {
        const rxKey = `${profile.prescription_end_date}|${rx.bucket}`
        if (state.rx_key !== rxKey) {
          const { data: claimed } = await admin
            .from("notification_state")
            .update({ rx_key: rxKey, updated_at: nowIso })
            .eq("user_id", userId)
            .or(`rx_key.is.null,rx_key.neq.${rxKey}`)
            .select("user_id")
          if (claimed && claimed.length > 0) {
            state.rx_key = rxKey
            const body = getPrescriptionNotificationMessage(rx.daysLeft, profile.prescription_end_date)
            if ((await sendToUser(userId, payload("prescription", body, "pillow-prescription", "Pillow 📋"))) > 0) summary.prescription++
          }
        }
      }
    }

    /* Reprise de plaquette demain (21/7) */
    if (
      profile.notif_restart &&
      pack.restartsTomorrow &&
      minutes >= RESTART_ALERT_MINUTE &&
      state.restart_date !== dateKey
    ) {
      const { data: claimed } = await admin
        .from("notification_state")
        .update({ restart_date: dateKey, updated_at: nowIso })
        .eq("user_id", userId)
        .or(`restart_date.is.null,restart_date.neq.${dateKey}`)
        .select("user_id")
      if (claimed && claimed.length > 0) {
        state.restart_date = dateKey
        if ((await sendToUser(userId, payload("restart", getRestartNotificationMessage(), "pillow-restart"))) > 0) summary.restart++
      }
    }
  }

  return summary
}
