/**
 * Call-outcome vocabulary. DB-free so the Call Queue panel (client) and the
 * logging lib (server) share one definition without pulling better-sqlite3 into
 * the browser bundle.
 */

export const CALL_OUTCOMES = [
  { key: "no_answer", label: "No answer", followUp: true, closes: false },
  { key: "left_voicemail", label: "Left voicemail", followUp: true, closes: false },
  { key: "spoke_interested", label: "Spoke — interested", followUp: false, closes: false },
  { key: "spoke_not_interested", label: "Spoke — not interested", followUp: false, closes: true },
  { key: "wrong_number", label: "Wrong number", followUp: false, closes: true },
  { key: "bad_fit", label: "Bad fit", followUp: false, closes: true },
  { key: "follow_up_later", label: "Follow up later", followUp: true, closes: false },
  { key: "submitted", label: "Submitted to hiring manager", followUp: false, closes: false },
  { key: "interview_scheduled", label: "Interview scheduled", followUp: false, closes: false },
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];
export type CallOutcomeKey = CallOutcome["key"];

export type CallChannel = "call" | "text" | "email";

export const CHANNEL_LABELS: Record<CallChannel, string> = {
  call: "Call",
  text: "Text",
  email: "Email",
};

export function isCallOutcome(value: unknown): value is CallOutcomeKey {
  return typeof value === "string" && CALL_OUTCOMES.some((o) => o.key === value);
}

export function isCallChannel(value: unknown): value is CallChannel {
  return value === "call" || value === "text" || value === "email";
}
