import { getPlatformLogo, getPlatformName } from "@/lib/env";

/**
 * Brand lockup: emblem + "EAS Recruit" wordmark, matching the EAS Recruit
 * identity — metallic frame, EAS-green lightning bolt (electrical + automation).
 *
 * Use the compact lockup (emblem + wordmark) in the navbar. Pass `tagline` for
 * the full marketing lockup ("The right skills · The right fit · The right hire")
 * in heroes, the footer, and marketing surfaces only. To swap in an exact brand
 * asset, drop the file in /public and set PLATFORM_LOGO_SRC=/your-logo.svg.
 */
export function Logo({
  size = 34,
  wordmark = true,
  tagline = false,
  variant = "light",
}: {
  size?: number;
  wordmark?: boolean;
  /** Show the "The right skills · fit · hire" tagline under the wordmark. */
  tagline?: boolean;
  /** "light" for light backgrounds (dark wordmark), "dark" for dark backgrounds. */
  variant?: "light" | "dark";
}) {
  const logoSrc = getPlatformLogo();
  const name = getPlatformName();
  const wordClass = variant === "dark" ? "text-white" : "text-zinc-900";
  const taglineClass = variant === "dark" ? "text-slate-400" : "text-zinc-500";

  return (
    <span className="flex items-center gap-2.5">
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt={`${name} logo`} width={size} height={size} className="rounded-lg object-contain" />
      ) : (
        <Emblem size={size} />
      )}
      {wordmark ? (
        <span className="flex flex-col leading-none">
          <span className={`text-lg font-bold tracking-tight ${wordClass}`}>{name}</span>
          {tagline ? (
            <span className={`mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.22em] ${taglineClass}`}>
              The right skills · fit · hire
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The EAS emblem — an EAS-green lightning bolt (the electrical-automation mark)
 * set on a deep-charcoal tile with a brushed-silver frame. Self-contained SVG so
 * it needs no external asset and stays crisp at favicon size. Swap in the exact
 * brand file any time via PLATFORM_LOGO_SRC.
 */
export function Emblem({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="EAS Recruit emblem" className="flex-none">
      <defs>
        <linearGradient id="eas-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2434" />
          <stop offset="1" stopColor="#0a0e16" />
        </linearGradient>
        <linearGradient id="eas-frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6e9ee" />
          <stop offset="0.5" stopColor="#aeb5bf" />
          <stop offset="1" stopColor="#7c828c" />
        </linearGradient>
        <linearGradient id="eas-bolt" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#5fe070" />
          <stop offset="0.55" stopColor="#39b54a" />
          <stop offset="1" stopColor="#248f31" />
        </linearGradient>
      </defs>
      {/* Brushed-silver frame + charcoal tile */}
      <rect x="1" y="1" width="38" height="38" rx="9.5" fill="url(#eas-frame)" />
      <rect x="2.4" y="2.4" width="35.2" height="35.2" rx="8.2" fill="url(#eas-tile)" />
      {/* EAS-green lightning bolt — electrical + automation */}
      <path
        d="M23.8 6 L12.4 22.2 H19.2 L16.3 34 L28.2 16.6 H20.9 Z"
        fill="url(#eas-bolt)"
        stroke="#0a0e16"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Bright front edge so the bolt reads with depth */}
      <path d="M23.8 6 L12.4 22.2 H16.4 Z" fill="#8ff09a" opacity="0.55" />
    </svg>
  );
}
