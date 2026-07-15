import type { CSSProperties } from 'react'

export type MaterialIconProps = {
  /** Material Symbols ligature name, e.g. `settings`, `notifications`. */
  name: string
  size?: number
  className?: string
  filled?: boolean
  weight?: number
  opticalSize?: number
}

/** Google Material Symbols Outlined icon. */
export function MaterialIcon({
  name,
  size = 20,
  className = '',
  filled = false,
  weight = 400,
  opticalSize = 24,
}: MaterialIconProps) {
  const style: CSSProperties = {
    fontSize: size,
    fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${opticalSize}`,
  }

  return (
    <span
      className={`material-symbols-outlined ${className}`.trim()}
      style={style}
      aria-hidden
    >
      {name}
    </span>
  )
}
