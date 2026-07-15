type BrandLogoProps = {
  className?: string
  size?: number
  alt?: string
}

/** Public asset path that respects Vite `base` (GitHub Pages /boars-yard-system/). */
export const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}boars_head_logo.webp`

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
