import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/**
 * Build-time provenance.
 *
 * Bake the exact source commit (and build time) into the artifact so
 * `/api/health` can report what code is actually running — making a deployed
 * build traceable back to a source commit. Resolution order:
 *   1. an explicit `GIT_COMMIT` env (set by CI or the deploy build), else
 *   2. the local git checkout (`git rev-parse --short HEAD`), else
 *   3. "unknown".
 * Next inlines `env` values at build time, so the running server self-reports
 * its commit even when the runtime environment never sets `GIT_COMMIT`.
 */
function resolveGitCommit(): string {
  const fromEnv = process.env.GIT_COMMIT?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

const GIT_COMMIT = resolveGitCommit();
const BUILD_TIME = new Date().toISOString();

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep these external so their bundled worker/asset files (e.g. pdf-parse's
  // PDF worker) resolve from node_modules at runtime instead of being traced
  // into the server chunks, where they go missing.
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "mammoth", "sharp"],
  // Baked at build time (see resolveGitCommit) and read by /api/health so a
  // running deploy is traceable to its exact source commit.
  env: {
    GIT_COMMIT,
    BUILD_TIME,
  },
};

export default nextConfig;
