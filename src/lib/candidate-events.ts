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
  type: CandidateEventType;
  detail: string;
  actor: string;
  created_at: string;
};

export function recordCandidateEvent(input: {
  organization_id: string;
  application_id: string;
  type: CandidateEventType;
  detail: string;
  actor?: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO candidate_events (id, organization_id, application_id, type, detail, actor, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      input.organization_id,
      input.application_id,
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
