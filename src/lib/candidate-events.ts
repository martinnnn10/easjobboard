import { randomUUID } from "crypto";
import { getDb } from "./db";
import type { JobAccess } from "./job-visibility";

/**
 * Per-candidate activity timeline: application received, stage changes, notes,
 * and emails sent. Gives the recruiter the chronological "story" of a candidate
 * instead of disconnected data points.
 */

export type CandidateEventType =
  | "applied"
  | "stage_change"
  | "note"
  | "email_sent"
  | "sourced"
  | "call"
  | "interview"
  | "care";

export type CandidateEvent = {
  id: string;
  organization_id: string;
  /** Null for person-level events logged directly on a candidate (no application). */
  application_id: string | null;
  candidate_id: string;
  type: CandidateEventType;
  detail: string;
  actor: string;
  created_at: string;
};

export function recordCandidateEvent(input: {
  organization_id: string;
  /** Omit for person-level events logged directly on a candidate. */
  application_id?: string;
  candidate_id?: string;
  type: CandidateEventType;
  detail: string;
  actor?: string;
}): void {
  const database = getDb();
  // Person-level events (a sourced candidate with no application yet) store NULL
  // for application_id — the column is nullable, so no FK anchoring is needed.
  const applicationId = input.application_id?.trim() || null;
  // Resolve the owning candidate from the application when the caller doesn't
  // supply it, so every event lands on the person's unified timeline.
  let candidateId = input.candidate_id ?? "";
  if (!candidateId && applicationId) {
    const row = database
      .prepare("SELECT candidate_id FROM applications WHERE id = ?")
      .get(applicationId) as { candidate_id?: string } | undefined;
    candidateId = row?.candidate_id ?? "";
  }

  database
    .prepare(
      `INSERT INTO candidate_events (id, organization_id, application_id, candidate_id, type, detail, actor, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      input.organization_id,
      applicationId,
      candidateId,
      input.type,
      input.detail,
      input.actor ?? "",
      new Date().toISOString(),
    );
}

export function listCandidateEvents(applicationId: string, organizationId: string): CandidateEvent[] {
  return getDb()
    .prepare(
      `SELECT * FROM candidate_events
       WHERE application_id = ? AND organization_id = ?
       ORDER BY created_at DESC, rowid DESC`,
    )
    .all(applicationId, organizationId) as CandidateEvent[];
}

/** Unified timeline for a candidate across all their applications. */
export function listEventsByCandidate(
  candidateId: string,
  organizationId: string,
  access?: JobAccess,
): CandidateEvent[] {
  const params: Array<string> = [candidateId, organizationId];
  let visClause = "";
  if (access && !access.unrestricted && access.hiddenJobIds.size > 0) {
    const ids = [...access.hiddenJobIds];
    // Hide events tied to an application on a restricted job; person-level
    // events (no application_id) always remain visible.
    visClause =
      ` AND (application_id IS NULL OR application_id = ''` +
      ` OR NOT EXISTS (SELECT 1 FROM applications a WHERE a.id = candidate_events.application_id` +
      ` AND a.job_id IN (${ids.map(() => "?").join(", ")})))`;
    params.push(...ids);
  }
  return getDb()
    .prepare(
      `SELECT * FROM candidate_events
       WHERE candidate_id = ? AND organization_id = ?${visClause}
       ORDER BY created_at DESC, rowid DESC`,
    )
    .all(...params) as CandidateEvent[];
}
