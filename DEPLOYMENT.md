# EAS Recruit — Deployment & Operations

This is the operational runbook: how to build, deploy, back up, monitor, and roll
back safely. The goal is to make changes safe, not to add product features.

---

## Architecture at a glance

| Piece | Where | Notes |
|-------|-------|-------|
| App source | this repo (`src/`) | Canonical for the **application**. |
| Build output | `.next/standalone` (git-ignored) | Produced by `next build` (`output: "standalone"`). |
| Runtime entrypoint | **`start.js` (proxy/paywall)** | ⚠️ **Not in source** — see below. |
| App server | `server.js` (inside the bundle) | The standalone Next.js server. |
| Database | `data/jobs.db` (SQLite, WAL) | git-ignored; lives on the host, **never** in the zip. |
| Process manager | PM2 (`ecosystem.config.js`) | app name `eas-recruit`, cwd `/home/ubuntu/eas-recruit`. |

### ⚠️ Production entrypoint (the biggest risk found)

PM2 runs **`start.js`**, but the `start.js` in *production* is **not the one in this
repo**. Production ships an ~820-line **reverse proxy + Stripe paywall**:

- Listens on `:3030`, spawns the Next server on `:3031`, and proxies between them.
- Serves the paywall routes itself (not the Next app):
  `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/status`,
  `/api/stripe/team`, `/api/stripe/grant-free`, `/api/stripe/webhook`,
  `/subscription/paywall`, `/subscription/success`, `/account/change-password`.
- Runs its **own SQLite migrations** on the `users` table
  (`stripe_customer_id`, `subscription_status`, `free_access`, `must_change_password`).
- Redirects unsubscribed users to `/subscription/paywall`.
- Hardcodes a **fallback `AUTH_SECRET`** and a `FREE_DOMAINS` allowlist.

The repo's `start.js` is only a 3-line keep-alive stub and **must not** be deployed
as-is (it would drop the paywall and change ports).

**Consequences / rules until this is reconciled (tracked for a follow-up sprint):**
1. A build "from source" does **not** reproduce the production launcher. **Do not
   overwrite the live `start.js`** during deploy (the deploy bundle deliberately
   excludes `start.js`).
2. The hardcoded fallback `AUTH_SECRET` is a security risk. **Ensure `AUTH_SECRET`
   is set in the environment** (the app itself already requires it) and, if the
   fallback was ever the effective secret, **rotate it**.
3. Subscription state is split across two tables (`users` via the proxy,
   `organizations` via the app). Don't assume one source of truth for billing.
4. Recommended next sprint: move the proxy paywall into the app (billing routes
   already exist under `/o/{slug}/billing/*`) so the entrypoint is in source.

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
- `server.js`, `package.json`
- `.next/` (standalone server chunks, `BUILD_ID`, manifests)
- `.next/static/` (CSS/JS assets — required or pages render unstyled)
- `.next/node_modules/` + top-level `node_modules/` (runtime deps)
- `public/`

### Files EXCLUDED (by design)
- `data/` — the live database (protected; see below)
- `start.js` — the production proxy/paywall is maintained on the host (see warning)
- `.env*`, `backups/`, source, tests, git history

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
   `git rev-parse --short deploy-<N>`. If it does, the running server is
   provably that tag's code.

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

### Deploy (does NOT overwrite DB or the proxy `start.js`)
```bash
cd /home/ubuntu/eas-recruit
# 1. Back up first (belt and braces):
node scripts/backup-db.mjs            # or: npm run backup

# 2. Unpack the new bundle WITHOUT clobbering data/ or start.js:
mkdir -p /tmp/rel && unzip -q /path/to/easrecruit-<ts>-<commit>.zip -d /tmp/rel
rsync -a --delete \
  --exclude 'data' --exclude 'start.js' \
  /tmp/rel/ /home/ubuntu/eas-recruit/

# 3. Restart:
pm2 restart eas-recruit --update-env
pm2 save
```
- Database protection: `data/` is **excluded** from both the zip and the rsync, so
  the live SQLite file is never overwritten.
- `start.js` is excluded from rsync, so the production proxy/paywall is preserved.

### Post-deploy verification
```bash
curl -s http://127.0.0.1:3030/api/health            # {"ok":true,"database":"reachable",...}
BASE_URL=https://easrecruit.ai SMOKE_ORG=<realOrg> SMOKE_JOB=<realJob> npm run smoke
pm2 logs eas-recruit --lines 50                      # scan for errors
```
- [ ] `/api/health` returns 200 with `database: reachable`.
- [ ] **Commit matches the release:** `curl -s .../api/health | grep -o '"commit":"[^"]*"'`
      equals `git rev-parse --short <release-tag>` (proves the deployed code).
- [ ] Smoke tests pass (public pages, no internal-origin leaks, admin requires auth).
- [ ] Spot-check: careers page, a job page, apply flow, feeds/sitemap/robots.

### Rollback
```bash
cd /home/ubuntu/eas-recruit
node scripts/backup-db.mjs                            # snapshot current state first
rsync -a --delete --exclude 'data' --exclude 'start.js' /tmp/rel-PREVIOUS/ ./
pm2 restart eas-recruit --update-env
curl -s http://127.0.0.1:3030/api/health
```
- Keep the **previous** deploy bundle (unzipped or zipped) so rollback is a re-sync.
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
    it should equal `git rev-parse --short <release-tag>` for the deployed
    release. `builtAt` is the build timestamp.
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
