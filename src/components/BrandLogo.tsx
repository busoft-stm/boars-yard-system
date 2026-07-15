type BrandLogoProps = {
  className?: string
  size?: number
  alt?: string
}

export function BrandLogo({
  className = 'brand-logo',
  size = 42,
  alt = "Boar’s Head",
}: BrandLogoProps) {
  return (
    <img
      src="/boars_head_logo.webp"
      alt={alt}
      className={className}
      width={size}
      height={size}
      decoding="async"
    />
  )
}
