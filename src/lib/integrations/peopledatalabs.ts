import { getPdlConfig } from "../env";
import type { Job } from "../db";
import { extractSkills } from "../skills";
import type { SourcedCandidate, SourcingResult } from "../sourcing";

/**
 * People Data Labs (PDL) resume/candidate database search.
 *
 * Read-only: turns a job posting into a PDL Person Search and returns candidate
 * profiles (title, company, location, skills, work history signal) in the same
 * shape as the Apollo sourcing seam, so the existing UI renders them unchanged.
 *
 * Fully separate from resume delivery — this is a manual search a recruiter
 * runs; it never sends or intercepts an applicant's resume. Dormant until
 * PDL_API_KEY is set; base URL overridable via PDL_BASE_URL.
 *
 * Note: general resume databases skew white-collar, so coverage of maintenance/
 * controls/electrical trades is thin. Surfaced as an optional source, not the
 * primary pipeline.
 */

const REQUEST_TIMEOUT_MS = 12_000;
const SEARCH_PATH = "/person/search";

type PdlPerson = {
  id?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  job_company_name?: string | null;
  location_name?: string | null;
  linkedin_url?: string | null;
  skills?: string[] | null;
  work_email?: string | null;
  emails?: Array<{ address?: string | null } | string> | null;
};

type PdlSearchResponse = {
  status?: number;
  data?: PdlPerson[];
  error?: { message?: string } | string;
};

function buildQuery(job: Job, jobSkills: string[]): Record<string, unknown> {
  const should: Record<string, unknown>[] = jobSkills.slice(0, 6).map((skill) => ({ match: { skills: skill } }));
  const location = [job.city, job.state].filter(Boolean).join(", ") || job.location;
  if (location) should.push({ match: { location_name: location } });

  return {
    bool: {
      // A job-title match keeps the search from being "too broad" (PDL rejects
      // unbounded queries); skills/location bias the ranking.
      must: [{ match: { job_title: job.title } }],
      should,
    },
  };
}

function normalizeLinkedin(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function firstEmail(person: PdlPerson): string | null {
  if (person.work_email) return person.work_email;
  const first = person.emails?.[0];
  if (typeof first === "string") return first;
  return first?.address ?? null;
}

export async function searchResumesPdl(job: Job): Promise<SourcingResult> {
  const cfg = getPdlConfig();
  if (!cfg.enabled) return { status: "not_configured" };

  const jobSkills = extractSkills(`${job.title} ${job.description}`);
  const jobSkillSet = new Set(jobSkills);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.baseUrl}${SEARCH_PATH}`, {
      method: "POST",
      headers: { "X-Api-Key": cfg.apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: buildQuery(job, jobSkills), size: 10, pretty: false }),
      signal: controller.signal,
    });

    const text = await res.text();
    let data: PdlSearchResponse = {};
    try {
      data = text ? (JSON.parse(text) as PdlSearchResponse) : {};
    } catch {
      data = {};
    }

    if (!res.ok) {
      const message =
        typeof data.error === "string"
          ? data.error
          : data.error?.message ?? text.slice(0, 300) ?? `HTTP ${res.status}`;
      // No matches is a normal 404 in PDL, not an error.
      if (res.status === 404) return { status: "ok", candidates: [], jobSkills };
      return { status: "error", message: `People Data Labs: ${message}` };
    }

    const candidates: SourcedCandidate[] = (data.data ?? []).map((person) => {
      const skills = (person.skills ?? []).filter((s): s is string => typeof s === "string");
      const matchedSkills = skills.filter((s) => jobSkillSet.has(s) || jobSkillSet.has(extractSkills(s)[0] ?? ""));
      const matchScore =
        jobSkills.length > 0 ? Math.round((matchedSkills.length / jobSkills.length) * 100) : null;
      const email = firstEmail(person);
      return {
        apolloId: person.id ?? null,
        name: person.full_name ?? ([person.first_name, person.last_name].filter(Boolean).join(" ") || "Unknown"),
        firstName: person.first_name ?? null,
        lastName: person.last_name ?? null,
        title: person.job_title ?? "",
        company: person.job_company_name ?? "",
        location: person.location_name ?? "",
        linkedinUrl: normalizeLinkedin(person.linkedin_url),
        emailStatus: email ?? null,
        matchScore,
        matchedSkills,
      };
    });

    return { status: "ok", candidates, jobSkills };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "People Data Labs request timed out."
        : error instanceof Error
          ? error.message
          : "People Data Labs request failed.";
    return { status: "error", message };
  } finally {
    clearTimeout(timer);
  }
}
