import { test } from "node:test"
import assert from "node:assert/strict"
import { zonedParts, addDaysToKey, diffDays, localDateKey } from "../lib/date"
import { getPackStatus, getBlisterLayout } from "../lib/pack"
import { computeStats, type LogMap } from "../lib/stats"
import { addMonthsToKey, getPrescriptionInfo, getStockInfo, getStockLevel } from "../lib/supply"

test("zonedParts : le jour local change à minuit heure de Paris, pas à minuit UTC", () => {
  // 22h30 UTC un 22 octobre = 00h30 le 23 à Paris (UTC+2)
  assert.deepEqual(zonedParts(new Date("2026-10-22T22:30:00Z"), "Europe/Paris"), { dateKey: "2026-10-23", minutes: 30 })
  // Hiver (UTC+1)
  assert.deepEqual(zonedParts(new Date("2026-12-15T07:00:00Z"), "Europe/Paris"), { dateKey: "2026-12-15", minutes: 8 * 60 })
  // New York en octobre (UTC-4)
  assert.deepEqual(zonedParts(new Date("2026-10-22T12:00:00Z"), "America/New_York"), { dateKey: "2026-10-22", minutes: 8 * 60 })
})

test("zonedParts : fuseau invalide → repli sur Europe/Paris sans planter", () => {
  assert.equal(zonedParts(new Date("2026-10-22T06:00:00Z"), "Nope/Nowhere").minutes, 8 * 60)
})

test("addDaysToKey / diffDays traversent les changements d'heure sans décalage", () => {
  assert.equal(addDaysToKey("2026-10-24", 2), "2026-10-26") // passage heure d'hiver le 25/10/2026
  assert.equal(diffDays("2026-10-24", "2026-10-26"), 2)
  assert.equal(addDaysToKey("2026-03-01", -1), "2026-02-28")
  assert.equal(addDaysToKey("2028-02-28", 1), "2028-02-29")
})

test("localDateKey utilise le jour local, pas l'UTC", () => {
  const d = new Date(2026, 9, 22, 0, 30) // 00h30 locale
  assert.equal(localDateKey(d), "2026-10-22")
})

test("getPackStatus 21/7 : 21 jours actifs puis 7 de pause puis reprise", () => {
  const start = "2026-10-01"
  const at = (day: string) => getPackStatus("21_7", start, day)

  assert.equal(at("2026-10-01").phase, "active")
  assert.equal(at("2026-10-01").day, 1)
  assert.equal(at("2026-10-21").day, 21)
  assert.equal(at("2026-10-21").pauseStartsOn, "2026-10-22")

  const p1 = at("2026-10-22")
  assert.equal(p1.phase, "pause")
  assert.equal(p1.day, 1)
  assert.equal(p1.resumeOn, "2026-10-29")
  assert.equal(p1.restartsTomorrow, false)

  const p7 = at("2026-10-28")
  assert.equal(p7.phase, "pause")
  assert.equal(p7.day, 7)
  assert.equal(p7.restartsTomorrow, true)

  const next = at("2026-10-29")
  assert.equal(next.phase, "active")
  assert.equal(next.day, 1)
})

test("getPackStatus : sans date de début ou en prise continue, toujours actif (on rappelle plutôt que de se taire)", () => {
  assert.equal(getPackStatus("21_7", null, "2026-10-22").phase, "active")
  assert.equal(getPackStatus("28_continu", "2026-01-01", "2026-10-22").phase, "active")
  assert.equal(getPackStatus("21_7", "2026-12-01", "2026-10-22").phase, "active") // début dans le futur
})

test("getBlisterLayout : 28 cases pour 21/7 (7 pauses), N cases en continu, case du jour correcte", () => {
  const a = getBlisterLayout("21_7", 21, "2026-10-01", "2026-10-05")
  assert.equal(a.cells.length, 28)
  assert.equal(a.cells.filter((c) => c.phase === "pause").length, 7)
  assert.equal(a.todayIndex, 4)
  assert.equal(a.cells[a.todayIndex].dateKey, "2026-10-05")

  const b = getBlisterLayout("28_continu", 28, "2026-10-01", "2026-10-30")
  assert.equal(b.cells.length, 28)
  assert.equal(b.todayIndex, 1) // 29 jours écoulés → nouvelle plaquette, jour 2
})

test("computeStats : la série ignore les jours de pause et casse sur un oubli", () => {
  // Plaquette démarrée le 1er : prise du 1 au 21, pause du 22 au 28, reprise le 29
  const logs: LogMap = {}
  const take = (d: string) => (logs[d] = { date: d, taken: true, taken_at: null })
  for (let i = 1; i <= 21; i++) take(`2026-10-${String(i).padStart(2, "0")}`)
  take("2026-10-29")
  take("2026-10-30")

  const stats = computeStats({
    logs, todayKey: "2026-10-30", pillType: "21_7", packStartDate: "2026-10-01", trackingSince: "2026-10-01", pillTime: null,
  })
  assert.equal(stats.currentStreak, 23, "21 jours + 2 après la pause, la pause ne casse pas la série")
  assert.equal(stats.adherence30, 100)

  delete logs["2026-10-10"]
  const broken = computeStats({
    logs, todayKey: "2026-10-30", pillType: "21_7", packStartDate: "2026-10-01", trackingSince: "2026-10-01", pillTime: null,
  })
  assert.equal(broken.currentStreak, 13, "série coupée par l'oubli du 10 : jours 11→21 (11) + 29 et 30 (2), la pause est ignorée")
  assert.ok(broken.bestStreak >= 11)
  assert.equal(broken.missed30, 1)
})

test("computeStats : aujourd'hui non pris ne casse pas la série et n'est pas compté comme oubli", () => {
  const logs: LogMap = {
    "2026-10-20": { date: "2026-10-20", taken: true, taken_at: null },
    "2026-10-21": { date: "2026-10-21", taken: true, taken_at: null },
  }
  const stats = computeStats({
    logs, todayKey: "2026-10-22", pillType: "28_continu", packStartDate: null, trackingSince: "2026-10-20", pillTime: null,
  })
  assert.equal(stats.currentStreak, 2)
  assert.equal(stats.adherence30, 100)
  assert.equal(stats.missed30, 0)
})

test("computeStats : avant l'inscription, aucun oubli n'est compté", () => {
  const stats = computeStats({
    logs: {}, todayKey: "2026-10-22", pillType: "28_continu", packStartDate: null, trackingSince: "2026-10-22", pillTime: null,
  })
  assert.equal(stats.adherence30, null)
  assert.equal(stats.currentStreak, 0)
})

test("getStockInfo 21/7 : boîtes de réserve, reste de la plaquette en cours et dernier comprimé (pauses incluses)", () => {
  // Plaquette démarrée le 15/10 → le 22/10 on est au jour 8 : il reste 14 comprimés (aujourd'hui compris)
  const info = getStockInfo({ pillType: "21_7", packStartDate: "2026-10-15", perBox: 21, daysLeft: 14 + 21 + 5, todayKey: "2026-10-22", takenToday: false })
  assert.equal(info.currentPackLeft, 14)
  assert.equal(info.reservePacks, 1)
  assert.equal(info.looseDays, 5)
  // 14 jours jusqu'au 4/11, pause 5→11/11, 21 jours du 12/11 au 2/12, pause 3→9/12, puis 5 jours du 10/12 → dernier comprimé le 14/12
  assert.equal(info.lastPillDate, "2026-12-14")
  assert.equal(info.empty, false)

  const taken = getStockInfo({ pillType: "21_7", packStartDate: "2026-10-15", perBox: 21, daysLeft: 13, todayKey: "2026-10-22", takenToday: true })
  assert.equal(taken.currentPackLeft, 13)
  assert.equal(taken.lastPillDate, "2026-11-04")
})

test("getStockInfo : pause → plaquette en cours terminée, tout le stock est en réserve", () => {
  const info = getStockInfo({ pillType: "21_7", packStartDate: "2026-10-01", perBox: 21, daysLeft: 42, todayKey: "2026-10-23", takenToday: false })
  assert.equal(info.currentPackLeft, 0)
  assert.equal(info.reservePacks, 2)
})

test("getStockInfo : prise continue, et stock vide", () => {
  const info = getStockInfo({ pillType: "28_continu", packStartDate: "2026-10-15", perBox: 28, daysLeft: 50, todayKey: "2026-10-22", takenToday: false })
  assert.equal(info.currentPackLeft, 21) // jour 8 sur 28 → 21 restants
  assert.equal(info.reservePacks, 1)
  assert.equal(info.looseDays, 1)
  const empty = getStockInfo({ pillType: "28_continu", packStartDate: null, perBox: 28, daysLeft: 0, todayKey: "2026-10-22", takenToday: false })
  assert.equal(empty.empty, true)
  assert.equal(empty.lastPillDate, null)
})

test("getStockLevel", () => {
  assert.equal(getStockLevel(30, 7), "ok")
  assert.equal(getStockLevel(7, 7), "low")
  assert.equal(getStockLevel(3, 7), "urgent")
  assert.equal(getStockLevel(0, 7), "empty")
})

test("getPrescriptionInfo : paliers et niveaux", () => {
  const at = (end: string) => getPrescriptionInfo(end, "2026-10-22")
  assert.deepEqual(at("2027-06-01"), { daysLeft: 222, level: "ok", bucket: null })
  assert.equal(at("2026-11-21").bucket, 30)
  assert.equal(at("2026-11-04").bucket, 14)
  assert.equal(at("2026-10-29").bucket, 7)
  assert.equal(at("2026-10-25").bucket, 3)
  assert.equal(at("2026-10-22").bucket, 0)
  assert.equal(at("2026-10-21").level, "expired")
  assert.equal(at("2026-10-21").bucket, -1)
  assert.equal(at("2026-10-25").level, "urgent")
  assert.deepEqual(getPrescriptionInfo(null, "2026-10-22"), { daysLeft: null, level: "none", bucket: null })
})

test("addMonthsToKey gère les fins de mois et les années", () => {
  assert.equal(addMonthsToKey("2026-10-22", 12), "2027-10-22")
  assert.equal(addMonthsToKey("2026-08-31", 6), "2027-02-28")
  assert.equal(addMonthsToKey("2026-10-22", 3), "2027-01-22")
})

test("getStockInfo : boîtes de 3 plaquettes, une boîte entamée + boîtes fermées", () => {
  // plaquette en cours : 10 restants ; 2 plaquettes d'avance dans la boîte entamée + 2 boîtes fermées (6) = 8 plaquettes
  const info = getStockInfo({
    pillType: "28_continu", packStartDate: "2026-10-01", perBox: 21, packsPerBox: 3,
    daysLeft: 10 + 8 * 21, todayKey: "2026-10-12", takenToday: false,
  })
  assert.equal(info.currentPackLeft, 10)
  assert.equal(info.reservePacks, 8)
  assert.equal(info.openBoxPacks, 2)
  assert.equal(info.closedBoxes, 2)
})

test("getStockInfo : sans réglage, une boîte = une plaquette", () => {
  const info = getStockInfo({
    pillType: "28_continu", packStartDate: "2026-10-01", perBox: 21,
    daysLeft: 10 + 3 * 21, todayKey: "2026-10-12", takenToday: false,
  })
  assert.equal(info.reservePacks, 3)
  assert.equal(info.openBoxPacks, 0)
  assert.equal(info.closedBoxes, 3)
})
