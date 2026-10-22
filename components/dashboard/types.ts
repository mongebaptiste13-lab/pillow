import type { PillowData } from "@/hooks/use-pillow-data"
import type { usePushNotifications } from "@/hooks/use-push-notifications"
import type { ProfileRow } from "@/lib/database.types"
import type { PackStatus } from "@/lib/pack"
import type { PillInfo } from "@/lib/pill-data"
import type { PillStats } from "@/lib/stats"

export type PushState = ReturnType<typeof usePushNotifications>

/** Props communes à tous les onglets du tableau de bord. */
export interface TabCommon {
  data: PillowData
  profile: ProfileRow
  now: Date
  todayKey: string
  pillType: "21_7" | "28_continu"
  pack: PackStatus
  stats: PillStats
  /** Premier jour de suivi : avant, aucun oubli n'est compté */
  trackingSince: string
  pillInfo: PillInfo | undefined
}

export type TabId = "today" | "history" | "pack" | "settings"
