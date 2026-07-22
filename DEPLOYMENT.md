# EAS Recruit — Deployment & Operations

This is the operational runbook: how to build, deploy, back up, monitor, and roll
back safely. The goal is to make changes safe, not to add product features.

---

## Architecture at a glance

| Piece | Where | Notes |
|-------|-------|-------|
| App source | this repo (`src/`) | Canonical for the **application**. |
| Build output | `.next/standalone` (git-ignored) | Produced by `next build` (`output: "standalone"`). |
| Runtime entrypoint | **`start.js`** (proxy: email verification + rate limiting) | **Source-controlled** (Deploy 20) — shipped in the artifact. |
| App server | `server.js` (inside the bundle) | The standalone Next.js server. |
| Database | `data/jobs.db` (SQLite, WAL) | git-ignored; lives on the host, **never** in the zip. |
| Process manager | PM2 (`ecosystem.config.js`) | app name `eas-recruit`, cwd `/home/ubuntu/eas-recruit`. |

### Production entrypoint (`start.js`) — source-controlled since Deploy 20

PM2 runs **`start.js`**, a reverse proxy that spawns the Next server on `:3031`
and listens on `:3030`. As of Deploy 20 it is **the version in this repo** — the
prior "written in the sandbox, copied to prod by hand" drift is closed.

What it does:
- Adds `Connection: close` (avoids HTTP/1.1 keep-alive pool exhaustion on RSC prefetch).
- **Email verification**: intercepts `/api/auth/signup` (strips the session cookie
  so signup can't auto-login, emails a verification link), `/api/auth/login`
  (blocks unverified accounts with 403), `/api/auth/resend-verification`, and
  `GET /verify-email`. Tokens are 256-bit, SHA-256-hashed at rest, single-use,
  24-hour expiry.
- **Rate limiting** (durable, SQLite-backed) on register / login / resend →
  429 + `Retry-After`. Keyed by the trusted last-hop client IP (see below).
- **One-time** legacy `email_verified` backfill, guarded by a `proxy_migrations`
  row so it never re-runs on restart.

Secrets & config — all from the **environment**, nothing hardcoded:
`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`, `FROM_EMAIL`, `FROM_NAME`,
`PUBLIC_BASE_URL` (defaults to `https://easrecruit.ai`), `AUTH_SECRET`,
optional `TRUSTED_PROXY_HOPS` (default 1), `RL_REGISTER` / `RL_LOGIN` / `RL_RESEND`.

**Trusted-proxy / IP handling:** one hop (Nginx). The real client IP is the
**last** entry Nginx appends to `X-Forwarded-For`; client-supplied XFF entries
before it are ignored, so a spoofed header cannot shift the rate-limit key. Keep
the proxy port (`:3030`) private behind Nginx — do not expose it publicly.

The proxy contains **no Stripe/paywall logic** — billing lives entirely in the
Next app (`/api/o/{slug}/billing/*`, `/api/stripe/webhook`). `start.js` never
touches billing, candidate data, scoring, or job distribution.

---

## Build a deploy bundle (from source)

```bash
npm ci            # reproducible deps (first time / CI)
npm run deploy:build
```

`scripts/build-deploy.sh` runs, in order:

1. source hygiene check (warns if the tree is dirty),
2. **typecheck** (`tsc --noEmit`),
3. **lint** (`eslint`),
4. **build** (`next build`),
5. **assemble** the standalone bundle (`server.js` + `.next/static` + `public`),
6. **zip** it (asserts the zip contains **no** database),
7. **boot** the zip on an **ephemeral throwaway DB** and run the **smoke tests**.

Output: `deploy-dist/easrecruit-<timestamp>-<commit>.zip`.

### Build provenance — `GIT_COMMIT` (required)

Every build **must** bake the exact source commit into the artifact so the
running deploy is traceable back to source (see *Release tagging* below).

- `next.config.ts` resolves the commit at build time in this order:
  **`GIT_COMMIT` env → `git rev-parse --short HEAD` → `"unknown"`**, and exposes
  it (plus a build timestamp) via Next's `env` inlining. The value is compiled
  **into** the bundle, so `/api/health` self-reports the commit even if the
  runtime environment never sets `GIT_COMMIT`.
- `npm run deploy:build` sets `GIT_COMMIT` automatically (to the same short
  commit used in the zip name), so the zip name, the baked commit, and the
  release tag all agree.
- **When building by hand or in CI, set it explicitly** so a checkout without
  `.git` (or a detached/dirty tree) still bakes the right value:
  ```bash
  GIT_COMMIT="$(git rev-parse --short HEAD)" npm run build
  ```
- A build that reports `commit: "unknown"` at `/api/health` is **not
  deployable** — it cannot be matched to a source commit. Rebuild with
  `GIT_COMMIT` set.

### Files INCLUDED in the bundle/zip
- **`start.js`** — the source-controlled proxy (email verification + rate
  limiting). The build asserts the artifact copy is byte-identical to the source
  `start.js` (same SHA-256) and aborts on any mismatch.
- `server.js`, `package.json`
- `.next/` (standalone server chunks, `BUILD_ID`, manifests)
- `.next/static/` (CSS/JS assets — required or pages render unstyled)
- `node_modules/` (runtime deps) — includes **`nodemailer`** and
  **`better-sqlite3`** (kept external so `start.js` can `require()` them; no
  manual install on the host).
- `public/`

### Files EXCLUDED (by design)
- `data/` — the live database (protected; see below)
- `.env*`, `backups/`, source, tests, git history — **never** ship secrets or a DB

> Do **not** hand-edit compiled files under `.next/`. Change source and rebuild.

---

## Release tagging & traceability

Every production deploy must be pinned to an **exact source commit** and an
**annotated git tag**, so an audit can prove which code is live.

1. **Tag the released commit** (short, immutable, one per deploy):
   ```bash
   git tag -a deploy-<N> <commit> -m "Deploy <N>: <one-line summary>"
   git push origin deploy-<N>
   ```
   Example: `deploy-17` marks the audited Deploy 17 baseline.
2. **Build from that commit with the commit baked in** (see *Build provenance*),
   then deploy the resulting zip via the checklist below.
3. **Prove it after deploy:** `/api/health`'s `commit` must equal
   `git rev-parse --short "deploy-<N>^{commit}"`. If it does, the running server
   is provably that tag's code. (The `^{commit}` suffix dereferences an
   annotated tag to its commit; it is also correct for a lightweight tag.)

**What is (and isn't) a baseline artifact:**

| Artifact | Role | Traceable? |
|----------|------|------------|
| Git tag `deploy-<N>` + baked build | Deployable baseline | Yes — `/api/health.commit` ↔ `git rev-parse --short deploy-<N>` |
| Audit evidence zip (report + screenshots) | **Documentation only** | Describes a deploy; pins **no** commit, contains **no** source — never deploy it |

> The audit "zip" is a report plus screenshots. It is evidence *about* a deploy,
> not a deployable artifact. The reproducible baseline is the **tag + baked
> build**, not the evidence package.

---

## Deploy checklist

Assume the release lives at `/home/ubuntu/eas-recruit` and the DB at
`/home/ubuntu/eas-recruit/data/jobs.db`.

### Pre-deploy
- [ ] `git status` clean; correct branch/commit.
- [ ] `npm run deploy:build` passed (typecheck + lint + build + smoke all green).
- [ ] **Back up the database:** `npm run backup` (see Backups) and confirm the file exists.
- [ ] Copy the *current* live bundle aside for rollback (or keep the previous zip).
- [ ] Confirm `AUTH_SECRET` and required env are set in the environment.

### Deploy (ships the new source-controlled `start.js`; protects only `data/`)
As of Deploy 20 the reviewed `start.js` **is** in the artifact and is meant to
replace the running proxy. Back up the current proxy first, then deploy it.
```bash
cd /home/ubuntu/eas-recruit
# 1. Back up the DB and the CURRENT proxy (for rollback):
node scripts/backup-db.mjs                                  # or: npm run backup
cp start.js "start.js.bak.$(date -u +%Y%m%dT%H%M%SZ)"       # keep the live proxy

# 2. Unpack the new bundle WITHOUT clobbering the live DB:
mkdir -p /tmp/rel && unzip -q /path/to/easrecruit-<ts>-<commit>.zip -d /tmp/rel
rsync -a --delete --exclude 'data' /tmp/rel/ /home/ubuntu/eas-recruit/
#   ^ start.js IS synced now (it's the source-controlled proxy). data/ is not.

# 3. Restart (SMTP_* / AUTH_SECRET / PUBLIC_BASE_URL must be in the PM2 env):
pm2 restart eas-recruit --update-env
pm2 save

# 4. Prove the proxy on disk matches source (== the zip's start.js):
sha256sum start.js    # must equal the source/artifact start.js SHA-256
```
- **Database protection:** `data/` is excluded from both the zip and the rsync, so
  the live SQLite file is never overwritten.
- **`start.js` is now synced** (no `--exclude 'start.js'`) so production runs the
  reviewed, source-controlled proxy — no more hidden drift.
- **Dependencies:** the bundle already contains `nodemailer` + `better-sqlite3`.
  If you rebuild deps on the host instead, use `npm ci` (locked versions).

### Post-deploy verification
```bash
curl -s http://127.0.0.1:3030/api/health            # {"ok":true,"database":"reachable",...}
BASE_URL=https://easrecruit.ai SMOKE_ORG=<realOrg> SMOKE_JOB=<realJob> npm run smoke
pm2 logs eas-recruit --lines 50                      # scan for errors
```
- [ ] `/api/health` returns 200 with `database: reachable`.
- [ ] **Commit matches the release:** `curl -s .../api/health | grep -o '"commit":"[^"]*"'`
      equals `git rev-parse --short "<release-tag>^{commit}"` (proves the deployed code).
- [ ] Smoke tests pass (public pages, no internal-origin leaks, admin requires auth).
- [ ] Spot-check: careers page, a job page, apply flow, feeds/sitemap/robots.

### Rollback
```bash
cd /home/ubuntu/eas-recruit
node scripts/backup-db.mjs                            # snapshot current state first
rsync -a --delete --exclude 'data' /tmp/rel-PREVIOUS/ ./   # re-sync the previous bundle
# If rolling back to a release whose start.js differed, restore the saved proxy:
cp start.js.bak.<timestamp> start.js                  # the copy saved in step 1 above
pm2 restart eas-recruit --update-env
curl -s http://127.0.0.1:3030/api/health              # confirm commit + DB reachable
```
- Keep the **previous** deploy bundle (unzipped or zipped) and the saved
  `start.js.bak.<ts>` so rollback is a re-sync plus (if needed) a proxy restore.
- The database is backward-compatible within a release train (additive migrations),
  so rolling the app back does **not** require a DB restore. Restore the DB only if a
  migration or data corruption is the reason for rollback (see Backups → Restore).

---

## Backups

Script: `scripts/backup-db.mjs` (uses better-sqlite3's online `.backup()`, safe on a
live WAL database — no downtime, no torn reads). It **never writes** the live DB.

```bash
npm run backup
# or with overrides:
DB_PATH=./data/jobs.db BACKUP_DIR=./backups KEEP=14 node scripts/backup-db.mjs
```
- **Where backups live:** `./backups/jobs-YYYYMMDD-HHMMSS.db` (git-ignored, host-only).
- **Verification:** the script fails (non-zero exit) unless the backup file exists,
  is non-empty, and re-opens as a valid SQLite database.
- **Retention:** keeps the newest `KEEP` (default 14); older ones are pruned.

### Daily backups (cron)
```cron
15 2 * * *  cd /home/ubuntu/eas-recruit && node scripts/backup-db.mjs >> backups/backup.log 2>&1
```

### Restore
```bash
pm2 stop eas-recruit
cp data/jobs.db data/jobs.db.broken.$(date -u +%Y%m%d-%H%M%S)   # keep the bad copy
cp backups/jobs-YYYYMMDD-HHMMSS.db data/jobs.db
rm -f data/jobs.db-wal data/jobs.db-shm                         # drop stale WAL sidecars
pm2 start eas-recruit
curl -s http://127.0.0.1:3030/api/health
```

> This sprint keeps SQLite (no migration away from it). SQLite is fine for the
> current single-node scale; revisit only when horizontal scale is required.

---

## Email delivery

Module: `src/lib/email.ts` (nodemailer). Config comes from `SMTP_*` env
(`getSmtpConfig()` in `src/lib/env.ts`).

### Emails that exist
| Function | Trigger | Recipient | Failure behaviour |
|----------|---------|-----------|-------------------|
| `sendApplicationEmail` | New application | Org careers inbox | fire-and-forget (`void`); logs, app still stores the application |
| `sendApplicantConfirmationEmail` | New application | Applicant | fire-and-forget (`void`); logs only |
| `sendScreenInviteEmail` | "Send skills screen" | Candidate | gated by `isEmailConfigured()`; API returns `emailed:false` if unset |
| `sendDemoRequestNotification` | "Book a demo" | Platform inbox | `.catch()`; logs only |
| `sendCandidateEmail` | Candidate outreach | Candidate | best-effort |
| `sendTeamInviteEmail` | Team invite | Invitee | best-effort |
| `sendCareEscalationEmail` | Care escalation | Assignee/owner | best-effort |

### What fails silently
Application + applicant-confirmation emails are **fire-and-forget**: if SMTP is
unset or the send fails, the app logs `SMTP delivery failed (application still
saved)` / `Applicant confirmation email failed` and continues. **The application is
never lost** (it's stored and downloadable in the admin portal), but the org may not
get an email nudge. Everything else either guards on `isEmailConfigured()` or
swallows the error with a log.

### Required env
`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (required to send). Optional: `SMTP_PORT`
(587), `FROM_EMAIL` (defaults to `SMTP_USER`), `FROM_NAME`. When `SMTP_HOST/USER/PASS`
are unset, `isEmailConfigured()` is false and all outbound email is skipped.

### Verify delivery
```bash
npm run email:test -- --to you@example.com
```
Verifies the SMTP connection, then sends one test email. Exits non-zero (with the
reason) on any misconfiguration or send failure.

---

## Monitoring & logging

- **Health check:** `GET /api/health` → `{ ok, service, version, commit, builtAt,
  uptimeSeconds, database, timestamp }`. Returns **200** when the DB is reachable,
  **503** otherwise. Point uptime monitors / load balancers here.
  - `commit` is the **short source commit baked at build time** (see *Build
    provenance*). It is the field that lets you prove which code is running:
    it should equal `git rev-parse --short "<release-tag>^{commit}"` for the
    deployed release. `builtAt` is the build timestamp.
- **PM2 logs:** `pm2 logs eas-recruit` (default files under `~/.pm2/logs/eas-recruit-{out,error}.log`).
- **Restart:** `pm2 restart eas-recruit --update-env` · **Status:** `pm2 status` · **Boot persist:** `pm2 save`.

### Expected (non-critical) log lines
- `SMTP delivery failed (application still saved)` / `Applicant confirmation email failed`
  — SMTP not configured or a transient mail error. Application is still stored.
- `Resume text extraction skipped: ... Resume file was still stored` — an unparseable
  resume (e.g. a scanned/odd PDF). The file is stored; only auto-scoring is skipped.
- `[Paywall] DB migration complete` / `[EAS Recruit] Proxy listening` — proxy startup.

### Critical (page someone) log lines
- `/api/health` returning **503** or not responding — DB unreachable or app down.
- `Missing required environment variable: AUTH_SECRET` — app cannot verify sessions.
- Repeated PM2 restarts / `errored` status — a crash loop (`pm2 status`, check error log).
- `SqliteError` / `database is locked` / `disk I/O error` — database problem; check disk
  space and the WAL sidecars, restore from a backup if corrupt.

---

## Quick reference

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run build            # next build
npm run deploy:build     # full verified bundle + smoke test
npm run smoke            # smoke tests (BASE_URL=... SMOKE_ORG=... SMOKE_JOB=...)
npm run backup           # timestamped, verified DB backup
npm run email:test -- --to you@example.com
curl -s http://127.0.0.1:3030/api/health
pm2 restart eas-recruit --update-env
```
