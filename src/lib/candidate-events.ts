import { randomUUID } from "crypto";
import { getDb } from "./db";

/**
 * Per-candidate activity timeline: application received, stage changes, notes,
 * and emails sent. Gives the recruiter the chronological "story" of a candidate
 * instead of disconnected data points.
 */

export type CandidateEventType = "applied" | "stage_change" | "note" | "email_sent";

export type CandidateEvent = {
  id: string;
  organization_id: string;
  application_id: string;
  candidate_id: string;
  type: CandidateEventType;
  detail: string;
  actor: string;
  created_at: string;
};

export function recordCandidateEvent(input: {
  organization_id: string;
  /** Empty for person-level events logged directly on a candidate. */
  application_id?: string;
  candidate_id?: string;
  type: CandidateEventType;
  detail: string;
  actor?: string;
}): void {
  const database = getDb();
  let applicationId = input.application_id ?? "";
  // Resolve the owning candidate from the application when the caller doesn't
  // supply it, so every event lands on the person's unified timeline.
  let candidateId = input.candidate_id ?? "";
  if (!candidateId && applicationId) {
    const row = database
      .prepare("SELECT candidate_id FROM applications WHERE id = ?")
      .get(applicationId) as { candidate_id?: string } | undefined;
    candidateId = row?.candidate_id ?? "";
  }
  // Person-level events (no application) anchor to the candidate's most recent
  // application so the application_id foreign key stays valid; the timeline is
  // queried by candidate_id, so the note still shows on the unified profile.
  if (!applicationId && candidateId) {
    const row = database
      .prepare("SELECT id FROM applications WHERE candidate_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1")
      .get(candidateId) as { id?: string } | undefined;
    applicationId = row?.id ?? "";
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
export function listEventsByCandidate(candidateId: string, organizationId: string): CandidateEvent[] {
  return getDb()
    .prepare(
      `SELECT * FROM candidate_events
       WHERE candidate_id = ? AND organization_id = ?
       ORDER BY created_at DESC, rowid DESC`,
    )
    .all(candidateId, organizationId) as CandidateEvent[];
}
