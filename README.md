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
| `ANTHROPIC_API_KEY` | Optional. Reserved for LLM-backed resume scoring; the offline heuristic is used when unset. |

Each organization sets its own **resume delivery email** during signup. Applications are sent to that address with the resume attached, and also stored in the admin portal for download.

## Job board syndication

Register each organization's feed URL with job boards after deploying to HTTPS:

- **Indeed:** `https://yourdomain.com/o/{org-slug}/feed/indeed.xml`
- **Google for Jobs:** JSON-LD is embedded on each job page automatically

## Deploy notes

- SQLite database: `./data/jobs.db` (persist on your host)
- Platform SMTP sends mail on behalf of EAS Recruit to each organization's configured inbox
