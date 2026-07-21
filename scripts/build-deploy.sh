#!/usr/bin/env bash
#
# Build a verified EAS Recruit deploy bundle FROM SOURCE.
#
# Runs: typecheck -> lint -> build -> assemble standalone bundle -> zip ->
# boot the zip on an EPHEMERAL throwaway database and run the smoke tests.
#
# It never touches the live database and never bundles one. It also does NOT
# include the production proxy `start.js` (the Stripe/paywall launcher, which is
# not yet in source — see DEPLOYMENT.md "Production entrypoint"). On deploy you
# preserve the existing start.js and data/ (see DEPLOYMENT.md checklist).
#
# Usage:  bash scripts/build-deploy.sh
# Env:    VERIFY_PORT (default 3399), OUT_DIR (default deploy-dist), SKIP_LINT=1
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

VERIFY_PORT="${VERIFY_PORT:-3399}"
OUT_DIR="${OUT_DIR:-deploy-dist}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
BUNDLE="$OUT_DIR/bundle"
ZIP="$OUT_DIR/easrecruit-${STAMP}-${COMMIT}.zip"

step() { echo; echo "==> $*"; }

# ── 0. Source hygiene ────────────────────────────────────────────────────────
step "0. Source check (branch $(git branch --show-current 2>/dev/null || echo '?'), HEAD ${COMMIT})"
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "    WARNING: working tree is dirty — the bundle will include uncommitted changes."
fi

# ── 1. Typecheck ─────────────────────────────────────────────────────────────
step "1. Typecheck (tsc --noEmit)"
npx tsc --noEmit

# ── 2. Lint ──────────────────────────────────────────────────────────────────
if [ "${SKIP_LINT:-0}" = "1" ]; then
  step "2. Lint (skipped via SKIP_LINT=1)"
else
  step "2. Lint (eslint)"
  npm run lint
fi

# ── 3. Build ─────────────────────────────────────────────────────────────────
step "3. Production build (next build, output: standalone)"
rm -rf .next
# Bake the exact commit into the artifact (next.config.ts reads GIT_COMMIT), so
# the deployed build's /api/health reports a commit that matches this zip's
# name and the release tag — provenance travels with the bundle.
GIT_COMMIT="$COMMIT" npm run build

# ── 4. Assemble standalone bundle ────────────────────────────────────────────
step "4. Assemble bundle -> $BUNDLE"
rm -rf "$OUT_DIR"
mkdir -p "$BUNDLE"
cp -r .next/standalone/. "$BUNDLE"/
mkdir -p "$BUNDLE/.next/static"
cp -r .next/static/. "$BUNDLE/.next/static"/
if [ -d public ]; then cp -r public "$BUNDLE/public"; fi
# Never ship a database.
rm -rf "$BUNDLE/data"
echo "    bundle assembled ($(du -sh "$BUNDLE" | cut -f1))"

# ── 5. Zip ───────────────────────────────────────────────────────────────────
step "5. Create deploy zip -> $ZIP"
( cd "$BUNDLE" && zip -rq "$REPO/$ZIP" . -x "data/*" )
echo "    $(du -h "$ZIP" | cut -f1)  $ZIP"
if unzip -l "$ZIP" | grep -q "data/jobs.db"; then
  echo "    ERROR: deploy zip contains a database — aborting."; exit 1
fi
echo "    verified: no database in the zip"

# ── 6. Boot-verify on an ephemeral database + smoke tests ────────────────────
step "6. Boot the bundle on a throwaway DB and run smoke tests (port ${VERIFY_PORT})"
SRV_PID=""
cleanup() {
  # `node server.js` forks a next-server worker that binds the port. Because the
  # launch below uses `exec`, SRV_PID *is* node and the worker is its direct
  # child — reap the worker first, then node, or the worker orphans and keeps
  # the port (→ EADDRINUSE on the next run).
  if [ -n "$SRV_PID" ]; then
    pkill -TERM -P "$SRV_PID" 2>/dev/null || true
    kill "$SRV_PID" 2>/dev/null || true
  fi
  rm -rf "$BUNDLE/data"   # remove the throwaway DB created during verification
}
trap cleanup EXIT

# Pre-flight: free the port if a stale verifier from a previous run still holds
# it, so this run doesn't silently smoke-test the wrong (orphaned) server.
command -v fuser >/dev/null 2>&1 && fuser -k "${VERIFY_PORT}/tcp" 2>/dev/null || true

# `exec` replaces the subshell with node, so SRV_PID tracks node itself (not the
# subshell) — cleanup can then reliably reap node and its next-server worker.
( cd "$BUNDLE" && PORT="$VERIFY_PORT" HOSTNAME=127.0.0.1 \
    AUTH_SECRET="deploy-verify-secret" GIT_COMMIT="$COMMIT" \
    exec node server.js >"$REPO/$OUT_DIR/verify-server.log" 2>&1 ) &
SRV_PID=$!

# Wait for the app; /api/health also initialises the DB schema.
ready=""
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${VERIFY_PORT}/api/health" 2>/dev/null; then ready=1; break; fi
  sleep 1
done
[ -n "$ready" ] || { echo "    ERROR: app did not become ready"; tail -20 "$OUT_DIR/verify-server.log" || true; exit 1; }

DB_PATH="$BUNDLE/data/jobs.db" node scripts/seed-smoke.mjs
BASE_URL="http://127.0.0.1:${VERIFY_PORT}" SMOKE_ORG="smoke-co" SMOKE_JOB="smoke-electrician" SMOKE_APPLY=1 \
  node scripts/smoke-test.mjs

step "DONE"
echo "    Deploy zip ready: $ZIP"
echo "    Next: follow DEPLOYMENT.md — back up the DB, deploy WITHOUT overwriting"
echo "    the live data/ or the production start.js, then restart PM2 and verify."
