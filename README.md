# EAS Recruit

Multi-organization recruiting platform by **Electrical Automation Services Inc**. Each organization gets its own careers portal, admin dashboard, applicant tracking, and job board syndication feeds.

## How it works

1. **Sign up** at `/signup` — create an organization with a resume delivery email
2. **Post jobs** in your admin portal at `/o/your-org/admin`
3. **Candidates apply** on your public careers page at `/o/your-org`
4. **Resumes are delivered** to the email address your organization configured (not a shared platform inbox)
5. **Syndicate** using your organization's Indeed XML feed and Google for Jobs markup

## Quick start

```bash
cd job-poster
npm install
cp .env.example .env.local   # configure SMTP + secrets
npm run dev
```

Open http://localhost:3000

## For Electrical Automation Services Inc

When you sign up, use:

- **Organization name:** Electrical Automation Services Inc
- **Portal slug:** `electrical-automation-services` (or similar)
- **Resume email:** your hiring inbox (can differ from `eas@eautomatedstaffing.com`)

Platform contact email: `eas@eautomatedstaffing.com`

## Organization URLs

| Page | URL |
|------|-----|
| Platform home | `/` |
| Sign up | `/signup` |
| Sign in | `/login` |
| Public careers | `/o/{org-slug}` |
| Job detail | `/o/{org-slug}/jobs/{job-slug}` |
| Admin portal | `/o/{org-slug}/admin` |
| Applicants | `/o/{org-slug}/admin/applicants` |
| Indeed XML feed | `/o/{org-slug}/feed/indeed.xml` |

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PLATFORM_NAME` | Brand name shown across the site (default: EAS Recruit) |
| `PLATFORM_COMPANY` | Parent company name |
| `PLATFORM_EMAIL` | Platform contact email |
| `AUTH_SECRET` | Session signing secret |
| `BASE_URL` | Public HTTPS URL when deployed |
| `SMTP_*` | Platform mail server for delivering applications to org inboxes |
| `APOLLO_API_KEY` | Optional. Enables outbound candidate sourcing (Apollo People Search) from a job. When unset, the "Source candidates" page shows a configure-me notice. |
| `ANTHROPIC_API_KEY` | Optional. Enables Claude-backed resume scoring, candidate outreach drafting, and AI job-description generation. Each feature falls back to its offline path when unset. |
| `ANTHROPIC_MODEL` | Optional. Overrides the Claude model used for the AI features (default: `claude-opus-4-8`). |

Each organization sets its own **resume delivery email** during signup. Applications are sent to that address with the resume attached, and also stored in the admin portal for download.

## Job board syndication

Register each organization's feed URL with job boards after deploying to HTTPS:

- **Indeed:** `https://yourdomain.com/o/{org-slug}/feed/indeed.xml`
- **Google for Jobs:** JSON-LD is embedded on each job page automatically

## Deploy notes

- SQLite database: `./data/jobs.db` (persist on your host)
- Platform SMTP sends mail on behalf of EAS Recruit to each organization's configured inbox
- After a new deployment, browser tabs left open on the old build may briefly show a
  "Server Action" cache error on their next submit. This is stale client JavaScript, not a
  server fault — a hard refresh (reload) clears it.

## Billing

Billing is served in **two places** today (see `DEPLOYMENT.md` → "Production entrypoint"):

- **In the app source:** per-organization routes under `/o/{org-slug}/billing/*` (`checkout`, `portal`).
- **In the production proxy (`start.js`, not in source):** the top-level `/api/stripe/checkout`,
  `/api/stripe/portal`, `/api/stripe/status`, `/api/stripe/team`, `/api/stripe/grant-free`, and
  `/api/stripe/webhook` routes, plus the `/subscription/paywall` gate. These run in the reverse
  proxy that fronts the Next.js server in production and are **not reproducible from this repo yet.**
  Reconciling the proxy paywall into the app is tracked as a follow-up (see DEPLOYMENT.md).
