import { formatLongDate, timeToMinutes } from "@/lib/date"

/**
 * Messages + helpers de notifications.
 * Ce fichier est importé côté client ET côté serveur (dispatcher) :
 * toute utilisation de window/navigator reste donc dans des fonctions gardées.
 */

export const ICON = "/icons/icon-192.png"
export const BADGE = "/icons/badge-96.png"

export const TAKEN_MESSAGES = [
  "Pilule validée. Ton ovaire vient de lever les yeux au ciel. 💊",
  "C'est noté. Une petite victoire hormonale de plus.",
  "Bien joué, mission pilule accomplie sans drame. ✅",
  "Pilule prise. Le chaos est repoussé pour aujourd'hui.",
  "Check ! Ton futur toi te remercie. 🎉",
]

export const REMINDER_MESSAGES = [
  "Petit rappel tout doux : c'est l'heure de ta pilule.",
  "Ping pilule : ton coussin pense à toi. 🛏️",
  "Alerte chic et hormonale : c'est l'heure de la pilule.",
  "Rappel amical : la pilule n'aime pas être ghostée.",
  "C'est l'heure ! Ta pilule t'attend sagement. 💊",
]

export const NAG_MESSAGES = [
  "Toujours pas de pilule enregistrée aujourd'hui. On la prend maintenant ? 💊",
  "Je reviens à la charge, avec tendresse : ta pilule t'attend.",
  "Plus tu la prends tôt, mieux c'est. Elle est où, cette pilule ? 🔔",
  "Petit rappel insistant mais bienveillant : pilule du jour à valider.",
]

export const SNOOZE_REMINDER_MESSAGES = [
  "On m'avait demandé de te relancer : c'est l'heure de ta pilule. ⏰",
  "Je reviens comme promis. Ta pilule, maintenant ? 💊",
  "Le délai est écoulé : pilule du jour, c'est le moment.",
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

export const STOCK_EMPTY_MESSAGES = [
  "Ton stock de pilules est épuisé. Pense à passer à la pharmacie aujourd'hui. 🏥",
  "Plus de pilules en stock ! Un tour à la pharmacie s'impose. 📦",
]

export const RESTART_MESSAGES = [
  "Demain on reprend la pilule : la pause touche à sa fin. 🔄",
  "Petit rappel moelleux : nouvelle plaquette à démarrer demain. ✨",
  "Fin de pause imminente : prépare ta nouvelle plaquette pour demain 💪",
]

export const TEST_MESSAGES = [
  "Ça marche ! Tu recevras tes rappels ici, même quand l'app est fermée. ✨",
]

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export const getTakenFeedbackMessage = () => pickRandom(TAKEN_MESSAGES)
export const getReminderNotificationMessage = () => pickRandom(REMINDER_MESSAGES)
export const getNagNotificationMessage = () => pickRandom(NAG_MESSAGES)
export const getSnoozeReminderMessage = () => pickRandom(SNOOZE_REMINDER_MESSAGES)
export const getSnoozeFeedbackMessage = () => pickRandom(SNOOZE_MESSAGES)
export const getStockNotificationMessage = (n: number, lastPillDate?: string | null) => {
  if (n <= 0) return pickRandom(STOCK_EMPTY_MESSAGES)
  const base = pickRandom(STOCK_MESSAGES)(n)
  return lastPillDate ? `${base} Dernier comprimé : ${formatLongDate(lastPillDate)}.` : base
}

/** Fin d'ordonnance : `daysLeft` = jours restants (négatif si expirée). */
export const getPrescriptionNotificationMessage = (daysLeft: number, endDate: string) => {
  const when = formatLongDate(endDate)
  if (daysLeft < 0) return `Ton ordonnance a expiré (le ${when}). Prends rendez-vous pour la renouveler avant de manquer de pilules. 📋`
  if (daysLeft === 0) return `Ton ordonnance se termine aujourd'hui. Pense à la faire renouveler dès que possible. 📋`
  if (daysLeft <= 3) return `Plus que ${daysLeft} jour${daysLeft > 1 ? "s" : ""} de validité pour ton ordonnance (jusqu'au ${when}). Prends rendez-vous maintenant. 📋`
  if (daysLeft <= 7) return `Ton ordonnance se termine dans ${daysLeft} jours (le ${when}). C'est le moment de prendre rendez-vous. 📋`
  return `Ton ordonnance se termine dans ${daysLeft} jours (le ${when}). Pense à prévoir son renouvellement. 📋`
}
export const getRestartNotificationMessage = () => pickRandom(RESTART_MESSAGES)
export const getTestNotificationMessage = () => pickRandom(TEST_MESSAGES)

/* ------------------------------------------------------------------ */
/* Côté navigateur                                                     */
/* ------------------------------------------------------------------ */

const hasNotification = () => typeof window !== "undefined" && "Notification" in window

export function notificationPermission(): NotificationPermission | "unsupported" {
  return hasNotification() ? Notification.permission : "unsupported"
}

export async function requestPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!hasNotification()) return "unsupported"
  if (Notification.permission !== "default") return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return "denied"
  }
}

/**
 * Affiche une notification locale. On passe par le service worker
 * (obligatoire sur Android Chrome où `new Notification()` est interdit).
 */
export async function showLocalNotification(title: string, body: string, tag = "pillow-local"): Promise<boolean> {
  if (!hasNotification() || Notification.permission !== "granted") return false
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: ICON,
          badge: BADGE,
          tag,
          data: { url: "/", kind: "local" },
        })
        return true
      }
    }
    new Notification(title, { body, icon: ICON, tag })
    return true
  } catch {
    return false
  }
}

/**
 * Filet de sécurité : si les notifications push ne sont pas activées mais que
 * l'app est ouverte, on programme les rappels du jour en local.
 * Les rappels s'arrêtent d'eux-mêmes dès que la pilule est enregistrée.
 */
export function startLocalReminders({
  pillTime,
  isActiveDay,
  isTaken,
  nagEnabled,
}: {
  pillTime: string
  isActiveDay: boolean
  isTaken: () => boolean
  nagEnabled: boolean
}): () => void {
  if (typeof window === "undefined" || !hasNotification() || Notification.permission !== "granted") return () => {}
  if (!isActiveDay) return () => {}

  const target = timeToMinutes(pillTime)
  if (target === null) return () => {}

  const now = new Date()
  const nowMs = now.getHours() * 3_600_000 + now.getMinutes() * 60_000 + now.getSeconds() * 1000
  const timers: number[] = []

  const offsets: Array<{ offset: number; message: () => string }> = [
    { offset: 0, message: getReminderNotificationMessage },
    ...(nagEnabled
      ? [
          { offset: 30, message: getNagNotificationMessage },
          { offset: 60, message: getNagNotificationMessage },
          { offset: 90, message: getNagNotificationMessage },
        ]
      : []),
  ]

  for (const { offset, message } of offsets) {
    const delay = (target + offset) * 60_000 - nowMs
    if (delay <= 0) continue
    timers.push(
      window.setTimeout(() => {
        if (!isTaken()) void showLocalNotification("Pillow 💊", message(), "pillow-reminder")
      }, delay),
    )
  }

  return () => timers.forEach((id) => window.clearTimeout(id))
}
