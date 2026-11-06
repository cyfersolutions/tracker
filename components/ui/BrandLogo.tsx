import Image from "next/image";

/**
 * Cyfer Solutions wordmark. Renders the light and dark artwork and lets CSS
 * pick the right one for the active `data-theme`, so it never flashes.
 */
export function BrandLogo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={`brand-logo ${className}`.trim()}>
      <Image
        className="brand-logo-light"
        src="/brand/cyfer-logo.png"
        alt="Cyfer Solutions"
        width={1920}
        height={544}
        priority={priority}
      />
      <Image
        className="brand-logo-dark"
        src="/brand/cyfer-logo-dark.png"
        alt=""
        aria-hidden="true"
        width={1920}
        height={544}
        priority={priority}
      />
    </span>
  );
}

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <Image
      className="brand-mark-img"
      src="/brand/cyfer-favicon.png"
      alt="Cyfer Solutions"
      width={Math.round(size * 0.76)}
      height={size}
    />
  );
}
