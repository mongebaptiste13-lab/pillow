/**
 * Son des rappels (côté navigateur uniquement).
 *
 * Un site web ne peut pas imposer le son d'une notification système : quand l'app est
 * fermée, c'est le son de notification du téléphone qui joue. En revanche, dès que l'app est
 * ouverte (même en arrière-plan), le service worker nous prévient et on joue le son choisi ici.
 * Le réglage est propre à chaque appareil (localStorage).
 */

export type SoundId = "pot" | "chime" | "bell" | "drop" | "pop" | "alarm" | "custom"

export interface SoundSettings {
  enabled: boolean
  id: SoundId
  /** Fichier audio personnel (data URL) */
  custom: string | null
  customName: string | null
}

export const SOUND_PRESETS: Array<{ id: Exclude<SoundId, "custom">; label: string; hint: string }> = [
  { id: "pot", label: "Pilule dans le pot", hint: "Une pilule qui tombe et rebondit dans un pot" },
  { id: "chime", label: "Carillon", hint: "Trois notes douces" },
  { id: "bell", label: "Cloche", hint: "Une note ronde qui résonne" },
  { id: "drop", label: "Goutte", hint: "Court et discret" },
  { id: "pop", label: "Pop", hint: "Deux petits claquements" },
  { id: "alarm", label: "Réveil doux", hint: "Trois bips réguliers" },
]

const KEY = "pillow:sound"
/** Taille max du fichier personnel (le stockage local du navigateur est limité). */
export const MAX_CUSTOM_BYTES = 700 * 1024

export const DEFAULT_SOUND: SoundSettings = { enabled: true, id: "pot", custom: null, customName: null }

export function getSoundSettings(): SoundSettings {
  if (typeof window === "undefined") return DEFAULT_SOUND
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SOUND
    const parsed = JSON.parse(raw) as Partial<SoundSettings>
    const id = parsed.id === "custom" && !parsed.custom ? "pot" : parsed.id
    return {
      enabled: parsed.enabled !== false,
      id: (SOUND_PRESETS.some((p) => p.id === id) || id === "custom" ? id : "pot") as SoundId,
      custom: typeof parsed.custom === "string" ? parsed.custom : null,
      customName: typeof parsed.customName === "string" ? parsed.customName : null,
    }
  } catch {
    return DEFAULT_SOUND
  }
}

/** Retourne false si l'enregistrement échoue (stockage plein ou bloqué). */
export function saveSoundSettings(settings: SoundSettings): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

export function readAudioFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("audio/")) return reject(new Error("Ce fichier n'est pas un son."))
    if (file.size > MAX_CUSTOM_BYTES) return reject(new Error("Fichier trop lourd (700 Ko maximum). Choisis un son court."))
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."))
    reader.readAsDataURL(file)
  })
}

/* ------------------------------ synthèse ------------------------------ */

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined)
  return ctx
}

interface Tone {
  freq: number
  at: number
  dur: number
  type?: OscillatorType
  gain?: number
  /** Fréquence finale (glissando) */
  to?: number
}

const PATTERNS: Record<Exclude<SoundId, "custom" | "pot">, Tone[]> = {
  chime: [
    { freq: 1046.5, at: 0, dur: 0.9 },
    { freq: 1318.5, at: 0.18, dur: 0.9 },
    { freq: 1568, at: 0.36, dur: 1.2 },
  ],
  bell: [
    { freq: 660, at: 0, dur: 1.8, gain: 0.5 },
    { freq: 1320, at: 0, dur: 1.2, gain: 0.22 },
    { freq: 1980, at: 0, dur: 0.8, gain: 0.12 },
  ],
  drop: [{ freq: 900, to: 320, at: 0, dur: 0.28, gain: 0.55 }],
  pop: [
    { freq: 520, to: 900, at: 0, dur: 0.12, type: "triangle", gain: 0.5 },
    { freq: 520, to: 900, at: 0.2, dur: 0.12, type: "triangle", gain: 0.5 },
  ],
  alarm: [
    { freq: 880, at: 0, dur: 0.16, type: "triangle", gain: 0.45 },
    { freq: 880, at: 0.28, dur: 0.16, type: "triangle", gain: 0.45 },
    { freq: 880, at: 0.56, dur: 0.16, type: "triangle", gain: 0.45 },
  ],
}

function playTones(tones: Tone[]) {
  const audio = getContext()
  if (!audio) return
  const start = audio.currentTime + 0.02
  for (const tone of tones) {
    const osc = audio.createOscillator()
    const amp = audio.createGain()
    const t0 = start + tone.at
    osc.type = tone.type ?? "sine"
    osc.frequency.setValueAtTime(tone.freq, t0)
    if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, t0 + tone.dur)
    const peak = tone.gain ?? 0.4
    amp.gain.setValueAtTime(0.0001, t0)
    amp.gain.exponentialRampToValueAtTime(peak, t0 + 0.015)
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.dur)
    osc.connect(amp).connect(audio.destination)
    osc.start(t0)
    osc.stop(t0 + tone.dur + 0.05)
  }
}

/* Pilule qui tombe dans un pot : un choc creux de plastique puis des rebonds de plus en plus rapprochés et faibles */
interface Click {
  at: number
  gain: number
  /** Fréquence centrale du claquement (Hz) */
  freq: number
}

const POT_CLICKS: Click[] = [
  { at: 0, gain: 1, freq: 3200 },
  { at: 0.11, gain: 0.75, freq: 3800 },
  { at: 0.195, gain: 0.58, freq: 2900 },
  { at: 0.26, gain: 0.42, freq: 4200 },
  { at: 0.31, gain: 0.3, freq: 3400 },
  { at: 0.35, gain: 0.2, freq: 4600 },
  { at: 0.38, gain: 0.12, freq: 3900 },
  // la pilule se pose, une autre roule contre la paroi
  { at: 0.52, gain: 0.35, freq: 2500 },
  { at: 0.57, gain: 0.22, freq: 3100 },
]

function playPot() {
  const audio = getContext()
  if (!audio) return
  const start = audio.currentTime + 0.02

  // Bruit blanc court réutilisé pour tous les claquements
  const length = Math.floor(audio.sampleRate * 0.06)
  const noise = audio.createBuffer(1, length, audio.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1

  for (const click of POT_CLICKS) {
    const t0 = start + click.at
    const src = audio.createBufferSource()
    src.buffer = noise
    const band = audio.createBiquadFilter()
    band.type = "bandpass"
    band.frequency.value = click.freq
    band.Q.value = 1.6
    const amp = audio.createGain()
    amp.gain.setValueAtTime(0.0001, t0)
    amp.gain.exponentialRampToValueAtTime(0.9 * click.gain, t0 + 0.002)
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035)
    src.connect(band).connect(amp).connect(audio.destination)
    src.start(t0)
    src.stop(t0 + 0.06)
  }

  // Résonance creuse du pot à l'impact (et un peu plus faible au dernier rebond)
  for (const hit of [{ at: 0, gain: 0.4 }, { at: 0.11, gain: 0.18 }, { at: 0.52, gain: 0.1 }]) {
    const t0 = start + hit.at
    const osc = audio.createOscillator()
    const amp = audio.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(520, t0)
    osc.frequency.exponentialRampToValueAtTime(330, t0 + 0.11)
    amp.gain.setValueAtTime(0.0001, t0)
    amp.gain.exponentialRampToValueAtTime(hit.gain, t0 + 0.004)
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13)
    osc.connect(amp).connect(audio.destination)
    osc.start(t0)
    osc.stop(t0 + 0.15)
  }
}

/** Joue un son précis (aperçu dans les réglages). Les navigateurs exigent un geste préalable sur la page. */
export async function playSound(id: SoundId, custom: string | null = null): Promise<boolean> {
  try {
    if (id === "custom") {
      if (!custom) return false
      const audio = new Audio(custom)
      await audio.play()
      return true
    }
    if (id === "pot") playPot()
    else playTones(PATTERNS[id])
    return true
  } catch {
    return false
  }
}

/** Son d'un rappel reçu : respecte le réglage de cet appareil. */
export async function playReminderSound(): Promise<boolean> {
  const settings = getSoundSettings()
  if (!settings.enabled) return false
  return playSound(settings.id, settings.custom)
}
