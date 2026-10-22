import { cn } from "@/lib/utils"

/**
 * Animation de chargement Pillow : une gélule qui tourne sur elle-même,
 * avec son ombre qui respire. Remplace les spinners génériques.
 */
export function PillLoader({
  size = 56,
  className,
  label,
}: {
  size?: number
  className?: string
  label?: string
}) {
  return (
    <div role="status" aria-live="polite" className={cn("inline-flex flex-col items-center gap-3", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} className="animate-pill-spin overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="pl-l" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#eadccb" />
            </linearGradient>
            <linearGradient id="pl-r" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f592b5" />
              <stop offset="1" stopColor="#be4676" />
            </linearGradient>
          </defs>
          <g transform="translate(50 50)">
            <path d="M0 -17 H-21 A17 17 0 0 0 -21 17 H0 Z" fill="url(#pl-l)" />
            <path d="M0 -17 H21 A17 17 0 0 1 21 17 H0 Z" fill="url(#pl-r)" />
            <rect x="-38" y="-17" width="76" height="34" rx="17" fill="none" stroke="#6b2650" strokeOpacity="0.4" strokeWidth="1.4" />
            <rect x="-0.8" y="-17" width="1.6" height="34" fill="#6b2650" opacity="0.25" />
            <rect x="-31" y="-12.5" width="58" height="4.5" rx="2.25" fill="#fff" opacity="0.55" />
          </g>
        </svg>
        <div
          aria-hidden="true"
          className="animate-pill-shadow absolute left-1/2 -bottom-3 h-2 -translate-x-1/2 rounded-full bg-[color:var(--plum)] blur-[5px]"
          style={{ width: size * 0.7 }}
        />
      </div>
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : <span className="sr-only">Chargement…</span>}
    </div>
  )
}

/** Version miniature pour l'intérieur d'un bouton (remplace Loader2). */
export function PillSpinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn("size-4 animate-pill-spin", className)} aria-hidden="true">
      <g transform="translate(50 50)">
        <path d="M0 -20 H-18 A20 20 0 0 0 -18 20 H0 Z" fill="currentColor" opacity="0.55" />
        <path d="M0 -20 H18 A20 20 0 0 1 18 20 H0 Z" fill="currentColor" />
      </g>
    </svg>
  )
}
