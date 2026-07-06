import { getPlatformLogo, getPlatformName } from "@/lib/env";

/**
 * Brand lockup: emblem + "EAS Recruit" wordmark.
 *
 * The emblem is a self-contained SVG (a steel lightning bolt inside a hex —
 * electrical + automation) so it needs no external asset and stays crisp at any
 * size. To use your own logo instead, drop the file in /public and set
 * PLATFORM_LOGO_SRC=/your-logo.svg — it renders in place of the built-in mark.
 */
export function Logo({
  size = 34,
  wordmark = true,
  variant = "light",
}: {
  size?: number;
  wordmark?: boolean;
  /** "light" for light backgrounds (dark wordmark), "dark" for dark backgrounds. */
  variant?: "light" | "dark";
}) {
  const logoSrc = getPlatformLogo();
  const name = getPlatformName();
  const wordClass = variant === "dark" ? "text-white" : "text-zinc-900";

  return (
    <span className="flex items-center gap-2.5">
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt={`${name} logo`} width={size} height={size} className="rounded-lg object-contain" />
      ) : (
        <Emblem size={size} />
      )}
      {wordmark ? (
        <span className={`text-lg font-bold tracking-tight ${wordClass}`}>{name}</span>
      ) : null}
    </span>
  );
}

/**
 * The EAS emblem — the green automation coil, on a graphite tile. A crisp SVG
 * rendition of the brand mark (stacked helical loops). Swap in your exact logo
 * file any time via PLATFORM_LOGO_SRC.
 */
export function Emblem({ size = 34 }: { size?: number }) {
  // Loops of the coil, arranged diagonally like a spring viewed at an angle.
  const loops = [
    { cx: 23.2, cy: 11, rx: 7.0, ry: 2.5 },
    { cx: 22.0, cy: 14.6, rx: 7.3, ry: 2.6 },
    { cx: 20.8, cy: 18.3, rx: 7.5, ry: 2.7 },
    { cx: 19.6, cy: 22.0, rx: 7.5, ry: 2.7 },
    { cx: 18.4, cy: 25.7, rx: 7.3, ry: 2.6 },
    { cx: 17.2, cy: 29.3, rx: 7.0, ry: 2.5 },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="EAS coil emblem" className="flex-none">
      <defs>
        <linearGradient id="eas-coil-grad" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#6FE06F" />
          <stop offset="1" stopColor="#248F31" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="40" height="40" rx="9" fill="#131418" />
      <g fill="none" stroke="url(#eas-coil-grad)" strokeWidth="2.6" strokeLinecap="round">
        {loops.map((l, i) => (
          <ellipse key={i} cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry} />
        ))}
      </g>
      {/* Bright front-edge highlight so the coil reads as 3-D like the logo. */}
      <g fill="none" stroke="#8FF08F" strokeWidth="1.1" strokeLinecap="round" opacity="0.9">
        {loops.map((l, i) => (
          <path key={i} d={`M ${l.cx - l.rx} ${l.cy} A ${l.rx} ${l.ry} 0 0 0 ${l.cx + l.rx} ${l.cy}`} />
        ))}
      </g>
    </svg>
  );
}
