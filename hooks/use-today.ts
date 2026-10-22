"use client"

import { useEffect, useState } from "react"
import { localDateKey } from "@/lib/date"

/**
 * Heure courante rafraîchie régulièrement, + clé du jour local.
 * Corrige le bug classique : `new Date().toISOString()` donne le jour UTC
 * (donc « hier » entre minuit et 2h en France l'été) et un `useMemo` figé
 * ne change jamais si l'app reste ouverte après minuit.
 */
export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = window.setInterval(tick, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === "visible") tick()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", tick)
    }
  }, [intervalMs])

  return { now, todayKey: localDateKey(now) }
}
