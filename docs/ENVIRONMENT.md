# Environment variables

Set these where you already set `AUTH_SECRET` / `SMTP_PASS` for your deployment
(the Manus/PM2 environment, or a `.env` file the server loads). **Never commit
real secret values** — `.env*` is gitignored on purpose. After changing env
vars, restart the app.

Every integration below is **optional and dormant until its key is set**, and
all candidate-sourcing providers are **read-only** — none of them can affect how
applicant resumes are delivered (resumes always go to each org's own
`application_email`).

## Required

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Long random string; signs session cookies. |
| `BASE_URL` | Public URL of the deployment (used in links, feeds, and the apply URLs sent to job boards). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Outbound email — how applicant resumes and notifications are sent. |
| `FROM_EMAIL` / `FROM_NAME` | Optional sender identity (defaults to `SMTP_USER` / platform name). |

## Platform branding (optional)

| Variable | Default |
| --- | --- |
| `PLATFORM_NAME` | `EAS Recruit` |
| `PLATFORM_COMPANY` | `Electrical Automation Services Inc` |
| `PLATFORM_EMAIL` | `eas@eautomatedstaffing.com` |
| `PLATFORM_LOGO_SRC` | Empty (uses the built-in coil emblem). Set to e.g. `/logo.svg` after dropping your logo in `public/`. |

## AI (optional)

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Enables AI resume/skills-screen scoring and JD generation. A deterministic offline fallback works without it. |
| `ANTHROPIC_MODEL` | Optional model override (default `claude-opus-4-8`). |

## Candidate sourcing (optional — one env var per provider)

Each appears as a source on a job's **Source** page once its key is set.

| Variable | Provider | Notes |
| --- | --- | --- |
| `MANATAL_API_KEY` | Manatal ATS | Searches **your own** Manatal candidate database — best coverage for skilled trades. |
| `APOLLO_API_KEY` | Apollo.io | Passive-market people search + contact enrichment. |
| `PDL_API_KEY` | People Data Labs | General resume database (skews office/tech; thin on trades). |
| `APOLLO_BASE_URL` / `PDL_BASE_URL` / `MANATAL_BASE_URL` | — | Optional base-URL overrides (testing / regional endpoints). |

## Job distribution (optional)

| Variable | Purpose |
| --- | --- |
| `HUNDREDHIRES_API_KEY` | 100Hires — push published jobs. **Opt-in per organization** in the app (Job distribution → 100Hires → toggle). |
| `HUNDREDHIRES_BASE_URL` | Optional; default `https://api.100hires.com/v2`. |
| `HUNDREDHIRES_JOBS_PATH` | Optional; default `/jobs`. Adjust if 100Hires' create-job path differs. |

## Verifying after you set keys

- **Sourcing**: open a job → **Source** → pick the provider → **Find candidates**.
- **100Hires**: **Job distribution** → **100Hires** → **Test connection**, then **Post now** on a job.
- If any call errors, the app shows the provider's own error message — send it and the field mapping can be corrected quickly.
