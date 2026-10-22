"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase-client"
import { addDaysToKey, detectTimezone, localDateKey } from "@/lib/date"
import type { PillLogRow, ProfileRow } from "@/lib/database.types"
import { findPill } from "@/lib/pill-data"
import type { LogEntry, LogMap } from "@/lib/stats"

const HISTORY_DAYS = 400
const RELOAD_AFTER_MS = 60_000

export type DayStatus = "taken" | "missed" | "none"

interface QueuedOp {
  kind: "set" | "clear"
  date: string
  taken?: boolean
  taken_at?: string | null
  stockDelta: number
}

const queueKey = (userId: string) => `pillow:queue:${userId}`

function readQueue(userId: string): QueuedOp[] {
  try {
    const raw = localStorage.getItem(queueKey(userId))
    return raw ? (JSON.parse(raw) as QueuedOp[]) : []
  } catch {
    return []
  }
}

function writeQueue(userId: string, ops: QueuedOp[]) {
  try {
    if (ops.length === 0) localStorage.removeItem(queueKey(userId))
    else localStorage.setItem(queueKey(userId), JSON.stringify(ops))
  } catch {
    /* stockage plein ou indisponible : on tente quand même en mémoire */
  }
}

function isNetworkError(error: { message?: string } | null | undefined): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true
  return /failed to fetch|network|load failed|fetch failed/i.test(error?.message ?? "")
}

function isComplete(p: Pick<ProfileRow, "name" | "pill_name" | "pill_time"> | null | undefined): boolean {
  return Boolean(p?.name && p?.pill_name && p?.pill_time)
}

/**
 * Toute la donnée de l'app : profil, journal des prises, actions (avec mise à jour
 * optimiste, file d'attente hors-ligne et synchro temps réel entre appareils).
 */
export function usePillowData(userId: string, todayKey: string, onNeedsOnboarding?: () => void) {
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [logs, setLogs] = useState<LogMap>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState(0)

  const profileRef = useRef<ProfileRow | null>(null)
  const logsRef = useRef<LogMap>({})
  const lastLoadRef = useRef(0)
  const flushingRef = useRef(false)
  const needsOnboardingRef = useRef(onNeedsOnboarding)
  needsOnboardingRef.current = onNeedsOnboarding
  profileRef.current = profile
  logsRef.current = logs

  const todayRef = useRef(todayKey)
  todayRef.current = todayKey

  /* ------------------------------ chargement ------------------------------ */

  const loadLogs = useCallback(async () => {
    const since = addDaysToKey(localDateKey(), -HISTORY_DAYS)
    const { data, error } = await supabase
      .from("pill_logs")
      .select("date, taken, taken_at")
      .eq("user_id", userId)
      .gte("date", since)
      .order("date", { ascending: false })
    if (error) throw error
    const map: LogMap = {}
    for (const row of (data ?? []) as Array<Pick<PillLogRow, "date" | "taken" | "taken_at">>) {
      map[row.date] = { date: row.date, taken: row.taken, taken_at: row.taken_at }
    }
    // On garde les modifications locales pas encore synchronisées (file hors-ligne)
    for (const op of readQueue(userId)) {
      if (op.kind === "clear") delete map[op.date]
      else map[op.date] = { date: op.date, taken: op.taken ?? true, taken_at: op.taken_at ?? null }
    }
    setLogs(map)
  }, [supabase, userId])

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setLoadError(null)
      try {
        const [p] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
          loadLogs(),
        ])
        if (p.error) throw p.error
        if (!p.data || !isComplete(p.data)) {
          needsOnboardingRef.current?.()
          return
        }
        setProfile(p.data)
        lastLoadRef.current = Date.now()

        // Voyage / changement de fuseau : le serveur planifie les rappels dans le fuseau du profil
        const tz = detectTimezone()
        if (p.data.timezone !== tz) {
          void supabase.from("profiles").update({ timezone: tz }).eq("id", userId).then(({ error }) => {
            if (!error) setProfile((prev) => (prev ? { ...prev, timezone: tz } : prev))
          })
        }
      } catch (err) {
        console.error("[Pillow] chargement:", err)
        setLoadError(isNetworkError(err as Error) ? "offline" : "error")
      } finally {
        setLoading(false)
      }
    },
    [supabase, userId, loadLogs],
  )

  /* ------------------------- stock & écritures sûres ------------------------- */

  /** Ajoute `delta` au stock en lisant la valeur la plus récente (sûr avec plusieurs appareils). */
  const applyStock = useCallback(
    async (delta: number): Promise<boolean> => {
      if (delta === 0) return true
      const { data, error } = await supabase.from("profiles").select("days_remaining").eq("id", userId).maybeSingle()
      if (error || !data) return false
      const next = Math.max(0, (data.days_remaining ?? 0) + delta)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ days_remaining: next, updated_at: new Date().toISOString() })
        .eq("id", userId)
      if (updateError) return false
      setProfile((prev) => (prev ? { ...prev, days_remaining: next } : prev))
      return true
    },
    [supabase, userId],
  )

  const execOp = useCallback(
    async (op: QueuedOp): Promise<"ok" | "network" | "error"> => {
      const write =
        op.kind === "set"
          ? await supabase
              .from("pill_logs")
              .upsert(
                { user_id: userId, date: op.date, taken: op.taken ?? true, taken_at: op.taken_at ?? null },
                { onConflict: "user_id,date" },
              )
          : await supabase.from("pill_logs").delete().eq("user_id", userId).eq("date", op.date)
      if (write.error) return isNetworkError(write.error) ? "network" : "error"
      await applyStock(op.stockDelta)
      return "ok"
    },
    [supabase, userId, applyStock],
  )

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return
    flushingRef.current = true
    try {
      let queue = readQueue(userId)
      let synced = 0
      while (queue.length > 0) {
        const result = await execOp(queue[0])
        if (result === "network") break
        queue = queue.slice(1) // en cas d'erreur définitive on abandonne l'opération plutôt que de bloquer la file
        writeQueue(userId, queue)
        if (result === "ok") synced++
      }
      setPending(queue.length)
      if (synced > 0) toast.success(`${synced} modification${synced > 1 ? "s" : ""} synchronisée${synced > 1 ? "s" : ""}`)
    } finally {
      flushingRef.current = false
    }
  }, [userId, execOp])

  const enqueue = useCallback(
    (op: QueuedOp) => {
      const queue = readQueue(userId)
      const existing = queue.find((o) => o.date === op.date)
      // Deux changements sur le même jour fusionnent : on garde le dernier état, on additionne l'effet sur le stock
      const merged = { ...op, stockDelta: op.stockDelta + (existing?.stockDelta ?? 0) }
      const next = [...queue.filter((o) => o.date !== op.date), merged]
      writeQueue(userId, next)
      setPending(next.length)
    },
    [userId],
  )

  /* -------------------------------- actions -------------------------------- */

  /** Définit l'état d'un jour (prise / oubli / effacer). Optimiste + hors-ligne. */
  const setDayStatus = useCallback(
    async (date: string, status: DayStatus): Promise<boolean> => {
      if (date > todayRef.current) return false // pas de futur

      const prev = logsRef.current[date]
      const wasTaken = prev?.taken === true
      const willBeTaken = status === "taken"
      let stockDelta = 0
      if (wasTaken && !willBeTaken) stockDelta = 1
      if (!wasTaken && willBeTaken) stockDelta = (profileRef.current?.days_remaining ?? 0) > 0 ? -1 : 0

      const entry: LogEntry | null =
        status === "none"
          ? null
          : {
              date,
              taken: willBeTaken,
              taken_at: willBeTaken && date === todayRef.current ? new Date().toISOString() : willBeTaken && wasTaken ? prev?.taken_at ?? null : null,
            }

      // 1) interface immédiate
      setLogs((current) => {
        const next = { ...current }
        if (entry) next[date] = entry
        else delete next[date]
        return next
      })
      if (stockDelta !== 0) {
        setProfile((p) => (p ? { ...p, days_remaining: Math.max(0, (p.days_remaining ?? 0) + stockDelta) } : p))
      }

      // 2) écriture
      const op: QueuedOp = entry
        ? { kind: "set", date, taken: entry.taken, taken_at: entry.taken_at, stockDelta }
        : { kind: "clear", date, stockDelta }

      const result = await execOp({ ...op })
      if (result === "ok") {
        if (willBeTaken && date === todayRef.current) {
          // Le « plus tard » n'a plus d'objet une fois la pilule prise
          void supabase
            .from("notification_schedules")
            .delete()
            .eq("user_id", userId)
            .eq("type", "snooze")
            .is("sent_at", null)
        }
        return true
      }
      if (result === "network") {
        enqueue(op)
        toast.info("Hors ligne : c'est noté, je synchronise dès que le réseau revient.")
        return true
      }

      // Erreur définitive : on annule l'affichage optimiste
      setLogs((current) => {
        const next = { ...current }
        if (prev) next[date] = prev
        else delete next[date]
        return next
      })
      if (stockDelta !== 0) {
        setProfile((p) => (p ? { ...p, days_remaining: Math.max(0, (p.days_remaining ?? 0) - stockDelta) } : p))
      }
      toast.error("Impossible d'enregistrer. Réessaie dans un instant.")
      return false
    },
    [execOp, enqueue, supabase, userId],
  )

  const updateProfile = useCallback(
    async (patch: Partial<ProfileRow>): Promise<boolean> => {
      const before = profileRef.current
      if (!before) return false
      setProfile({ ...before, ...patch })
      const { data, error } = await supabase
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("*")
        .maybeSingle()
      if (error || !data) {
        setProfile(before)
        toast.error(isNetworkError(error) ? "Pas de connexion : modification non enregistrée." : "Impossible d'enregistrer.")
        return false
      }
      setProfile(data)
      return true
    },
    [supabase, userId],
  )

  const restock = useCallback(
    async (count: number, unit: "boxes" | "packs" = "boxes"): Promise<boolean> => {
      const p = profileRef.current
      if (!p || count <= 0) return false
      const perPack = findPill(p.pill_name)?.daysPerBox ?? 21
      const packsPerBox = Math.max(1, p.packs_per_box ?? 3)
      const packs = unit === "boxes" ? count * packsPerBox : count
      return updateProfile({
        days_remaining: (p.days_remaining ?? 0) + packs * perPack,
        ...(unit === "boxes" ? { boxes_remaining: (p.boxes_remaining ?? 0) + count } : {}),
      })
    },
    [updateProfile],
  )

  const startNewPack = useCallback(
    (dateKey: string = todayRef.current) => updateProfile({ pack_start_date: dateKey }),
    [updateProfile],
  )

  /* ------------------------------ cycle de vie ------------------------------ */

  useEffect(() => {
    void loadAll().then(() => flushQueue())
    setPending(readQueue(userId).length)
  }, [loadAll, flushQueue, userId])

  // Retour du réseau → on envoie ce qui attendait
  useEffect(() => {
    const onOnline = () => void flushQueue()
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [flushQueue])

  // Retour sur l'app après un moment (ou après minuit) → on rafraîchit
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      if (Date.now() - lastLoadRef.current > RELOAD_AFTER_MS) {
        void loadAll(true).then(() => flushQueue())
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [loadAll, flushQueue])

  // Temps réel : une prise validée sur un appareil apparaît tout de suite sur les autres
  useEffect(() => {
    const channel = supabase
      .channel(`pillow-rt-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pill_logs", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            void loadLogs().catch(() => undefined)
            return
          }
          const row = payload.new as PillLogRow
          setLogs((current) => ({ ...current, [row.date]: { date: row.date, taken: row.taken, taken_at: row.taken_at } }))
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => setProfile((prev) => (prev ? { ...prev, ...(payload.new as ProfileRow) } : prev)),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, userId, loadLogs])

  return {
    supabase,
    profile,
    logs,
    loading,
    loadError,
    pending,
    reload: loadAll,
    setDayStatus,
    updateProfile,
    restock,
    startNewPack,
  }
}

export type PillowData = ReturnType<typeof usePillowData>
