const ICON = "/pillow-logo.png"

export const TAKEN_MESSAGES = [
  "Pilule validée. Ton ovaire vient de lever les yeux au ciel. 💊",
  "C'est noté. Une petite victoire hormonale de plus.",
  "Bien joué, mission pilule accomplie sans drame today. ✅",
  "Pilule prise. Le chaos est repoussé pour aujourd'hui.",
  "Check ! Ton futur toi te remercie. 🎉",
]

export const REMINDER_MESSAGES = [
  "Petit rappel tout doux : as-tu pris ta pilule ?",
  "Ping pilule : ton coussin pense à toi. 🛏️",
  "Alerte chic et hormonale : c'est l'heure de la pilule.",
  "Rappel amical : la pilule n'aime pas être ghostée.",
  "C'est l'heure ! Ta pilule t'attend sagement. 💊",
]

export const FOLLOW_UP_MESSAGES = [
  "Mini check-in : tu l'as bien prise ou on fait semblant ? 🤔",
  "Contrôle qualité Pillow : la pilule est bien avalée ?",
  "Pillow enquête : prise confirmée pour de vrai ?",
  "Je reviens juste m'assurer que tout est sous contrôle. 🎀",
  "Rapport de mission : pilule ingérée ? Confirme ! 📋",
]

export const SNOOZE_MESSAGES = [
  "Ok, je te relance plus tard. Je note ça dans mon coussin mental.",
  "Très bien, report validé. Je reviens te chercher. ⏰",
  "Pas de souci, je remets ça dans un coin moelleux.",
  "Compris. Je repasse plus tard avec tact et insistance.",
]

export const STOCK_MESSAGES = [
  (n: number) => `Il te reste ${n} jour${n > 1 ? "s" : ""} de pilule. C'est le bon moment pour refaire le stock. 🛒`,
  (n: number) => `Stock pilule : ${n} jour${n > 1 ? "s" : ""} restant${n > 1 ? "s" : ""}. Future toi te remercie d'anticiper.`,
  (n: number) => `Alerte shopping utile : plus que ${n} jour${n > 1 ? "s" : ""} avant la panne de pilule. 📦`,
]

export const RESTART_MESSAGES = [
  "Demain on reprend la pilule. La semaine off touche à sa fin. 🔄",
  "Petit rappel moelleux : reprise de la pilule demain. ✨",
  "Fin de pause imminente : pense à reprendre ta pilule demain 💪",
]

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export const getTakenFeedbackMessage = () => pickRandom(TAKEN_MESSAGES)
export const getReminderNotificationMessage = () => pickRandom(REMINDER_MESSAGES)
export const getFollowUpNotificationMessage = () => pickRandom(FOLLOW_UP_MESSAGES)
export const getSnoozeFeedbackMessage = () => pickRandom(SNOOZE_MESSAGES)
export const getStockNotificationMessage = (n: number) => pickRandom(STOCK_MESSAGES)(n)
export const getRestartNotificationMessage = () => pickRandom(RESTART_MESSAGES)

// Safe check: Notification API is undefined on older iOS Safari
const hasNotification = () =>
  typeof window !== "undefined" && "Notification" in window

export function fireNotification(title: string, body: string) {
  if (!hasNotification()) return
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: ICON })
  }
}

export function scheduleNotification(delayMs: number, title: string, body: string): () => void {
  if (typeof window === "undefined" || delayMs < 0) return () => {}
  const id = window.setTimeout(() => fireNotification(title, body), delayMs)
  return () => window.clearTimeout(id)
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!hasNotification()) return "denied"
  if (Notification.permission !== "default") return Notification.permission
  return Notification.requestPermission()
}

const SCHED_KEY = "pillow:notif_scheduled_date"

export function scheduleDailyNotifications({
  pillTime, pillType, pillLogs, daysRemaining, stockAlertDays, force = false,
}: {
  pillTime: string
  pillType: "21_7" | "28_continu"
  pillLogs: string[]
  daysRemaining: number
  stockAlertDays: number
  force?: boolean
}): () => void {
  if (!hasNotification() || Notification.permission !== "granted") return () => {}
  const today = new Date().toISOString().split("T")[0]
  if (!force && window.localStorage.getItem(SCHED_KEY) === today) return () => {}
  window.localStorage.setItem(SCHED_KEY, today)

  const cleanups: Array<() => void> = []
  const now = new Date()
  const [h, m] = pillTime.split(":").map(Number)

  if (isFinite(h) && isFinite(m)) {
    const pillAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
    const msUntilPill = pillAt.getTime() - now.getTime()
    if (msUntilPill > 0) cleanups.push(scheduleNotification(msUntilPill, "Pillow 💊", getReminderNotificationMessage()))
    const msCheck = msUntilPill + 60 * 60_000
    if (msCheck > 0) cleanups.push(scheduleNotification(msCheck, "Pillow 💊", getFollowUpNotificationMessage()))
  }

  if (daysRemaining <= stockAlertDays && daysRemaining > 0) {
    const nineAm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0)
    const msUntil9 = nineAm.getTime() - now.getTime()
    if (msUntil9 > 0) cleanups.push(scheduleNotification(msUntil9, "Pillow 🛒", getStockNotificationMessage(daysRemaining)))
  }

  if (pillType === "21_7") {
    const sorted = [...pillLogs].sort().reverse()
    const lastPillDate = sorted.find((d) => d <= today)
    if (lastPillDate) {
      const daysSinceLast = Math.round(
        (new Date(today + "T12:00:00").getTime() - new Date(lastPillDate + "T12:00:00").getTime()) / 86_400_000
      )
      if (daysSinceLast === 6) {
        const sixPm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0)
        const msUntil6 = sixPm.getTime() - now.getTime()
        if (msUntil6 > 0) cleanups.push(scheduleNotification(msUntil6, "Pillow 💊", getRestartNotificationMessage()))
      }
    }
  }

  return () => cleanups.forEach((fn) => fn())
}
