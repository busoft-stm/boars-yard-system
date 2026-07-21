import brandLogoUrl from '../assets/boars_head_logo.png'

type BrandLogoProps = {
  className?: string
  size?: number
  alt?: string
}

/** Bundled logo URL (emitted under /assets/…). */
export const BRAND_LOGO_SRC = brandLogoUrl

export function BrandLogo({
  className = 'brand-logo',
  size = 42,
  alt = "Boar’s Head",
}: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      className={className}
      width={size}
      height={size}
      decoding="async"
    />
  )
}
