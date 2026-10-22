import { formatLongDate, timeToMinutes } from "@/lib/date"

/**
 * Messages + helpers de notifications.
 * Ce fichier est importé côté client ET côté serveur (dispatcher) :
 * toute utilisation de window/navigator reste donc dans des fonctions gardées.
 */

export const ICON = "/icons/icon-192.png"
export const BADGE = "/icons/badge-96.png"

export const TAKEN_MESSAGES = [
  "Pilule validée. Ton ovaire vient de lever les yeux au ciel.",
  "C'est noté. Une petite victoire hormonale de plus.",
  "Mission pilule accomplie, sans drame.",
  "Pilule prise. Le chaos est repoussé d'un jour.",
  "Check ! Ton futur toi te remercie.",
  "Et hop, c'est fait. Tu peux reprendre une vie normale.",
  "Bravo, tu es plus fiable que ton réveil.",
  "Prise enregistrée. On ne s'applaudit pas, mais presque.",
  "Validé. Ton calendrier est content.",
  "Pilule avalée, cerveau tranquille.",
  "Un jour de plus dans la boîte. Littéralement.",
  "Parfait. Rendez-vous demain, même heure, même énergie.",
]

export const REMINDER_MESSAGES = [
  "C'est l'heure de ta pilule. Elle fait la queue depuis ce matin.",
  "Ping pilule : ton coussin pense à toi.",
  "La pilule n'aime pas être ghostée. Réponds-lui.",
  "Ding ! Ta pilule t'attend sagement.",
  "Petit rappel tout doux : c'est le moment. Pas demain, maintenant.",
  "Ta pilule m'a demandé de te dire bonjour.",
  "Alerte hormones : une pilule en attente de validation.",
  "Tu as un rendez-vous avec un comprimé. Ne le fais pas attendre.",
  "Hello, c'est ta pilule. On se voit à l'heure habituelle ?",
  "Mission du jour, niveau facile : avaler un petit comprimé.",
  "Ta routine préférée t'appelle. Décroche.",
  "Il est l'heure. Même un verre d'eau suffit, pas besoin de cérémonie.",
  "Un geste, un verre d'eau, et on n'en parle plus.",
  "Ta pilule dit que c'est elle qui t'invite aujourd'hui.",
  "Rappel officiel du Ministère du Coussin : pilule, maintenant.",
  "Pas de panique, juste une pilule. Tu gères.",
  "Si tu lis ça, c'est que ta pilule est jalouse de ton téléphone.",
  "Moment pilule. Tu as 10 secondes, tu peux le faire.",
  "Ton futur toi demande poliment que tu prennes ta pilule.",
  "Dring dring. C'est la pilule, elle est à l'heure, elle.",
]

export const NAG_MESSAGES = [
  "Toujours pas de pilule enregistrée aujourd'hui. On la prend maintenant ?",
  "Je reviens à la charge, avec tendresse : ta pilule t'attend.",
  "Elle est où, cette pilule ? Je commence à m'inquiéter.",
  "Petit rappel insistant mais bienveillant : pilule du jour à valider.",
  "Ta pilule me demande de tes nouvelles. Elle boude un peu.",
  "Toujours là, toujours aussi charmant : pilule ?",
  "Je ne lâche pas l'affaire. Pilule, s'il te plaît.",
  "Ceci est un rappel du rappel. Oui, c'est le même sujet.",
  "Ton téléphone a vibré pour rien tout à l'heure. Rattrape-le avec ta pilule.",
  "Allez, deux secondes et on n'en parle plus. Pilule.",
  "Ta pilule est toujours dans sa boîte, seule et triste.",
  "Je peux faire ça toute la journée. Pas toi. Pilule.",
  "Plus tôt tu la prends, plus vite je te laisse tranquille.",
  "Coucou, c'est encore moi. La pilule, tu sais.",
  "Petite voix dans ton téléphone : et si on la prenait, cette pilule ?",
]

export const SNOOZE_REMINDER_MESSAGES = [
  "Comme promis, je reviens : c'est l'heure de ta pilule.",
  "Le délai est écoulé. Ta pilule aussi s'impatiente.",
  "Je t'avais dit que je repasserais. Pilule, maintenant ?",
  "Retour de la pause : ta pilule est toujours là.",
  "C'est reparti pour un tour. Cette fois, on la prend ?",
  "Tu m'as demandé de te relancer, je tiens mes promesses.",
  "Top chrono : plus de report possible. Pilule.",
  "Ton « plus tard » est arrivé. Il a apporté ta pilule.",
]

export const SNOOZE_MESSAGES = [
  "Ok, je te relance plus tard.",
  "Très bien, report validé. Je reviens te chercher.",
  "Pas de souci, je garde ça au chaud.",
  "Compris. Je repasse plus tard avec tact et insistance.",
  "Noté. Je mets un post-it mental.",
  "D'accord, mais je n'oublie pas. Je ne suis pas ton ex.",
  "Report accepté. Pas de deuxième chance gratuite, par contre.",
  "Ça roule. À tout à l'heure, comprimé en main.",
]

export const STOCK_MESSAGES = [
  (n: number) => `Il te reste ${n} jour${n > 1 ? "s" : ""} de pilule. C'est le bon moment pour refaire le stock.`,
  (n: number) => `Stock pilule : ${n} jour${n > 1 ? "s" : ""} restant${n > 1 ? "s" : ""}. Ton futur toi te remercie d'anticiper.`,
  (n: number) => `Plus que ${n} jour${n > 1 ? "s" : ""} avant la panne sèche. La pharmacie, c'est pas loin.`,
  (n: number) => `${n} jour${n > 1 ? "s" : ""} de pilule en réserve. Ça se rachète avant la rupture, pas pendant.`,
  (n: number) => `Ta boîte fond comme neige au soleil : ${n} jour${n > 1 ? "s" : ""} restant${n > 1 ? "s" : ""}.`,
  (n: number) => `Rappel logistique : il te reste ${n} jour${n > 1 ? "s" : ""}. Passe à la pharmacie quand tu peux.`,
  (n: number) => `Compte à rebours : ${n} jour${n > 1 ? "s" : ""} de pilule. Anticipe, tu verras, c'est reposant.`,
  (n: number) => `Il est temps de racheter ta pilule (${n} jour${n > 1 ? "s" : ""} restant${n > 1 ? "s" : ""}). La pharmacie t'attend.`,
]

export const STOCK_EMPTY_MESSAGES = [
  "Ton stock de pilules est épuisé. Pharmacie, aujourd'hui.",
  "Plus de pilules en stock ! Un tour à la pharmacie s'impose.",
  "Boîte vide. Direction la pharmacie, sans détour.",
  "Alerte rouge : plus aucune pilule en réserve.",
  "Fin de stock. Si tu as une ordonnance valide, c'est le moment d'y aller.",
  "Ton stock est à zéro. Ça ne se rachète pas tout seul.",
]

export const RESTART_MESSAGES = [
  "Demain on reprend la pilule : la pause touche à sa fin.",
  "Fin de pause demain. Sors la nouvelle plaquette.",
  "Dernier jour de pause. Demain, c'est reparti.",
  "Petit rappel : nouvelle plaquette à démarrer demain.",
  "Les vacances sont finies : on reprend demain matin.",
  "Prépare ta plaquette, la pause se termine ce soir.",
  "Demain, jour 1. Pas d'excuse, tout est prêt.",
  "Ta pause arrive au bout. Demain, on est de retour.",
]

export const PRESCRIPTION_SOON_MESSAGES = [
  (days: number, when: string) => `Ton ordonnance se termine dans ${days} jours (le ${when}). Pense à prévoir son renouvellement.`,
  (days: number, when: string) => `Ordonnance : encore ${days} jours (jusqu'au ${when}). Un rendez-vous, ça se prend à l'avance.`,
  (days: number, when: string) => `Ton ordonnance expire le ${when}, dans ${days} jours. Mieux vaut ne pas attendre le dernier moment.`,
  (days: number, when: string) => `Il reste ${days} jours de validité à ton ordonnance (fin le ${when}). Un petit coup de fil au cabinet ?`,
]

export const TEST_MESSAGES = [
  "Ça marche ! Tu recevras tes rappels ici, même quand l'app est fermée.",
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
  if (daysLeft < 0) return `Ton ordonnance a expiré (le ${when}). Prends rendez-vous pour la renouveler avant de manquer de pilules.`
  if (daysLeft === 0) return "Ton ordonnance se termine aujourd'hui. Pense à la faire renouveler dès que possible."
  if (daysLeft <= 3) return `Plus que ${daysLeft} jour${daysLeft > 1 ? "s" : ""} de validité pour ton ordonnance (jusqu'au ${when}). Prends rendez-vous maintenant.`
  if (daysLeft <= 7) return `Ton ordonnance se termine dans ${daysLeft} jours (le ${when}). C'est le moment de prendre rendez-vous.`
  return pickRandom(PRESCRIPTION_SOON_MESSAGES)(daysLeft, when)
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
