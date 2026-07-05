import type { Job, Organization } from "./db";

/**
 * Apollo People Match (enrichment) + outreach drafting.
 *
 * Sourcing search returns masked contacts; enrichment reveals the email for a
 * specific person. The outreach draft is an offline personalized template — a
 * clear seam where an LLM could later write a bespoke message. Gated on
 * APOLLO_API_KEY for the enrichment call.
 */

const APOLLO_BASE_URL = process.env.APOLLO_BASE_URL ?? "https://api.apollo.io";
const APOLLO_MATCH_PATH = "/api/v1/people/match";
const REQUEST_TIMEOUT_MS = 12_000;

export type EnrichInput = {
  apolloId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  company?: string | null;
  linkedinUrl?: string | null;
};

export type EnrichResult =
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "ok"; email: string | null; phone: string | null };

type ApolloMatchResponse = {
  person?: {
    email?: string | null;
    phone_numbers?: Array<{ sanitized_number?: string; raw_number?: string }>;
  } | null;
};

export async function enrichCandidate(input: EnrichInput): Promise<EnrichResult> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return { status: "not_configured" };

  const body: Record<string, unknown> = { reveal_personal_emails: true };
  if (input.apolloId) body.id = input.apolloId;
  if (input.firstName) body.first_name = input.firstName;
  if (input.lastName) body.last_name = input.lastName;
  if (input.name && !input.firstName) body.name = input.name;
  if (input.company) body.organization_name = input.company;
  if (input.linkedinUrl) body.linkedin_url = input.linkedinUrl;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${APOLLO_BASE_URL}${APOLLO_MATCH_PATH}`, {
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
        message: `Apollo enrichment failed (${response.status}). Check the key and enrichment credits.`,
      };
    }

    const data = (await response.json()) as ApolloMatchResponse;
    const phone = data.person?.phone_numbers?.[0]?.sanitized_number
      ?? data.person?.phone_numbers?.[0]?.raw_number
      ?? null;

    return { status: "ok", email: data.person?.email ?? null, phone };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Apollo enrichment timed out. Please try again."
      : "Could not reach Apollo. Please try again later.";
    return { status: "error", message };
  } finally {
    clearTimeout(timeout);
  }
}

export type OutreachDraft = { subject: string; body: string };

/**
 * Builds a personalized first-touch outreach email for a sourced candidate.
 * Offline and deterministic; the LLM extension point is this function.
 */
export function buildOutreachEmail(params: {
  candidateName: string;
  candidateTitle: string;
  matchedSkills: string[];
  job: Job;
  organization: Organization;
  recruiterName?: string;
}): OutreachDraft {
  const { candidateName, candidateTitle, matchedSkills, job, organization, recruiterName } = params;
  const firstName = candidateName.split(/\s+/)[0] || "there";
  const locationLine = job.location ? ` in ${job.location}` : "";

  const skillsSentence =
    matchedSkills.length > 0
      ? `Your background in ${formatList(matchedSkills.slice(0, 3))} lines up well with what we're looking for.`
      : "Your experience looks like a strong match for what we're looking for.";

  const titleClause = candidateTitle ? ` as ${candidateTitle}` : "";

  const subject = `${job.title} opportunity at ${organization.name}`;
  const body = [
    `Hi ${firstName},`,
    "",
    `I came across your profile${titleClause} and wanted to reach out about a ${job.title} role we're hiring for at ${organization.name}${locationLine}.`,
    "",
    skillsSentence,
    "",
    "Would you be open to a short conversation to see if it's a fit? You can reply directly to this email.",
    "",
    "Best regards,",
    recruiterName || organization.name,
  ].join("\n");

  return { subject, body };
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
