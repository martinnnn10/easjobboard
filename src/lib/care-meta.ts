/**
 * Candidate Care vocabularies — DB-free so both server (task creation, sweep)
 * and client (confirm panels, forms) share one definition without pulling
 * better-sqlite3 into the browser bundle.
 */

export const CARE_TASK_TYPES = [
  { key: "pre_interview_checkin", label: "Pre-interview check-in" },
  { key: "interview_prep", label: "Interview prep" },
  { key: "day_before_reminder", label: "Day-before reminder" },
  { key: "day_of_confirmation", label: "Day-of confirmation" },
  { key: "post_interview_followup", label: "Post-interview follow-up" },
  { key: "offer_followup", label: "Offer follow-up" },
  { key: "start_date_checkin", label: "Start-date check-in" },
] as const;
export type CareTaskType = (typeof CARE_TASK_TYPES)[number]["key"];

export const CARE_TASK_STATUSES = ["open", "confirmed", "snoozed", "escalated", "missed", "cancelled"] as const;
export type CareTaskStatus = (typeof CARE_TASK_STATUSES)[number];

export const CARE_STATUS_LABELS: Record<CareTaskStatus, string> = {
  open: "Open",
  confirmed: "Confirmed",
  snoozed: "Snoozed",
  escalated: "Escalated",
  missed: "Missed",
  cancelled: "Cancelled",
};

export const CONTACT_METHODS = [
  { key: "call", label: "Call" },
  { key: "text", label: "Text" },
  { key: "email", label: "Email" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "other", label: "Other" },
] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number]["key"];

export const CARE_OUTCOMES = [
  { key: "candidate_confirmed", label: "Candidate confirmed" },
  { key: "candidate_has_questions", label: "Candidate has questions" },
  { key: "candidate_needs_prep", label: "Candidate needs prep" },
  { key: "left_voicemail", label: "Left voicemail" },
  { key: "sent_text", label: "Sent text" },
  { key: "sent_email", label: "Sent email" },
  { key: "no_response", label: "No response" },
  { key: "candidate_rescheduled", label: "Candidate rescheduled" },
  { key: "candidate_withdrew", label: "Candidate withdrew" },
  { key: "risk_no_show", label: "Risk of no-show" },
] as const;
export type CareOutcome = (typeof CARE_OUTCOMES)[number]["key"];

export const INTERVIEW_TYPES = [
  { key: "phone_screen", label: "Phone screen" },
  { key: "video", label: "Video interview" },
  { key: "onsite", label: "On-site" },
  { key: "panel", label: "Panel" },
  { key: "working_interview", label: "Working interview" },
  { key: "final", label: "Final" },
  { key: "other", label: "Other" },
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number]["key"];

const labelOf = <T extends { key: string; label: string }>(list: readonly T[], key: string): string =>
  list.find((x) => x.key === key)?.label ?? key;

export const careTaskTypeLabel = (k: string) => labelOf(CARE_TASK_TYPES, k);
export const contactMethodLabel = (k: string) => labelOf(CONTACT_METHODS, k);
export const careOutcomeLabel = (k: string) => labelOf(CARE_OUTCOMES, k);
export const interviewTypeLabel = (k: string) => labelOf(INTERVIEW_TYPES, k);

export const isCareTaskType = (v: unknown): v is CareTaskType =>
  typeof v === "string" && CARE_TASK_TYPES.some((t) => t.key === v);
export const isContactMethod = (v: unknown): v is ContactMethod =>
  typeof v === "string" && CONTACT_METHODS.some((t) => t.key === v);
export const isCareOutcome = (v: unknown): v is CareOutcome =>
  typeof v === "string" && CARE_OUTCOMES.some((t) => t.key === v);
export const isInterviewType = (v: unknown): v is InterviewType =>
  typeof v === "string" && INTERVIEW_TYPES.some((t) => t.key === v);

/** SLA: escalate a required task if not confirmed within this many hours of due. */
export const CARE_SLA_HOURS = 12;
