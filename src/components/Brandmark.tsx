import { getPlatformName } from "@/lib/env";

/**
 * EAS Recruit lockup: the silver-on-green lightning mark plus a two-tone
 * wordmark (first word graphite, remainder brand green), mirroring the logo.
 * Driven by PLATFORM_NAME so a custom deployment still renders sensibly.
 *
 * `onDark` flips the first word to white for the footer/hero grounds.
 */
export function Brandmark({
  markSize = 32,
  textClassName = "text-lg",
  onDark = false,
}: {
  markSize?: number;
  textClassName?: string;
  onDark?: boolean;
}) {
  const name = getPlatformName();
  const [first, ...rest] = name.split(" ");
  const remainder = rest.join(" ");

  return (
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/eas-mark.svg"
        alt=""
        width={markSize}
        height={markSize}
        className="shrink-0"
        style={{ width: markSize, height: markSize }}
      />
      <span className={`font-extrabold leading-none tracking-tight ${textClassName}`}>
        <span className={onDark ? "text-white" : "text-zinc-800"}>{first}</span>
        {remainder ? <span className="text-brand-600"> {remainder}</span> : null}
      </span>
    </span>
  );
}
