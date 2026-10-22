import { cn } from "@/lib/utils"

const PILLOW =
  "M132 150 C200 128 312 128 380 150 C402 215 402 297 380 362 C312 384 200 384 132 362 C110 297 110 215 132 150 Z"

/**
 * Logo Pillow : un coussin et sa gélule, en aplats.
 * `tile` ajoute la tuile corail de l'icône d'application.
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
  const cushion = tile ? "#FFFFFF" : "currentColor"
  const half = tile ? "#1F1718" : "var(--background)"

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
      {tile && <rect width="512" height="512" rx="116" fill="#D2455A" />}
      <g transform={tile ? "translate(256 256) scale(1.04) translate(-256 -256)" : undefined}>
        <path d={PILLOW} fill={cushion} stroke={cushion} strokeWidth="3" strokeLinejoin="round" />
        <g transform="translate(256 256) rotate(-32)">
          <path d="M0 -34 H-58 A34 34 0 0 0 -58 34 H0 Z" fill={half} />
          <path d="M0 -34 H58 A34 34 0 0 1 58 34 H0 Z" fill="#D2455A" />
        </g>
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
      <LogoMark size={size} className="rounded-[22%]" />
      {showName && (
        <span className="text-[1.5rem] font-semibold leading-none tracking-tight text-foreground">
          Pillow
        </span>
      )}
    </span>
  )
}
