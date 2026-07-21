import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Never cached: a health check must reflect the live process/DB on every hit.
export const dynamic = "force-dynamic";

let cachedVersion: string | null = null;
function appVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  if (cachedVersion !== null) return cachedVersion;
  let version = "unknown";
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    if (typeof pkg.version === "string") version = pkg.version;
  } catch {
    // package.json unreadable — fall back to "unknown".
  }
  cachedVersion = version;
  return version;
}

/**
 * Operational health probe for uptime monitors, load balancers, and the deploy
 * smoke test. Returns 200 only when the database is reachable; 503 otherwise so
 * a monitor can page on a real outage. No secrets, no auth — safe to expose.
 */
export function GET() {
  let databaseReachable = false;
  try {
    getDb().prepare("SELECT 1 AS ok").get();
    databaseReachable = true;
  } catch {
    databaseReachable = false;
  }

  return NextResponse.json(
    {
      ok: databaseReachable,
      service: "eas-recruit",
      version: appVersion(),
      // Baked at build time by next.config.ts (`env.GIT_COMMIT`), so a running
      // deploy self-reports the exact source commit it was built from. Falls
      // back to the Next build id, then "unknown".
      commit: process.env.GIT_COMMIT ?? process.env.BUILD_ID ?? "unknown",
      builtAt: process.env.BUILD_TIME ?? "unknown",
      uptimeSeconds: Math.round(process.uptime()),
      database: databaseReachable ? "reachable" : "unreachable",
      timestamp: new Date().toISOString(),
    },
    { status: databaseReachable ? 200 : 503 },
  );
}
