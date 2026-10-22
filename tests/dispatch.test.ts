import { test } from "node:test"
import assert from "node:assert/strict"
import { runDispatch } from "../lib/dispatch"
import { createFakeSupabase } from "./fake-supabase"
import type { PushPayload, PushResult, PushSubscriptionRecord } from "../lib/web-push-server"

type Sent = { endpoint: string; payload: PushPayload }

function profile(over: Record<string, unknown> = {}) {
  return {
    id: "u1", name: "Léa", pill_name: "Cerazette", pill_time: "08:00",
    boxes_remaining: 1, days_remaining: 20, stock_alert_days: 7,
    timezone: "Europe/Paris", pack_start_date: null,
    notif_reminder: true, notif_nag: true, notif_stock: true, notif_restart: true,
    created_at: null, updated_at: null,
    ...over,
  }
}

function world(opts: { profile?: Record<string, unknown>; logs?: Array<{ date: string; taken: boolean }>; schedules?: Array<Record<string, unknown>>; devices?: number } = {}) {
  const devices = opts.devices ?? 1
  const db = createFakeSupabase({
    profiles: [profile(opts.profile)],
    pill_logs: (opts.logs ?? []).map((l) => ({ user_id: "u1", ...l })),
    push_subscriptions: Array.from({ length: devices }, (_, i) => ({ user_id: "u1", endpoint: `https://push.example/${i}`, p256dh: "k", auth: "a" })),
    notification_schedules: opts.schedules ?? [],
    notification_state: [],
  })
  const sent: Sent[] = []
  let result: PushResult = { ok: true }
  const deps = {
    admin: db.client,
    send: async (sub: PushSubscriptionRecord, payload: PushPayload): Promise<PushResult> => {
      sent.push({ endpoint: sub.endpoint, payload })
      return result
    },
  }
  return {
    ...db,
    sent,
    deps,
    setResult: (r: PushResult) => (result = r),
    run: (iso: string) => runDispatch(new Date(iso), deps),
    kinds: () => sent.map((s) => s.payload.kind),
  }
}

// 22 octobre 2026 : Paris = UTC+2  →  08:00 Paris = 06:00 UTC
const T0759 = "2026-10-22T05:59:00Z"
const T0800 = "2026-10-22T06:00:00Z"

test("aucun rappel avant l'heure de prise", async () => {
  const w = world()
  await w.run(T0759)
  assert.equal(w.sent.length, 0)
})

test("rappel à l'heure de prise (fuseau de Paris), une seule fois", async () => {
  const w = world()
  await w.run(T0800)
  assert.deepEqual(w.kinds(), ["reminder"])
  await w.run("2026-10-22T06:01:00Z")
  await w.run("2026-10-22T06:02:00Z")
  assert.equal(w.sent.length, 1, "pas de doublon aux minutes suivantes")
})

test("le rappel part sur tous les appareils", async () => {
  const w = world({ devices: 2 })
  await w.run(T0800)
  assert.equal(w.sent.length, 2)
  assert.deepEqual(new Set(w.sent.map((s) => s.endpoint)), new Set(["https://push.example/0", "https://push.example/1"]))
})

test("pas de rappel si la pilule est déjà prise aujourd'hui", async () => {
  const w = world({ logs: [{ date: "2026-10-22", taken: true }] })
  await w.run(T0800)
  assert.equal(w.sent.length, 0)
})

test("une prise d'hier ne dispense pas du rappel d'aujourd'hui", async () => {
  const w = world({ logs: [{ date: "2026-10-21", taken: true }] })
  await w.run(T0800)
  assert.deepEqual(w.kinds(), ["reminder"])
})

test("relances toutes les 30 min, 3 au maximum, tant que la pilule n'est pas prise", async () => {
  const w = world()
  const times = ["06:00", "06:10", "06:30", "06:31", "07:00", "07:30", "08:00", "09:00"]
  for (const t of times) await w.run(`2026-10-22T${t}:00Z`)
  assert.deepEqual(w.kinds(), ["reminder", "nag", "nag", "nag"])
})

test("les relances s'arrêtent dès que la pilule est prise", async () => {
  const w = world()
  await w.run(T0800)
  await w.run("2026-10-22T06:30:00Z") // relance 1
  w.tables.pill_logs.push({ user_id: "u1", date: "2026-10-22", taken: true })
  await w.run("2026-10-22T07:00:00Z")
  await w.run("2026-10-22T07:30:00Z")
  assert.deepEqual(w.kinds(), ["reminder", "nag"])
})

test("relances désactivées dans les réglages → seulement le rappel principal", async () => {
  const w = world({ profile: { notif_nag: false } })
  for (const t of ["06:00", "06:30", "07:00", "07:30"]) await w.run(`2026-10-22T${t}:00Z`)
  assert.deepEqual(w.kinds(), ["reminder"])
})

test("rappels désactivés → rien (ni rappel ni relance)", async () => {
  const w = world({ profile: { notif_reminder: false } })
  for (const t of ["06:00", "06:30", "07:00"]) await w.run(`2026-10-22T${t}:00Z`)
  assert.equal(w.sent.length, 0)
})

test("on ne réveille pas pour un rappel manqué de plus de 6 h (cron en panne)", async () => {
  const w = world()
  await w.run("2026-10-22T13:00:00Z") // 15h Paris, 7 h après l'heure de prise
  assert.equal(w.sent.length, 0)
})

test("jour de pause (21/7) : aucun rappel de prise", async () => {
  // Plaquette démarrée le 1er : le 22 = premier jour de pause
  const w = world({ profile: { pill_name: "Leeloo", pack_start_date: "2026-10-01" } })
  for (const t of ["06:00", "06:30", "07:00"]) await w.run(`2026-10-22T${t}:00Z`)
  assert.equal(w.sent.length, 0)
})

test("pilule 21/7 un jour actif : rappel normal", async () => {
  const w = world({ profile: { pill_name: "Leeloo", pack_start_date: "2026-10-10" } })
  await w.run(T0800)
  assert.deepEqual(w.kinds(), ["reminder"])
})

test("rappel de reprise la veille à 18 h (dernier jour de pause), une seule fois", async () => {
  // 2026-10-28 = 7e jour de pause pour une plaquette démarrée le 1er
  const w = world({ profile: { pill_name: "Leeloo", pack_start_date: "2026-10-01" }, logs: [] })
  await w.run("2026-10-28T15:59:00Z") // 17h59 Paris (heure d'hiver depuis le 25/10 → UTC+1)
  assert.equal(w.sent.length, 0)
  await w.run("2026-10-28T17:00:00Z") // 18h00 Paris
  await w.run("2026-10-28T17:05:00Z")
  assert.deepEqual(w.kinds(), ["restart"])
})

test("alerte de stock à 9 h quand le stock passe sous le seuil, une fois par jour", async () => {
  const w = world({ profile: { days_remaining: 5, pill_time: "22:00" }, logs: [{ date: "2026-10-22", taken: true }] })
  await w.run("2026-10-22T06:59:00Z") // 8h59
  assert.equal(w.sent.length, 0)
  await w.run("2026-10-22T07:00:00Z") // 9h00
  await w.run("2026-10-22T07:01:00Z")
  assert.deepEqual(w.kinds(), ["stock"])
  await w.run("2026-10-23T07:00:00Z") // le lendemain
  assert.deepEqual(w.kinds(), ["stock", "stock"])
})

test("pas d'alerte de stock si le stock est suffisant", async () => {
  const w = world({ profile: { days_remaining: 30, pill_time: "22:00" } })
  await w.run("2026-10-22T07:00:00Z")
  assert.equal(w.sent.length, 0)
})

test("rappel « plus tard » envoyé une fois à l'échéance puis marqué envoyé", async () => {
  const w = world({
    logs: [],
    profile: { notif_reminder: false },
    schedules: [{ id: "s1", user_id: "u1", type: "snooze", title: "Pillow 💊", body: "Je reviens", scheduled_at: "2026-10-22T06:10:00Z", sent_at: null }],
  })
  await w.run("2026-10-22T06:09:00Z")
  assert.equal(w.sent.length, 0)
  await w.run("2026-10-22T06:10:00Z")
  await w.run("2026-10-22T06:11:00Z")
  assert.deepEqual(w.kinds(), ["snooze"])
  assert.ok(w.tables.notification_schedules[0].sent_at, "marqué envoyé")
})

test("« plus tard » annulé silencieusement si la pilule a été prise entre-temps", async () => {
  const w = world({
    logs: [{ date: "2026-10-22", taken: true }],
    schedules: [{ id: "s1", user_id: "u1", type: "snooze", title: "Pillow 💊", body: "Je reviens", scheduled_at: "2026-10-22T06:10:00Z", sent_at: null }],
  })
  await w.run("2026-10-22T06:10:00Z")
  assert.equal(w.sent.length, 0)
  assert.ok(w.tables.notification_schedules[0].sent_at, "ne sera pas rejoué")
})

test("« plus tard » périmé (plus de 3 h de retard) : ignoré", async () => {
  const w = world({
    schedules: [{ id: "s1", user_id: "u1", type: "snooze", title: "Pillow 💊", body: "Trop tard", scheduled_at: "2026-10-22T01:00:00Z", sent_at: null }],
    profile: { notif_reminder: false },
  })
  await w.run("2026-10-22T06:10:00Z")
  assert.equal(w.sent.length, 0)
})

test("deux exécutions simultanées du cron n'envoient qu'une seule notification", async () => {
  const w = world()
  await Promise.all([w.run(T0800), w.run(T0800), w.run(T0800)])
  assert.equal(w.sent.length, 1)
})

test("abonnement expiré (410) : supprimé de la base", async () => {
  const w = world()
  w.setResult({ ok: false, gone: true, error: "410" })
  const summary = await w.run(T0800)
  assert.equal(w.tables.push_subscriptions.length, 0)
  assert.equal(summary.removedSubscriptions, 1)
})

test("fuseau horaire : une utilisatrice à New York n'est pas notifiée à 8 h de Paris", async () => {
  const w = world({ profile: { timezone: "America/New_York" } })
  await w.run(T0800) // 02h00 à New York
  assert.equal(w.sent.length, 0)
  await w.run("2026-10-22T12:00:00Z") // 08h00 à New York (UTC-4)
  assert.deepEqual(w.kinds(), ["reminder"])
})

test("changer l'heure de prise après un rappel déclenche un nouveau rappel à la nouvelle heure", async () => {
  const w = world()
  await w.run(T0800) // rappel de 8h
  w.tables.profiles[0].pill_time = "10:00"
  await w.run("2026-10-22T07:59:00Z")
  assert.equal(w.sent.length, 1)
  await w.run("2026-10-22T08:00:00Z") // 10h Paris
  assert.deepEqual(w.kinds(), ["reminder", "reminder"])
})

test("profil incomplet (onboarding non terminé) : aucune notification", async () => {
  const w = world({ profile: { name: null, pill_name: null, pill_time: null } })
  await w.run(T0800)
  assert.equal(w.sent.length, 0)
})

test("sans aucun abonnement push, rien n'est envoyé et rien ne plante", async () => {
  const w = world({ devices: 0 })
  const summary = await w.run(T0800)
  assert.equal(w.sent.length, 0)
  assert.equal(summary.users, 0)
})

test("le contenu de la notification de rappel est exploitable par le service worker", async () => {
  const w = world()
  await w.run(T0800)
  const p = w.sent[0].payload
  assert.equal(p.kind, "reminder")
  assert.equal(p.url, "/")
  assert.ok(p.body.length > 5)
  assert.equal(p.tag, "pillow-reminder")
})
