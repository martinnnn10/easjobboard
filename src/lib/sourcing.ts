import type { Job } from "./db";
import { extractSkills } from "./skills";

/**
 * Outbound candidate sourcing via Apollo's People Search API.
 *
 * Inbound applications only reach the ~5% who are actively job-hunting; this
 * lets a recruiter search the passive market from a job posting. Gated behind
 * APOLLO_API_KEY so the app degrades gracefully (a configure-me notice) when
 * no key is present. Apollo search does not return emails — those require a
 * separate enrichment call — so we surface the email *status* and LinkedIn URL.
 */

// Overridable so regional Apollo endpoints (or a test double) can be targeted.
const APOLLO_BASE_URL = process.env.APOLLO_BASE_URL ?? "https://api.apollo.io";
const APOLLO_SEARCH_PATH = "/api/v1/mixed_people/search";
const REQUEST_TIMEOUT_MS = 12_000;

export type SourcedCandidate = {
  apolloId: string | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
  title: string;
  company: string;
  location: string;
  linkedinUrl: string | null;
  emailStatus: string | null;
  matchScore: number | null;
  matchedSkills: string[];
};

export type SourcingResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "ok"; candidates: SourcedCandidate[]; jobSkills: string[] };

function buildLocation(job: Job): string[] {
  const parts = [job.city, job.state].filter(Boolean);
  if (parts.length > 0) return [parts.join(", ")];
  if (job.location) return [job.location];
  return [];
}

/**
 * Translates a job posting into an Apollo People Search request body.
 */
export function buildSearchBody(job: Job, jobSkills: string[], perPage = 10): Record<string, unknown> {
  const body: Record<string, unknown> = {
    person_titles: [job.title],
    include_similar_titles: true,
    per_page: perPage,
    page: 1,
  };

  const locations = buildLocation(job);
  if (locations.length > 0) body.person_locations = locations;

  // Bias the search toward the job's key skills without over-constraining it.
  if (jobSkills.length > 0) body.q_keywords = jobSkills.slice(0, 5).join(" ");

  return body;
}

type ApolloPerson = {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  headline?: string;
  linkedin_url?: string;
  email_status?: string;
  city?: string;
  state?: string;
  country?: string;
  organization?: { name?: string } | null;
};

function mapPerson(person: ApolloPerson, jobSkills: string[]): SourcedCandidate {
  const company = person.organization?.name ?? "";
  const location = [person.city, person.state, person.country].filter(Boolean).join(", ");
  const haystack = [person.title, person.headline, company].filter(Boolean).join(" ");

  const candidateSkills = new Set(extractSkills(haystack));
  const matchedSkills = jobSkills.filter((skill) => candidateSkills.has(skill));
  const matchScore =
    jobSkills.length > 0 ? Math.round((matchedSkills.length / jobSkills.length) * 100) : null;

  return {
    apolloId: person.id ?? null,
    name: person.name ?? [person.first_name, person.last_name].filter(Boolean).join(" ") ?? "Unknown",
    firstName: person.first_name ?? null,
    lastName: person.last_name ?? null,
    title: person.title ?? person.headline ?? "",
    company,
    location,
    linkedinUrl: person.linkedin_url ?? null,
    emailStatus: person.email_status ?? null,
    matchScore,
    matchedSkills,
  };
}

/**
 * Runs an outbound candidate search for a job. Never throws — all failure
 * modes are returned as a discriminated result the UI can render.
 */
export async function sourceCandidates(job: Job): Promise<SourcingResult> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return { status: "not_configured" };

  const jobSkills = extractSkills(`${job.title} ${job.description}`);
  const body = buildSearchBody(job, jobSkills);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${APOLLO_BASE_URL}${APOLLO_SEARCH_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        status: "error",
        message: `Apollo search failed (${response.status}). Check APOLLO_API_KEY and plan limits.`,
      };
    }

    const data = (await response.json()) as { people?: ApolloPerson[] };
    const people = Array.isArray(data.people) ? data.people : [];
    const candidates = people
      .map((person) => mapPerson(person, jobSkills))
      .sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));

    return { status: "ok", candidates, jobSkills };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Apollo search timed out. Please try again."
      : "Could not reach Apollo. Please try again later.";
    return { status: "error", message };
  } finally {
    clearTimeout(timeout);
  }
}
