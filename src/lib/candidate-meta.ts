/**
 * Candidate source + CRM-status vocabularies.
 *
 * Kept free of any database/server imports so both server code and client
 * components (the "Add candidate" form, the CRM status selector) can share the
 * same values without pulling better-sqlite3 into the browser bundle.
 */

/** How a person entered the candidate pool. */
export const CANDIDATE_SOURCES = [
  "applied",
  "sourced",
  "imported",
  "referred",
  "manual",
  "unknown",
] as const;

export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

export const CANDIDATE_SOURCE_LABELS: Record<CandidateSource, string> = {
  applied: "Applied",
  sourced: "Sourced",
  imported: "Imported",
  referred: "Referred",
  manual: "Manual",
  unknown: "Unknown",
};

export function isCandidateSource(value: unknown): value is CandidateSource {
  return typeof value === "string" && (CANDIDATE_SOURCES as readonly string[]).includes(value);
}

/** Outreach/pipeline status for a passive (non-applicant) candidate. */
export const CANDIDATE_CRM_STATUSES = [
  "internal_record",
  "needs_outreach",
  "contacted",
  "replied",
  "interested",
  "not_interested",
  "do_not_contact",
] as const;

export type CandidateCrmStatus = (typeof CANDIDATE_CRM_STATUSES)[number];

export const CANDIDATE_CRM_STATUS_LABELS: Record<CandidateCrmStatus, string> = {
  internal_record: "Internal record",
  needs_outreach: "Needs outreach",
  contacted: "Contacted",
  replied: "Replied",
  interested: "Interested",
  not_interested: "Not interested",
  do_not_contact: "Do not contact",
};

export function isCandidateCrmStatus(value: unknown): value is CandidateCrmStatus {
  return typeof value === "string" && (CANDIDATE_CRM_STATUSES as readonly string[]).includes(value);
}

/** Reduce a phone number to comparable digits (drops formatting, +, spaces). */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
