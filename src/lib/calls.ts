import { getDb } from "./db";
import { recordCandidateEvent } from "./candidate-events";
import { CALL_OUTCOMES, CHANNEL_LABELS, type CallChannel, type CallOutcomeKey } from "./call-outcomes";

/**
 * Outreach logging for the Call Queue. A logged touch writes a candidate
 * timeline event and updates the person's last-contacted / follow-up state so
 * the queue knows who's due. Stage moves are handled separately by the
 * application status endpoint.
 */

/**
 * Record a logged call/text/email against a candidate. Updates last_contacted,
 * sets or clears the follow-up date, and appends a timeline event.
 */
export function logCall(input: {
  organization_id: string;
  candidate_id: string;
  application_id?: string;
  channel: CallChannel;
  outcome: CallOutcomeKey;
  note?: string;
  followUpAt?: string;
  actor: string;
}): void {
  const database = getDb();
  const outcome = CALL_OUTCOMES.find((o) => o.key === input.outcome)!;
  const now = new Date().toISOString();

  const note = input.note?.trim() ?? "";
  const detail = `${CHANNEL_LABELS[input.channel]} · ${outcome.label}${note ? ` — ${note}` : ""}`;

  recordCandidateEvent({
    organization_id: input.organization_id,
    candidate_id: input.candidate_id,
    application_id: input.application_id,
    type: input.channel === "email" ? "email_sent" : "call",
    detail,
    actor: input.actor,
  });

  // A "closing" outcome clears any pending follow-up; otherwise the caller's
  // follow-up date wins (empty leaves the existing one in place only when this
  // outcome doesn't normally schedule one).
  let followUp: string | null = null;
  if (input.followUpAt) {
    followUp = input.followUpAt;
  } else if (outcome.closes) {
    followUp = ""; // clear
  }

  if (followUp === null) {
    database
      .prepare("UPDATE candidates SET last_contacted_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
      .run(now, now, input.candidate_id, input.organization_id);
  } else {
    database
      .prepare(
        "UPDATE candidates SET last_contacted_at = ?, follow_up_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
      )
      .run(now, followUp, now, input.candidate_id, input.organization_id);
  }
}
