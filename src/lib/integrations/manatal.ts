import { getManatalConfig } from "../env";
import type { Job } from "../db";
import { extractSkills } from "../skills";
import type { SourcedCandidate, SourcingResult } from "../sourcing";

/**
 * Manatal candidate search.
 *
 * Searches the org's OWN Manatal ATS database (the candidates they've already
 * sourced) from a job posting — for a staffing agency this is the highest-signal
 * source of real skilled-trades candidates. Read-only: it never sends or
 * intercepts an applicant's resume, and resume delivery is untouched.
 *
 * Manatal is a Django-REST API: Token auth, GET /candidates/?search=…&page=1,
 * paginated `results`. Field names vary a little by account, so mapping is
 * defensive and Manatal's own error text is surfaced. Dormant until
 * MANATAL_API_KEY is set; base URL overridable via MANATAL_BASE_URL.
 */

const REQUEST_TIMEOUT_MS = 12_000;

type ManatalCandidate = {
  id?: number | string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  emails?: string[] | null;
  current_position?: string | null;
  current_employer?: string | null;
  current_company?: string | null;
  address?: string | null;
  location?: string | null;
  skills?: Array<string | { name?: string }> | null;
  linkedin_url?: string | null;
};

type ManatalListResponse = {
  count?: number;
  results?: ManatalCandidate[];
  detail?: string;
  error?: string;
};

function candidateSkills(candidate: ManatalCandidate): string[] {
  return (candidate.skills ?? [])
    .map((s) => (typeof s === "string" ? s : s?.name ?? ""))
    .filter((s): s is string => Boolean(s));
}

function firstEmail(candidate: ManatalCandidate): string | null {
  if (candidate.email) return candidate.email;
  return candidate.emails?.find((e) => typeof e === "string" && e.includes("@")) ?? null;
}

export async function searchManatalCandidates(job: Job): Promise<SourcingResult> {
  const cfg = getManatalConfig();
  if (!cfg.enabled) return { status: "not_configured" };

  const jobSkills = extractSkills(`${job.title} ${job.description}`);
  const jobSkillSet = new Set(jobSkills);
  const query = [job.title, ...jobSkills.slice(0, 3)].filter(Boolean).join(" ");
  const url = `${cfg.baseUrl}/candidates/?search=${encodeURIComponent(query)}&page=1`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Token ${cfg.apiKey}`, Accept: "application/json" },
      signal: controller.signal,
    });

    const text = await res.text();
    let data: ManatalListResponse = {};
    try {
      data = text ? (JSON.parse(text) as ManatalListResponse) : {};
    } catch {
      data = {};
    }

    if (!res.ok) {
      const message = data.detail ?? data.error ?? text.slice(0, 300) ?? `HTTP ${res.status}`;
      return { status: "error", message: `Manatal: ${message}` };
    }

    const candidates: SourcedCandidate[] = (data.results ?? []).slice(0, 15).map((c) => {
      const skills = candidateSkills(c);
      const matchedSkills = skills.filter((s) => jobSkillSet.has(s) || jobSkillSet.has(extractSkills(s)[0] ?? ""));
      const matchScore =
        jobSkills.length > 0 && skills.length > 0
          ? Math.round((matchedSkills.length / jobSkills.length) * 100)
          : null;
      return {
        apolloId: c.id != null ? String(c.id) : null,
        name: c.full_name ?? ([c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown"),
        firstName: c.first_name ?? null,
        lastName: c.last_name ?? null,
        title: c.current_position ?? "",
        company: c.current_employer ?? c.current_company ?? "",
        location: c.address ?? c.location ?? "",
        linkedinUrl: c.linkedin_url ?? null,
        emailStatus: firstEmail(c),
        matchScore,
        matchedSkills: matchedSkills.length > 0 ? matchedSkills : skills.slice(0, 6),
      };
    });

    return { status: "ok", candidates, jobSkills };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Manatal request timed out."
        : error instanceof Error
          ? error.message
          : "Manatal request failed.";
    return { status: "error", message };
  } finally {
    clearTimeout(timer);
  }
}
