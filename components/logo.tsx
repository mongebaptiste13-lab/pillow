import { useId } from "react"
import { cn } from "@/lib/utils"

const PILLOW =
  "M132 150 C200 128 312 128 380 150 C402 215 402 297 380 362 C312 384 200 384 132 362 C110 297 110 215 132 150 Z"

/**
 * Logo Pillow : un coussin doré avec sa gélule.
 * `tile` ajoute le fond aubergine de l'icône d'application.
 */
export function LogoMark({
  size = 40,
  tile = true,
  className,
  title = "Pillow",
}: {
  size?: number
  tile?: boolean
  className?: string
  title?: string
}) {
  const uid = useId().replace(/:/g, "")
  const id = (name: string) => `${name}-${uid}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={id("bg")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#43203A" />
          <stop offset="1" stopColor="#170B15" />
        </linearGradient>
        <radialGradient id={id("glow")} cx="0.82" cy="0.12" r="0.75">
          <stop offset="0" stopColor="#E0709A" stopOpacity="0.45" />
          <stop offset="1" stopColor="#E0709A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FBE9B7" />
          <stop offset="0.5" stopColor="#E4BB69" />
          <stop offset="1" stopColor="#B58332" />
        </linearGradient>
        <linearGradient id={id("edge")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF4D2" />
          <stop offset="1" stopColor="#8F6522" />
        </linearGradient>
        <radialGradient id={id("puff")} cx="0.32" cy="0.28" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("pl")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#EBDCCB" />
        </linearGradient>
        <linearGradient id={id("pr")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F592B5" />
          <stop offset="1" stopColor="#BE4676" />
        </linearGradient>
        <filter id={id("blur")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={id("soft")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      {tile && (
        <>
          <rect width="512" height="512" rx="116" fill={`url(#${id("bg")})`} />
          <rect width="512" height="512" rx="116" fill={`url(#${id("glow")})`} />
          <rect x="9" y="9" width="494" height="494" rx="108" fill="none" stroke="#E4BB69" strokeOpacity="0.28" strokeWidth="2" />
        </>
      )}

      <g transform={tile ? "translate(256 256) scale(1.04) translate(-256 -256)" : undefined}>
        <ellipse cx="262" cy="386" rx="128" ry="16" fill="#000" opacity="0.3" filter={`url(#${id("soft")})`} />
        <path d={PILLOW} fill={`url(#${id("gold")})`} stroke={`url(#${id("edge")})`} strokeWidth="3" strokeLinejoin="round" />
        <path d={PILLOW} fill={`url(#${id("puff")})`} />
        <g fill="none" stroke="#8F6522" strokeOpacity="0.45" strokeWidth="3.5" strokeLinecap="round">
          <path d="M132 150 q26 4 40 28" />
          <path d="M380 150 q-26 4 -40 28" />
          <path d="M132 362 q26 -4 40 -28" />
          <path d="M380 362 q-26 -4 -40 -28" />
        </g>
        <g transform="translate(256 252) rotate(-32)">
          <ellipse cx="8" cy="30" rx="86" ry="12" fill="#3B1530" opacity="0.45" filter={`url(#${id("blur")})`} />
          <path d="M0 -34 H-58 A34 34 0 0 0 -58 34 H0 Z" fill={`url(#${id("pl")})`} />
          <path d="M0 -34 H58 A34 34 0 0 1 58 34 H0 Z" fill={`url(#${id("pr")})`} />
          <rect x="-92" y="-34" width="184" height="68" rx="34" fill="none" stroke="#6B2650" strokeOpacity="0.45" strokeWidth="2.5" />
          <rect x="-1.5" y="-34" width="3" height="68" fill="#6B2650" opacity="0.25" />
          <rect x="-78" y="-25" width="148" height="9" rx="4.5" fill="#fff" opacity="0.55" />
        </g>
        <path
          transform="translate(388 134)"
          d="M0 -26 Q4 -4 26 0 Q4 4 0 26 Q-4 4 -26 0 Q-4 -4 0 -26 Z"
          fill="#FFF3CF"
        />
      </g>
    </svg>
  )
}

/** Logo + nom, pour les en-têtes et l'écran de connexion. */
export function Logo({
  size = 36,
  showName = true,
  className,
}: {
  size?: number
  showName?: boolean
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} className="drop-shadow-[0_4px_10px_rgba(67,32,58,0.35)]" />
      {showName && (
        <span className="font-display text-[1.7rem] font-semibold leading-none tracking-tight text-foreground">
          Pillow
        </span>
      )}
    </span>
  )
}
